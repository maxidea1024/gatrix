export interface GithubFormState {
  appId: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  privateKey: string;
}

export interface GitlabFormState {
  instanceUrl: string;
  applicationId: string;
  applicationSecret: string;
  webhookSecret: string;
}

export interface BitbucketFormState {
  workspace: string;
  username: string;
  appPassword: string;
}

export interface SlackFormState {
  botToken: string;
  signingSecret: string;
}
