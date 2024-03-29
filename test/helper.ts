import { LogHelper, toFixedLength } from "../helper/index";

LogHelper.DEBUG = false;
LogHelper.silence = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const emptyHelper: any = {
  ConfigHelper: class { },
  FileHelper: class { },
  ExportHelper: class { },
  GitHelper: class { },
  ImportHelper: class { },
  ProjectHelper: class { },
  TimerHelper: class { },
  QuestionHelper: class { },
  ChartHelper: class { },
  AuthHelper: class { },
  MultipieHelper: class { },
  LogHelper,
  toFixedLength,
};
