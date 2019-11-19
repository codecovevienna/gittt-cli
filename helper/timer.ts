import inquirer from "inquirer";
import _ from "lodash";
import moment, { Moment } from "moment";
import { FileHelper, LogHelper, ProjectHelper } from ".";
import { IGitCommitMessageAnswers, ITimerFile } from "../interfaces";

export class TimerHelper {
  private fileHelper: FileHelper;
  private projectHelper: ProjectHelper;

  constructor(fileHelper: FileHelper, projectHelper: ProjectHelper) {
    this.fileHelper = fileHelper;
    this.projectHelper = projectHelper;
  }

  public startTimer = async (): Promise<void> => {

    const now: Moment = moment();

    if (!this.fileHelper.timerFileExists()) {

      // file does not exist just init with start time now
      await this.fileHelper.saveTimerObject({
        start: now.valueOf(),
        stop: 0,
      });

      LogHelper.info(`Started Timer: ${moment(now).format("DD.MM.YYYY HH:mm:ss")}`);
    } else {

      // file exists check if timer is running
      if (await this.isTimerRunning(now)) {
        const timer: ITimerFile = await this.fileHelper.getTimerObject();
        LogHelper.info(`Timer is already started ${moment(timer.start).from(now)}`);
      } else {
        await this.fileHelper.saveTimerObject({
          start: now.valueOf(),
          stop: 0,
        });
        LogHelper.info(`Started Timer: ${moment(now).format("DD.MM.YYYY HH:mm:ss")}`);
      }
    }
  }

  public stopTimer = async (gitCommitMessage?: string): Promise<void> => {
    const now: Moment = moment();
    if (await this.isTimerRunning(now)) {
      const timer: ITimerFile = await this.fileHelper.getTimerObject();
      const diff: number = now.diff(timer.start);
      let finalCommitMessage: string | undefined = gitCommitMessage;

      if (!finalCommitMessage) {
        // ask for message
        const gitCommitMessageAnswer: IGitCommitMessageAnswers = await inquirer.prompt([
          {
            message: "Git Commit Message:",
            name: "gitCommitMessage",
            type: "input",
          },
        ]);
        finalCommitMessage = gitCommitMessageAnswer.gitCommitMessage;
      }

      await this.projectHelper.addRecordToProject({
        amount: moment.duration(diff).asHours(),
        end: now.valueOf(),
        message: _.isEmpty(finalCommitMessage) ? undefined : finalCommitMessage,
        type: "Time",
      });

      timer.stop = now.valueOf();
      await this.fileHelper.saveTimerObject(timer);

      LogHelper.info(`Timer stopped and work time is ${moment.utc(moment
        .duration(diff)
        .asMilliseconds(),
      ).format("HH:mm:ss.SSS")}`);
    } else {
      LogHelper.info("No timer was started previously");
    }
  }

  public killTimer = async (): Promise<void> => {
    if (await this.isTimerRunning(moment())) {
      this.fileHelper.initTimerFile();
      LogHelper.warn("Timer was killed");
    } else {
      LogHelper.info("No timer was started previously");
    }
  }

  public isTimerRunning = async (now: Moment): Promise<boolean> => {
    if (this.fileHelper.timerFileExists()) {
      const timer: ITimerFile = await this.fileHelper.getTimerObject();
      return timer.start > 0 && timer.start < now.valueOf() && timer.stop === 0;
    }
    return false;
  }
}
