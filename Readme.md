Example how to use "Pulumi + ( AppSync + Lambda + DynamoDB )" based on this article https://medium.com/@wesselsbernd/bff-back-end-for-front-end-architecture-as-of-may-2019-5d09b913a8ed and this video https://www.youtube.com/watch?v=rjiiNpJzOYk

.env file includes:
USER_POOL_ID=
USER_POOL_AWS_REGION=
POST_TABLE=

Appsync direct lambda support workaround related issues:
https://github.com/pulumi/pulumi-aws/issues/1081
https://github.com/hashicorp/terraform-provider-aws/issues/14488
