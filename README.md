# cdk-storytime

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

