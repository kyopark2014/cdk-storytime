# serverless-storytime-for-slack

slack 으로 메시지를 event 에서 추출

```java
  const message = event.Records[0].Sns.Message;
  console.log("msg: "+message);
```

slack에서 제공하는 api를 통해 slack에 메시지를 전송하게 되는데, token을 미리 lambda의 environment variable에 저장하여 사용합니다. 

```java
const token = process.env.token;
const { WebClient } = require('@slack/web-api');
const web = new WebClient(token);
```

slack으로 아래와 같이 메시지 전송을 합니다. 


```java
  (async () => {
    try {
      // Use the `chat.postMessage` method to send a message from this app
      let result = await web.chat.postMessage({
        channel: 'storytime',
        text: currentTime+'\n'+message,
      });
      
      console.log('response: '+ JSON.stringify(result));
      console.log('### ok: '+result.ok);

      const response = {
        statusCode: 200,
        body: JSON.stringify({ok:result.ok})
      };
      return response 
    } catch (error) {
      console.log(error);

      const response = {
        statusCode: 500,
      };
      return response 
    }  
  })(); 
```

Lambda의 경우에 event를 모두 가져가면 종료되는데, slack에서 응답을 받기전에 종료되면 메시지 전송에 실패하게 됩니다. 따라서 아래와 같이 일정시간 lambda를 종료하지 않도록 해야 메시지가 정상적으로 발신됩니다. 

```java
  function wait(){
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve("hello"), 2000)
    });
  }
  console.log(await wait());
  console.log(await wait());
  console.log(await wait());
  console.log(await wait());
  console.log(await wait());
  
  return 'exiting'
```
