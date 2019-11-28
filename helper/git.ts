import simplegit, { SimpleGit, StatusResult } from "simple-git/promise";
import { DefaultLogFields, ListLogSummary } from "simple-git/typings/response";
import { FileHelper, LogHelper, QuestionHelper } from "./";

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
    LogHelper.debug("Pushing changes origin master");
    await this.git.pull("origin", "master");
    await this.git.push("origin", "master");
  }

  public commitChanges = async (message?: string): Promise<void> => {
    LogHelper.debug("Committing changes");
    await this.git.pull("origin", "master");
    await this.git.add("./*");
    await this.git.commit(message ? message : "Did some changes");
  }

  public initRepo = async (gitUrl: string): Promise<void> => {
    const repoInitialized: boolean = await this.git.checkIsRepo();
    if (!repoInitialized) {
      LogHelper.debug("Initializing repo");
      await this.git.init();
      await this.git.addRemote("origin", gitUrl);
    }
  }

  public pullRepo = async (reset = false): Promise<void> => {
    try {
      if (reset) {
        LogHelper.debug("Resetting to origin/master");
        await this.git.reset(["--hard", "origin/master"]);
      }
      await this.git.pull("origin", "master");
      LogHelper.info("Pulled repo successfully");
    } catch (err) {

      let override = 255;

      if (err.message === "fatal: couldn't find remote ref master\n") {
        await this.fileHelper.initReadme();
        override = 1;
      } else {
        override = await QuestionHelper.chooseOverrideLocalChanges();
      }

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
            LogHelper.debug(status);
          } catch (err) {
            LogHelper.debug("Unable to fetch repo", err);
            throw new Error("Initialize repo failed");
          }
          break;
        case 2:
          // TODO helper?
          process.exit(0);
          break;

        default:
          throw new Error(`Unknown option ${override}`);
      }

      // Force fileHelper to load config file from disk
      this.fileHelper.invalidateCache();
    }
  }
}
