import chalk from "chalk";

export class LogHelper {
  public static DEBUG: boolean = true;

  public static debug = (msg: any) => {
    if (LogHelper.DEBUG) {
      console.log(msg);
    }
  }

  public static log = (msg: any) => {
    console.log(chalk.white.bold(msg));
  }

  public static warn = (msg: any) => {
    console.log(chalk.yellow.bold(msg));
  }

  public static error = (msg: any) => {
    console.log(chalk.red.bold(msg));
  }

  public static info = (msg: any) => {
    console.log(chalk.green.bold(msg));
  }
}
