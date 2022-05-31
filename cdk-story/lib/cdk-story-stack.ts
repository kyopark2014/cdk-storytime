import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

const sqs = require('aws-cdk-lib/aws-sqs');
const {SqsEventSource} = require('aws-cdk-lib/aws-lambda-event-sources');
const {SnsEventSource} = require('aws-cdk-lib/aws-lambda-event-sources');
const sns = require('aws-cdk-lib/aws-sns');
const subscriptions = require('aws-cdk-lib/aws-sns-subscriptions');
const lambda = require('aws-cdk-lib/aws-lambda');
const apiGateway = require('aws-cdk-lib/aws-apigateway');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const s3 = require('aws-cdk-lib/aws-s3');
const iam = require('aws-cdk-lib/aws-iam');
const cloudFront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const logs = require('aws-cdk-lib/aws-logs');
import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi } from 'aws-cdk-lib/aws-apigateway';

const stage = "dev";

export class CdkStoryStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // SQS - Rekognition
    const queueRekognition = new sqs.Queue(this, 'QueueRekognition');

    new cdk.CfnOutput(this, 'sqsRekognitionUrl', {
      value: queueRekognition.queueUrl,
      description: 'The url of the Rekognition Queue',
    });
    
    // SQS - Polly
    const queuePolly = new sqs.Queue(this, 'QueuePolly');
    
    new cdk.CfnOutput(this, 'sqsPollyUrl', {
      value: queuePolly.queueUrl,
      description: 'The url of the Polly Queue',
    });

    // SQS - Opensearch
    const queueOpensearch = new sqs.Queue(this, 'QueueOpensearch');

    new cdk.CfnOutput(this, 'sqsOpensearchUrl', {
      value: queueOpensearch.queueUrl,
      description: 'The url of the Opensearch Queue',
    });

    // SNS
    const topic = new sns.Topic(this, 'sns-storytime', {
      topicName: 'sns-storytime'
    });
    topic.addSubscription(new subscriptions.EmailSubscription('storytimebot21@gmail.com'));

    new cdk.CfnOutput(this, 'snsTopicArn', {
      value: topic.topicArn,
      description: 'The arn of the SNS topic',
    });
  
    // DynamoDB
    const dataTable = new dynamodb.Table(this, 'dynamodb-storytime', {
      tableName: 'dynamodb-storytime',
        partitionKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'Timestamp', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        // readCapacity: 1,
        // writeCapacity: 1,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    dataTable.addGlobalSecondaryIndex({ // GSI
      indexName: 'ContentID-index',
      partitionKey: { name: 'ContentID', type: dynamodb.AttributeType.STRING },
    });

    // S3
    const s3Bucket = new s3.Bucket(this, "cdk-s3-storytime",{
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
      versioned: false,
    });

    new cdk.CfnOutput(this, 'bucketName', {
      value: s3Bucket.bucketName,
      description: 'The nmae of bucket',
    });

    // cloudfront
    const distribution = new cloudFront.Distribution(this, 'storytime', {
      defaultBehavior: {
        origin: new origins.S3Origin(s3Bucket),
        allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
        priceClass: cloudFront.PriceClass.PriceClass200,  
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        discription: 'cdk cloudFront'
      },
    });

    new cdk.CfnOutput(this, 'distributionDomainName', {
      value: distribution.domainName,
      description: 'The domain name of the Distribution',
    }); 

    // Lambda - Upload
    const lambdaUpload = new lambda.Function(this, "LambdaUpload", {
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("../serverless-storytime-for-upload"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(10),
      environment: {
        sqsRekognitionUrl: queueRekognition.queueUrl,
        sqsOpensearchUrl: queueOpensearch.queueUrl,
        topicArn: topic.topicArn,
        bucket: s3Bucket.bucketName
      }
    });  
    queueRekognition.grantSendMessages(lambdaUpload);
    queueOpensearch.grantSendMessages(lambdaUpload);
    dataTable.grantReadWriteData(lambdaUpload);
    topic.grantPublish(lambdaUpload);
    s3Bucket.grantReadWrite(lambdaUpload);


    // Lambda - Rekognition
    const lambdaRekognition = new lambda.Function(this, "LambdaRekognition", {
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("../serverless-storytime-for-rekognition"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(10),
      environment: {
        sqsRekognitionUrl: queueRekognition.queueUrl,
        sqsPollyUrl: queuePolly.queueUrl,
        sqsOpensearchUrl: queueOpensearch.queueUrl
      }
    });   
    lambdaRekognition.addEventSource(new SqsEventSource(queueRekognition)); 
    queuePolly.grantSendMessages(lambdaRekognition);
    queueOpensearch.grantSendMessages(lambdaRekognition);
    dataTable.grantReadWriteData(lambdaRekognition);
    s3Bucket.grantRead(lambdaRekognition);

    // create a policy statement
    const RekognitionPolicy = new iam.PolicyStatement({
      actions: ['rekognition:*'],
      resources: ['*'],
    });
    // add the policy to the Function's role
    lambdaRekognition.role?.attachInlinePolicy(
      new iam.Policy(this, 'rekognition-policy', {
        statements: [RekognitionPolicy],
      }),
    );
 
    // Lambda - Polly
    const lambdaPolly = new lambda.Function(this, "LambdaPolly", {
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("../serverless-storytime-for-polly"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(10),
      environment: {
        CDN: 'https://'+distribution.domainName+'/',
        sqsPollyUrl: queuePolly.queueUrl,
        sqsOpensearchUrl: queueOpensearch.queueUrl,
        topicArn: topic.topicArn
      }
    }); 
    lambdaPolly.addEventSource(new SqsEventSource(queuePolly)); 
    queueOpensearch.grantSendMessages(lambdaPolly);
    dataTable.grantReadWriteData(lambdaPolly);
    topic.grantPublish(lambdaPolly);
    s3Bucket.grantWrite(lambdaPolly);

    // create a policy statement
    const PollyPolicy = new iam.PolicyStatement({
      actions: ['polly:*'],
      resources: ['*'],
    });
    // add the policy to the Function's role
    lambdaPolly.role?.attachInlinePolicy(
      new iam.Policy(this, 'polly-policy', {
        statements: [PollyPolicy],
      }),
    );

    // Lambda - Retrieve
    const lambdaRetrieve = new lambda.Function(this, "LambdaRetrieve", {
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("../serverless-storytime-for-retrieve"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(10),
      environment: {
         bucket: s3Bucket.bucketName,
         sqsRekognitionUri: queueRekognition.queueUrl
      }
    }); 
    dataTable.grantReadData(lambdaRetrieve);
    topic.grantPublish(lambdaRetrieve);

    // Lambda - Slack
    const lambdaSlack = new lambda.Function(this, "LambdaSlack", {
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("../serverless-storytime-for-slack"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(10),
      environment: {
        token: "sample-3205298473938-3233090599600-5Kr8k7W8dieUwoL5d7GekmpJ"
      }
    });    
    lambdaSlack.addEventSource(new SnsEventSource(topic)); 

    // Lambda - Bulk
    const lambdaBulk = new lambda.Function(this, "LambdaBulk", {
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("../serverless-storytime-for-bulk-interface"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(10),
      environment: {
        topicArn: topic.topicArn
      }
    });    
    dataTable.grantReadData(lambdaBulk);
    topic.grantPublish(lambdaBulk);

    // Lambda - opensearch
    const lambdaOpensearch = new lambda.Function(this, "LambdaOpensearch", {
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("../serverless-storytime-for-opensearch"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(10),
      environment: {
        sqsOpensearchUri: queueOpensearch.queueUrl
      }
    });    
    lambdaOpensearch.addEventSource(new SqsEventSource(queueOpensearch)); 

    // api Gateway
    const logGroup = new logs.LogGroup(this, 'AccessLogs', {
      retention: 90, // Keep logs for 90 days
    });
    logGroup.grantWrite(new iam.ServicePrincipal('apigateway.amazonaws.com')); 


    const role = new iam.Role(this, "api-role", {
      roleName: "ApiRole",
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com")
    });
    role.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['lambda:InvokeFunction']
    }));
    role.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AWSLambdaExecute',
    }); 

    const api = new apiGateway.RestApi(this, 'api-storytime', {
      description: 'API Gateway',
      endpointTypes: [apiGateway.EndpointType.REGIONAL],
    /*  defaultCorsPreflightOptions: {
        allowOrigins: apiGateway.Cors.ALL_ORIGINS,
        allowMethods: apiGateway.Cors.ALL_METHODS // this is also the default
      }, */
      binaryMediaTypes: ['*/*'], 
      deployOptions: {
        stageName: stage,
        accessLogDestination: new apiGateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apiGateway.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true
        }),
      },
      proxy: false
    });   

    lambdaUpload.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    const templateString: string = `##  See http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
    ##  This template will pass through all parameters including path, querystring, header, stage variables, and context through to the integration endpoint via the body/payload
    #set($allParams = $input.params())
    {
    "body-json" : $input.json('$'),
    "params" : {
    #foreach($type in $allParams.keySet())
        #set($params = $allParams.get($type))
    "$type" : {
        #foreach($paramName in $params.keySet())
        "$paramName" : "$util.escapeJavaScript($params.get($paramName))"
            #if($foreach.hasNext),#end
        #end
    }
        #if($foreach.hasNext),#end
    #end
    },
    "stage-variables" : {
    #foreach($key in $stageVariables.keySet())
    "$key" : "$util.escapeJavaScript($stageVariables.get($key))"
        #if($foreach.hasNext),#end
    #end
    },
    "context" : {
        "account-id" : "$context.identity.accountId",
        "api-id" : "$context.apiId",
        "api-key" : "$context.identity.apiKey",
        "authorizer-principal-id" : "$context.authorizer.principalId",
        "caller" : "$context.identity.caller",
        "cognito-authentication-provider" : "$context.identity.cognitoAuthenticationProvider",
        "cognito-authentication-type" : "$context.identity.cognitoAuthenticationType",
        "cognito-identity-id" : "$context.identity.cognitoIdentityId",
        "cognito-identity-pool-id" : "$context.identity.cognitoIdentityPoolId",
        "http-method" : "$context.httpMethod",
        "stage" : "$context.stage",
        "source-ip" : "$context.identity.sourceIp",
        "user" : "$context.identity.user",
        "user-agent" : "$context.identity.userAgent",
        "user-arn" : "$context.identity.userArn",
        "request-id" : "$context.requestId",
        "resource-id" : "$context.resourceId",
        "resource-path" : "$context.resourcePath"
        }
    }`    
    const requestTemplates = { // path through
      "image/jpeg": templateString,
      "image/jpg": templateString,
      "application/octet-stream": templateString,
      "image/png" : templateString
    }
    
    const upload = api.root.addResource('upload');

    upload.addMethod('POST', new apiGateway.LambdaIntegration(lambdaUpload, {
      // PassthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
      PassthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      requestTemplates: requestTemplates,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [   // API Gateway sends to the client that called a method.
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    addCorsOptions(upload);
    
    const retrieve = api.root.addResource('retrieve');
    retrieve.addMethod('GET', new apiGateway.LambdaIntegration(lambdaRetrieve, {
      PassthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      requestTemplates: {"application/json": templateString},
      integrationResponses: [
        { statusCode: '200' },
      ],
      proxy:false,
    }),{
      methodResponses: [   // API Gateway sends to the client that called a method.
        {
          statusCode: '200',
          'responseModels': {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    const bulk = api.root.addResource('bulk');
    bulk.addMethod('GET', new apiGateway.LambdaIntegration(lambdaBulk, {
      PassthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      requestTemplates: {"application/json": templateString},
      integrationResponses: [
        { statusCode: '200' },
      ],
      proxy:false,
    }),{
      methodResponses: [   // API Gateway sends to the client that called a method.
        {
          statusCode: '200',
          'responseModels': {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    new cdk.CfnOutput(this, 'apiUrl', {
      value: api.url,
      description: 'The url of API Gateway',
    });
  }
}

export function addCorsOptions(apiResouce: IResource) {
  // CORS
  apiResouce.addMethod('OPTIONS', new MockIntegration({
    integrationResponses: [{ 
      statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Credentials': "'false'",
          'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
        }
      },
    ],
    passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_MATCH,
    requestTemplates: {
      'application/json': '{ "statusCode": 200 }',
    },
  }), {
    methodResponses: [{ 
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Credentials': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        }, 
      },
    ],
  });   
}
