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

  async function listPosts() {
    const params = {
      TableName: process.env.POST_TABLE,
    };
    try {
      const data = await docClient.scan(params).promise();
      return data.Items;
    } catch (err) {
      console.log("DynamoDB error: ", err);
      return null;
    }
  }

  return async (event: AppSyncEvent, context: aws.lambda.Context) => {
    // console.log(event);
    return await listPosts();
  };
};
