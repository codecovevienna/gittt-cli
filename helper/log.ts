import chalk from "chalk";

export class LogHelper {
  public static DEBUG: boolean = true;
  public static silence: boolean = false;

  public static debug = (msg: any, err?: Error): void => {
    if (LogHelper.DEBUG && !LogHelper.silence) {
      if (err) {
        console.log(msg, err);
      } else {
        console.log(msg);
      }
    }
  }

  public static log = (msg: any): void => {
    if (!LogHelper.silence) {
      console.log(chalk.white.bold(msg));
    }
  }

  public static warn = (msg: any): void => {
    if (!LogHelper.silence) {
      console.log(chalk.yellow.bold(msg));
    }
  }

  public static error = (msg: any): void => {
    if (!LogHelper.silence) {
      console.log(chalk.red.bold(msg));
    }
  }

  public static info = (msg: any): void => {
    if (!LogHelper.silence) {
      console.log(chalk.green.bold(msg));
    }
  }
}
