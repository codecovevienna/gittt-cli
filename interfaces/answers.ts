export interface IInitAnswers {
  setup: boolean;
}

export interface IOverrideAnswers {
  override: number;
}

export interface IGitRepoAnswers {
  gitRepo: string;
}

export interface IGitCommitMessageAnswers {
  gitCommitMessage: string;
}

export interface IInitProjectAnswers {
  confirm: boolean;
}

export interface IIntegrationAnswers {
  integration: string;
}

export interface IJiraIntegrationAnswers {
  endpoint: string;
  username: string;
  password: string;
  key: string;
}
