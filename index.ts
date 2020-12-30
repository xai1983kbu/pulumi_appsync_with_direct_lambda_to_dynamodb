require('dotenv').config()
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as random from "@pulumi/random";
import { AppSyncEvent } from "./appsync/graphql/utility/types";

const fs = require('fs');
const glob = require('glob');
const path = require('path');

// Add the ability to read .graphql files as strings.
require.extensions['.graphql'] = function (module, filename) {
    module.exports = fs.readFileSync(filename, 'utf8');
};

// Read the GraphQL Schema as a string.
const graphQLSchema = require('./appsync/schema/schema.graphql');

// Regular Expression helper function
const findMatches = (regex: RegExp, str: string, matches: string[] = []) => {
    const res = regex.exec(str);
    // res && matches.push(res[1]) && findMatches(regex, str, matches);
    if (res) { matches.push(res[1]) && findMatches(regex, str, matches); }
    return matches;
};

// Dynamo DB table to hold data for the GraphQL endpoint
const table = new aws.dynamodb.Table("pulumiPostTable", {
    hashKey: "id",
    attributes: [{ name: "id", type: "S" }],
    billingMode: 'PAY_PER_REQUEST'
});

const graphQLApiCloudWatchLogsRole = new aws.iam.Role("graphQLApiCloudWatchLogsRole", {
    assumeRolePolicy: JSON.stringify({
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "appsync.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }),
});

const graphQLApiCloudWatchLogsRolePolicyAttachment = new aws.iam.RolePolicyAttachment("graphQLApiCloudWatchLogsRolePolicyAttachment", {
    policyArn: "arn:aws:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs",
    role: graphQLApiCloudWatchLogsRole.name,
});

const userPool = {
    id: process.env.USER_POOL_ID,
    awsRegion: process.env.USER_POOL_AWS_REGION
};

// Create API accessible with a key and cognito user pool
const graphQLApi = new aws.appsync.GraphQLApi("api", {
    name: "pulumi-blog-api",
    schema: graphQLSchema,
    authenticationType: "API_KEY",
    additionalAuthenticationProviders: [{
        authenticationType: "AMAZON_COGNITO_USER_POOLS",
        userPoolConfig: {
            awsRegion: userPool.awsRegion,
            userPoolId: userPool.id!,
        },
    }],
    logConfig: {
        cloudwatchLogsRoleArn: graphQLApiCloudWatchLogsRole.arn,
        fieldLogLevel: "ERROR",
    },
    // xrayEnabled: true
});

const apiKey = new aws.appsync.ApiKey("key", {
    apiId: graphQLApi.id,
    description: "apiKey for pulumi-blog-api (appsync)"
});

// --------- create role for lambda and attach policies -------

const lambda_role = new aws.iam.Role(
    "lambdaRole__ghjghd",
    {
      assumeRolePolicy: `{
          "Version": "2012-10-17",
          "Statement": [
              {
                  "Action": "sts:AssumeRole",
                  "Principal": {
                      "Service": "lambda.amazonaws.com"
                  },
                  "Effect": "Allow",
                  "Sid": ""
              }
          ]
      }`,
    }
  );

  const lambda_role_policy = new aws.iam.RolePolicy(
    "lambdaRolePolicy_hkhkhjm",
    {
      role: lambda_role.id,
      policy: `{
          "Version": "2012-10-17",
          "Statement": [
          {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
          }
        ]
      }`,
    }
  );

  new aws.iam.RolePolicyAttachment("processDynamoDB_RoleAttach", {
    role: lambda_role,
    policyArn: aws.iam.ManagedPolicies.AmazonDynamoDBFullAccess,
  });

// ----- create role for appsync ----------
const appsync_role = new aws.iam.Role(
    "appsyncRole__xfgdfe",
    {
      assumeRolePolicy: `{
          "Version": "2012-10-17",
          "Statement": [
              {
                  "Action": "sts:AssumeRole",
                  "Principal": {
                      "Service": "appsync.amazonaws.com"
                  },
                  "Effect": "Allow",
                  "Sid": ""
              }
          ]
      }`,
    }
  );

// ---------- Resolvers ---------------------
const createLambda = (
    name: string,
    callbackFactory: aws.lambda.CallbackFactory<AppSyncEvent, aws.lambda.Context>,
    lambda_role: aws.iam.Role): aws.lambda.CallbackFunction<any, any> =>
  new aws.lambda.CallbackFunction(`${name}_LN`, {
    // callback: callbackFactory,
    callbackFactory: callbackFactory,
    runtime: "nodejs12.x",
    memorySize: 1024,
    environment: {
        variables: {
            POST_TABLE: process.env.POST_TABLE!
        }
    },
    role: lambda_role,
  });

const requestTemplate = `{
    "version" : "2017-02-28",
    "operation": "Invoke",
    "payload": {
      "arguments": $util.toJson($ctx.arguments),
      "identity": $util.toJson($ctx.identity),
      "source": $util.toJson($ctx.source),
      "request": $util.toJson($ctx.request),
      "prev": $util.toJson($ctx.prev),
      "info": {
          "selectionSetList": $util.toJson($ctx.info.selectionSetList),
          "selectionSetGraphQL": $util.toJson($ctx.info.selectionSetGraphQL),
          "parentTypeName": $util.toJson($ctx.info.parentTypeName),
          "fieldName": $util.toJson($ctx.info.fieldName),
          "variables": $util.toJson($ctx.info.variables)
      },
      "stash": $util.toJson($ctx.stash)
    }
  }`;
const responseTemplate = `$util.toJson($ctx.result)`;

const graphQLResolvers = [];
glob.sync('./appsync/graphql/resolvers/**/*.ts').forEach(function (file: string) {
    const resolverMatches = findMatches(/([a-zA-Z]+)\./g, file);
    const resolverObject = require(path.resolve(file));
    // console.log(resolverMatches, resolverObject, file);
    const name = `${resolverMatches.join('_')}_`;
    const lambda = createLambda(name, resolverObject, lambda_role);
    // create and attach Policy to appSync role
    const policy = new aws.iam.Policy(`${name}-policy`, {
        policy: lambda.arn.apply(arn => aws.iam.getPolicyDocument({
            statements: [{
                actions: ["lambda:InvokeFunction"],
                resources: [arn],
                effect: "Allow",
            }],
        }, { async: true }).then(doc => doc.json)),
    });
    new aws.iam.RolePolicyAttachment(`${name}-rpa`, {
        role: appsync_role,
        policyArn: policy.arn,
    });

    // create datasource
    const randomString = new random.RandomString(`${name}_RDSN`, {
        length: 15,
        special: false,
        number: false,
    });
    const dataSource = new aws.appsync.DataSource(`${name}-DS`, {
        name: randomString.result,
        apiId: graphQLApi.id,
        serviceRoleArn: appsync_role.arn,
        type: 'AWS_LAMBDA',
        lambdaConfig: {
            functionArn: lambda.arn
        }
    });

    // create appsync resolver
    const graphQLResolver = new aws.appsync.Resolver(`graphQLResolver_${resolverMatches.join('_')}`, {
        apiId: graphQLApi.id,
        dataSource: dataSource.name,
        type: resolverMatches[0],
        field: resolverMatches[1],
        requestTemplate,
        responseTemplate,
    });
    graphQLResolvers.push(graphQLResolver);
});

export const endpoint = graphQLApi.uris["GRAPHQL"];
export const key = apiKey.key;
