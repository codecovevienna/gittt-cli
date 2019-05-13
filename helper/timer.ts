import inquirer from "inquirer";
import { isString } from "util";
import moment from "moment";
import { IGitCommitMessageAnswers, ITimerFile } from "../interfaces";
import { FileHelper, LogHelper } from "./index";
import { ProjectHelper } from "./project";

export class TimerHelper {
  private fileHelper: FileHelper;
  private projectHelper: ProjectHelper;

  constructor(fileHelper: FileHelper, projectHelper: ProjectHelper) {
    this.fileHelper = fileHelper;
    this.projectHelper = projectHelper;
  }

  public startTimer = async (): Promise<void> => {

    const now: number = Date.now();

    if (!this.fileHelper.timerFileExists()) {

      // file does not exist just init with start time now

      await this.fileHelper.saveTimerObject({
        start: now,
        stop: 0,
      });

      LogHelper.info(`Started Timer: ${new Date(now)}`);
    } else {

      // file exists check if timer is running

      if (await this.isTimerRunning(now)) {
        const timer: ITimerFile = await this.fileHelper.getTimerObject();
        const diff: number = now - timer.start;
        LogHelper.info(`Timer is already started since ${diff} seconds`);
      } else {
        await this.fileHelper.saveTimerObject({
          start: now,
          stop: 0,
        });
        LogHelper.info(`Started Timer: ${new Date(now)}`);
      }
    }
  }

  public stopTimer = async (gitCommitMessage?: string): Promise<void> => {
    const now: number = Date.now();
    if (await this.isTimerRunning(now)) {
      const timer: ITimerFile = await this.fileHelper.getTimerObject();
      const diff: number = now - timer.start;

      if (!isString(gitCommitMessage)) {
        // ask for message
        const gitCommitMessageAnswer: IGitCommitMessageAnswers = await inquirer.prompt([
          {
            message: "Git Commit Message:",
            name: "gitCommitMessage",
            type: "input",
          },
        ]);
        gitCommitMessage = gitCommitMessageAnswer.gitCommitMessage;
      }

      await this.projectHelper.addRecordToProject({
        amount: this.hh(diff),
        created: now,
        message: gitCommitMessage,
        type: "Time",
      });

      timer.stop = now;
      await this.fileHelper.saveTimerObject(timer);

      // TODO change representation of time in hh:mm:ss
      LogHelper.info(`Timer stopped and work time is ${this.parseMs(diff)}`);
    } else {
      LogHelper.info("No timer was started previously");
    }
  }

  public killTimer = async (): Promise<void> => {
    const now: number = Date.now();
    if (await this.isTimerRunning(now)) {
      this.fileHelper.initTimerFile();
      LogHelper.warn("Timer was killed");
    } else {
      LogHelper.info("No timer was started previously");
    }
  }

  public isTimerRunning = async (now: number): Promise<boolean> => {
    if (this.fileHelper.timerFileExists()) {
      const timer: ITimerFile = await this.fileHelper.getTimerObject();
      if ((timer.start > 0 && timer.start < now && timer.stop === 0)) {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  // TODO use moment.js?
  private parseMs = (msec: number): string => {

    const sec: number = msec / 1000;

    const hours: number = Math.floor(sec / 3600);
    const minutes: number = Math.floor((sec - (hours * 3600)) / 60);
    const seconds: number = sec - (hours * 3600) - (minutes * 60);

    let strHours: string = "" + hours;
    let strMinutes: string = "" + minutes;
    let strSeconds: string = "" + seconds;

    if (hours < 10) { strHours = "0" + hours; }
    if (minutes < 10) { strMinutes = "0" + minutes; }
    if (seconds < 10) { strSeconds = "0" + seconds; }

    return strHours + ":" + strMinutes + ":" + strSeconds;
  }

  private hh = (msec: number): number => {
    return msec / 360000;
  }

}
