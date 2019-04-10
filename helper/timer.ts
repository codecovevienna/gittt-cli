import inquirer from "inquirer";
import { IGitCommitMessageAnswers } from "../interfaces";
import { FileHelper, LogHelper } from "./index";
import { ProjectHelper } from "./project";
import { isString } from "util";

export class TimerHelper {
  private fileHelper: FileHelper;
  private projectHelper : ProjectHelper;

  constructor(fileHelper: FileHelper, projectHelper: ProjectHelper) {
    this.fileHelper = fileHelper;
    this.projectHelper = projectHelper;
  }

  public startTimer = async (): Promise<void> => {

    const now = Date.now();

    if (await !this.fileHelper.timerFileExists()) {

      // file does not exist just init with start time now

      await this.fileHelper.saveTimerObject({
        start: now,
        stop: 0
      });

      LogHelper.info(`Started Timer: ${new Date(now)}`);
    } else {

      // file exists check if timer is running

      if (await this.isTimerRunning(now)) {
        const timer = await this.fileHelper.getTimerObject();
        const diff = now - timer.start;
        LogHelper.info(`Timer is already started since ${diff} seconds`);
      } else {
        await this.fileHelper.saveTimerObject({
          start: now,
          stop: 0
        });
        LogHelper.info(`Started Timer: ${new Date(now)}`);
      }
    }
  }

  public stopTimer = async (gitCommitMessage: string): Promise<void> => {
    const now = Date.now();
    if (await this.isTimerRunning(now)) {
      const timer = await this.fileHelper.getTimerObject();
      const diff = now - timer.start;

      if(!isString(gitCommitMessage)){
        //ask for message
        gitCommitMessage = await this.askGitCommitMessage();
      }

      await this.projectHelper.addRecordToProject({
        amount: this.hh(diff),
        created: now,
        message: gitCommitMessage,
        type: "Time",
      });

      timer.stop = now;
      await this.fileHelper.saveTimerObject(timer);

      //TODO change representation of time in hh:mm:ss
      LogHelper.info(`Timer stopped and work time is ${this.hhmmss(diff)}`)
    } else {
      LogHelper.info("No timer was started previously");
    }
  }

  public killTimer = async (): Promise<void> => {
    const now = Date.now();
    if (await this.isTimerRunning(now)){
      this.fileHelper.initTimerFile();
      LogHelper.warn("Timer was killed");
    } else {
      LogHelper.info("No timer was started previously");
    }
  }

  private isTimerRunning = async (now: number): Promise<boolean> => {
    if (this.fileHelper.timerFileExists()) {
      const timer = await this.fileHelper.getTimerObject();
      if ((timer.start > 0 && timer.start < now && timer.stop === 0))
        return true;
      else
        return false;
    }
    return false;
  }

  private hhmmss = (msec_num: number): String => {

    const sec_num = msec_num / 1000;

    const hours: number = Math.floor(sec_num / 3600);
    const minutes: number = Math.floor((sec_num - (hours * 3600)) / 60);
    const seconds: number = sec_num - (hours * 3600) - (minutes * 60);

    let str_hours: String = "" + hours;
    let str_minutes: String = "" + minutes;
    let str_seconds: String = "" + seconds;

    if (hours < 10) { str_hours = "0" + hours; }
    if (minutes < 10) { str_minutes = "0" + minutes; }
    if (seconds < 10) { str_seconds = "0" + seconds; }

    return str_hours + ':' + str_minutes + ':' + str_seconds;
  }

  private hh = (msec_num: number): number => {
    return msec_num / 360000;
  }

  private askGitCommitMessage = async () : Promise<string> => {
    const gitCommitMessageAnswer: IGitCommitMessageAnswers = await inquirer.prompt([
      {
        message: "Git Commit Message:",
        name: "gitCommitMessage",
        type: "input",
      },
    ]);

    return gitCommitMessageAnswer.gitCommitMessage;
  }

  // private readTimerFile = async(): Promise<

}