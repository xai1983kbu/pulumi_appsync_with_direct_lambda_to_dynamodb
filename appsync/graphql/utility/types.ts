export type AppSyncEvent = {
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

export type Post = {
    id: string;
    title: string;
    content: string;
    username: string;
  };
