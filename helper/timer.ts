import inquirer from "inquirer";
import { ITimerFile } from "../interfaces";
import { FileHelper, LogHelper } from "./index";

export class TimerHelper {
  private fileHelper: FileHelper;
  constructor(fileHelper: FileHelper) {
    this.fileHelper = fileHelper;
  }

  public startTimer = async (): Promise<void> => {

    const timerNow: ITimerFile = {
      start: Date.now(),
      stop: 0
    };

    if (await !this.fileHelper.timerFileExists()) {

      // file does not exist just init with start time now

      await this.fileHelper.saveTimerObject(timerNow);

      LogHelper.info(`Started Timer: ${new Date(timerNow.start)}`);
    } else {

      // file exists check if timer is running

      if (await this.isTimerRunning()) {
        const timer = await this.fileHelper.getTimerObject();
        const diff = timerNow.start - timer.start;
        LogHelper.info(`Timer is already started since ${diff} seconds`);
      } else {
        await this.fileHelper.saveTimerObject(timerNow);
        LogHelper.info(`Started Timer: ${new Date(timerNow.start)}`);
      }
    }
  }

  public stopTimer = async (): Promise<void> => {

  }

  public killTimer = async (): Promise<void> => {

  }

  private isTimerRunning = async (): Promise<boolean> => {
    if (this.fileHelper.timerFileExists()) {
      const timer = await this.fileHelper.getTimerObject();
      console.log(timer.start, timer.stop)
      if (timer.start < timer.stop)
        return true;
      else
        return false;
    }
    return false;
  }

  // private readTimerFile = async(): Promise<

}