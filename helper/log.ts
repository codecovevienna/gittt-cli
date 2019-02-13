import chalk from "chalk";

export class LogHelper {
  public static DEBUG: boolean = true;

  public static debug = (msg: any): void => {
    if (LogHelper.DEBUG) {
      console.log(msg);
    }
  }

  public static log = (msg: any): void => {
    console.log(chalk.white.bold(msg));
  }

  public static warn = (msg: any): void => {
    console.log(chalk.yellow.bold(msg));
  }

  public static error = (msg: any): void => {
    console.log(chalk.red.bold(msg));
  }

  public static info = (msg: any): void => {
    console.log(chalk.green.bold(msg));
  }
}
