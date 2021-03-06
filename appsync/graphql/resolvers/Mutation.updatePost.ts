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

interface Params {
  TableName: string | undefined;
  Key: string | {};
  ExpressionAttributeValues: any;
  ExpressionAttributeNames: any;
  UpdateExpression: string;
  ReturnValues: string;
  ConditionExpression: string;
}

module.exports = () => {
  const AWS = require("aws-sdk");
  const docClient = new AWS.DynamoDB.DocumentClient();

  async function updatePost(post: any, username: string) {
    let params: Params = {
      TableName: process.env.POST_TABLE,
      Key: {
        id: post.id,
      },
      ConditionExpression: "#username = :authenticatedUser",
      ExpressionAttributeNames: { "#username": "username" },
      ExpressionAttributeValues: { ":authenticatedUser": username },
      UpdateExpression: "",
      ReturnValues: "ALL_NEW",
    };
    let prefix = "set ";
    let attributes = Object.keys(post);
    for (let i = 0; i < attributes.length; i++) {
      let attribute = attributes[i];
      if (attribute !== "id") {
        params["UpdateExpression"] +=
          prefix + "#" + attribute + " = :" + attribute;
        params["ExpressionAttributeValues"][":" + attribute] = post[attribute];
        params["ExpressionAttributeNames"]["#" + attribute] = attribute;
        prefix = ", ";
      }
    }
    try {
      await docClient.update(params).promise();
      return post;
    } catch (err) {
      console.log("DynamoDB error: ", err);
      return null;
    }
  }

  return async (event: AppSyncEvent, context: aws.lambda.Context) => {
    //   console.log(event);
    const username = event.identity?.username;
    return await updatePost(event.arguments.post, username);
  };
};
