import { LogHelper } from "../helper/index";

LogHelper.DEBUG = false;
LogHelper.silence = true;

export const emptyHelper: any = {
  // tslint:disable
  CharHelper: class { },
  FileHelper: class { },
  GitHelper: class { },
  ImportHelper: class { },
  ProjectHelper: class { },
  TimerHelper: class { },
  QuestionHelper: class { },
  LogHelper,
  // tslint:enable
};
