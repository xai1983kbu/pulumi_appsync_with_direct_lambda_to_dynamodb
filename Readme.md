# Example how create "AppSync + Lambda + DynamoDB" via Infrastructure as Code Provider "Pulumi".

This example based on next resourses:
- https://medium.com/@wesselsbernd/bff-back-end-for-front-end-architecture-as-of-may-2019-5d09b913a8ed
- https://www.youtube.com/watch?v=rjiiNpJzOYk

.env file should include:
```
USER_POOL_ID=
USER_POOL_AWS_REGION=
POST_TABLE=
```

Appsync direct lambda support issue and workaround:
https://github.com/pulumi/pulumi-aws/issues/1081
https://github.com/hashicorp/terraform-provider-aws/issues/14488
