import inquirer from "inquirer";
import simplegit, { SimpleGit, StatusResult } from "simple-git/promise";
import { DefaultLogFields, ListLogSummary } from "simple-git/typings/response";
import { IOverrideAnswers } from "../interfaces";
import { FileHelper, LogHelper } from "./index";

export class GitHelper {
  private git: SimpleGit;
  private fileHelper: FileHelper;
  constructor(configDir: string, fileHelper: FileHelper) {
     this.git = simplegit(configDir);
     this.fileHelper = fileHelper;
  }

  public logChanges = async (): Promise<ReadonlyArray<DefaultLogFields>> => {
    const listLogSummery: ListLogSummary = await this.git.log({
      from: "HEAD",
      to: "origin/master",
    });

    return listLogSummery.all;
  }

  public pushChanges = async (): Promise<void> => {
    await this.git.pull("origin", "master");
    await this.git.push("origin", "master");
  }

  public commitChanges = async (message?: string): Promise<void> => {
    await this.git.pull("origin", "master");
    await this.git.add("./*");
    await this.git.commit(message ? message : "Did some changes");
  }

  public initRepo = async (gitUrl: string): Promise<void> => {
    const repoInitialized = await this.git.checkIsRepo();
    if (!repoInitialized) {
      LogHelper.debug("Initializing repo");
      await this.git.init();
      await this.git.addRemote("origin", gitUrl);
    }
  }

  public pullRepo = async (reset: boolean = false): Promise<void> => {
    try {
      if (reset) {
        LogHelper.debug("Resetting to origin/master");
        await this.git.reset(["--hard", "origin/master"]);
      }
      console.log(this.git)
      await this.git.pull("origin", "master");
      LogHelper.info("Pulled repo successfully");
    } catch (err) {
      const overrideLocalAnswers: IOverrideAnswers = await inquirer.prompt([
        {
          choices: [
            {name: "Override local config file", value: 0},
            {name: "Override remote config file", value: 1},
            {name: "Exit", value: 2},
          ],
          message: `Remote repo is not empty, override local changes?`,
          name: "override",
          type: "list",
        },
      ]) as IOverrideAnswers;

      const { override } = overrideLocalAnswers;

      switch (override) {
        case 0:
          await this.git.reset(["--hard", "origin/master"]);
          await this.git.pull("origin", "master");
          break;
        case 1:
          try {
            await this.git.add("./*");
            LogHelper.info("Added initial config file");
            await this.git.commit("Setup commit");
            LogHelper.info("Committed initial config file");
            await this.git.raw(["push", "origin", "master", "--force"]);
            LogHelper.info("Pushed to repo");
            const status: StatusResult = await this.git.status();
            console.log(status);
          } catch (err) {
            LogHelper.warn("Unable to fetch repo");
          }
          break;
        case 2:
        // TODO helper?
          // exit("Bye!", 0);
          break;

        default:
          break;
      }

      // Force fileHelper to load config file from disk
      this.fileHelper.invalidateCache();
    }
  }
}
