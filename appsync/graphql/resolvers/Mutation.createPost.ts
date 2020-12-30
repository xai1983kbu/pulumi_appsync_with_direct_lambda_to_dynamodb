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

  async function createPost(post: Post) {
    const params = {
      TableName: process.env.POST_TABLE,
      Item: post,
    };
    try {
      await docClient.put(params).promise();
      return post;
    } catch (err) {
      console.log("DynamoDB error: ", err);
      return null;
    }
  }

  return async (event: AppSyncEvent, context: aws.lambda.Context) => {
    //   console.log(event);
    const username = event.identity?.username;
    return await createPost({ ...event.arguments.post, username });
  };
};
