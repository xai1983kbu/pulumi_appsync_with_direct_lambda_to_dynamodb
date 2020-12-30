import * as aws from "@pulumi/aws";

type Post = {
  id: string;
  title: string;
  content: string;
  username: string;
};

type AppSyncEvent = {
  info: {
    fieldName: string;
  };
  arguments: {
    postId: string;
    post: Post;
  };
  identity: {
    sub: string;
    username: string;
  };
};

module.exports = () => {
  const AWS = require("aws-sdk");
  const docClient = new AWS.DynamoDB.DocumentClient();

  async function deletePost(postId: string, username: string) {
    const params = {
      TableName: process.env.POST_TABLE,
      Key: {
        id: postId,
      },
      ConditionExpression: "#username = :authenticatedUser",
      ExpressionAttributeNames: { "#username": "username" },
      ExpressionAttributeValues: { ":authenticatedUser": username },
    };
    try {
      await docClient.delete(params).promise();
      return postId;
    } catch (err) {
      console.log("DynamoDB error: ", err);
      return null;
    }
  }

  return async (event: AppSyncEvent, context: aws.lambda.Context) => {
    //   console.log(event);
    const username = event.identity?.username;
    return await deletePost(event.arguments.postId, username);
  };
};
