declare module "connect-redis" {
  import { Store } from "express-session";
  import { RedisClientType } from "redis";

  interface RedisStoreOptions {
    client: RedisClientType;
    prefix?: string;
    ttl?: number;
    disableTTL?: boolean;
    disableTouch?: boolean;
    serializer?: {
      stringify: (obj: any) => string;
      parse: (str: string) => any;
    };
  }

  class RedisStore extends Store {
    constructor(options: RedisStoreOptions);
  }

  function ConnectRedis(session: any): typeof RedisStore;

  export = ConnectRedis;
}
