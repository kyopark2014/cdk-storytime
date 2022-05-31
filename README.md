# CDK 기반의 Storytime

본 문서에서는 [Serverless Event-Driven Architecture에 기반하여 책 읽어주는 서비스(Story Time)](https://github.com/kyopark2014/serverless-storytime)를 AWS CDK 기반으로 구성합니다.

## Storytime

책 읽어주는 서비스(Storytime)는 이미지에서 텍스트를 추출하는 AWS Rekognition과 텍스트를 음성으로 변환하는 AWS Polly을 이용하여 구현됩니다. 이러한 AI/ML기반의 AWS 서비스를 사용하여 효율적인 시스템 아키텍처를 설계하기 위하여 AWS Lambda와 AWS SQS를 적극적으로 사용합니다. 이와 같은 AWS Serverless Architecture는 초기 투자가 없어 비용 효율적이며, auto scaling을 통해 트래픽 변화에 대해서도 적절히 대응할 수 있습니다. 아래 그림은 Story Time의 Severless Event-Driven Architecture에 구조에 대해 기술하고 있습니다. 

<img width="1419" alt="image" src="https://user-images.githubusercontent.com/52392004/158305208-743b1bef-b8d6-4091-a92c-785286c6f4fe.png">

주요 사용 시나리오는 아래와 같습니다.
 
1) 사용자가 동화책과 같은 읽고자 하는 책을 카메라로 찍습니다.

2) 이미지를 RESTful API를 이용해 API Gateway를 통해 업로드를 합니다. 통신 프로토콜은 https를 이용합니다. 
이후, Lambda for upload는 S3에 파일을 저장하고, Bucket 이름과 Key와 같은 정보를 event로 SQS에 전달합니다. 

3) SQS의 event는 Lambda for Rekognition에 전달되고, 이 정보는 AWS Rekognition를 통해 JSON 형태의 텍스트 정보를 추울합니다. 

4) 텍스트 정보는 다시 SQS를 통해 Lambda for Polly로 전달되는데, JSON 형식의 event에서 텍스트틑 추출하여, AWS Polly를 통해 음성파일로 변환하게 됩니다.

5) 음성파일은 S3에 저장되는데, Lambda for Polly를 이 정보를 CloudFront를 통해 외부에 공유할 수 있는 URL로 변환후, AWS SNS를 통해 사용자에게 이메일 또는 Slack으로 전달합니다. 


## Sequence Diagram

[Sequence Diagram](https://github.com/kyopark2014/serverless-storytime/blob/main/SequenceDiagram.md)에서는 기본동작 시나리오, 중복처리, Retrive API에 대해 Sequence diagram으로 설명합니다.



### initialize

아래처럼 typescript 초기화후 cdk-storytime-stack.ts를 복사해서 사용 합니다. 

```c
$ mkdir cdk-storytime

$ cd cdk-storytime

$ cdk init app --language typescript
```

bootstrap을 통해 계정 설정을 합니다. 

```c
$ cdk bootstrap aws://xxxx/ap-northeast-1 
````

아래 명령어를 통해 deploy 합니다. 

```c
$ cdk synth

$ cdk deploy
````

### 동작확인 

### Secret으로 Token 보관하기 

아래와 같이 Secret Manager의 Console에 접속합니다. 

https://ap-northeast-2.console.aws.amazon.com/secretsmanager/home?region=ap-northeast-2#!/newSecret?step=selectSecret

아래처럼 token을 저장합니다. 

![image](https://user-images.githubusercontent.com/52392004/159823693-af0b02ca-0871-48f7-9217-943e23f1eb56.png)

불러올때는 아래 코드를 참고 합니다. 

