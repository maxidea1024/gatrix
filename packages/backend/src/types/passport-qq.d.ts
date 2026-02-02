declare module "passport-qq" {
  import { Strategy as PassportStrategy } from "passport-strategy";

  export interface Profile {
    id: string;
    nickname: string;
    figureurl_qq_1?: string;
    gender?: string;
    [key: string]: any;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
  }

  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any) => void,
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    authenticate(req: any, options?: any): any;
  }
}
