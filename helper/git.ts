import simplegit, { SimpleGit, StatusResult } from "simple-git/promise";
import { LogResult } from "simple-git/typings/response";
import { DefaultLogFields } from "simple-git/src/lib/tasks/log";
import { FileHelper, LogHelper, QuestionHelper } from "./";
import shelljs, { ExecOutputReturnValue } from "shelljs";

export class GitHelper {
  private git: SimpleGit;
  private fileHelper: FileHelper;
  constructor(configDir: string, fileHelper: FileHelper) {
    this.git = simplegit(configDir);
    this.fileHelper = fileHelper;
  }

  public logChanges = async (): Promise<ReadonlyArray<DefaultLogFields>> => {
    const listLogSummery: LogResult = await this.git.log({
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
    } catch (err: any) {

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
          } catch (err: any) {
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
  /**
   * Gets the current branch of the git repo the app is currently in, NOT the branch of the main repo in ~/.gittt-cli
   * 
   * @returns Promise with either a string with the branch or undefined
   */
  public getCurrentBranch = async (): Promise<string | undefined> => {
    try {
      LogHelper.debug("Getting current branch");
      // this.git is configured to look into ~/.gittt-cli, so we execute a shell command in the current directory instead
      const gitBranchExec: ExecOutputReturnValue = shelljs.exec("git branch --show-current", {
        silent: true,
      }) as ExecOutputReturnValue;

      if (gitBranchExec.code !== 0) {
        if (gitBranchExec.code === 128) {
          LogHelper.debug(`"git branch --show-current" returned with exit code 128`);
          return undefined;
        }
        LogHelper.debug("Error executing git branch --show-current", new Error(gitBranchExec.stderr));
        return undefined;
      }
      return gitBranchExec.stdout;
    } catch (err: any) {
      LogHelper.debug("Unable to get current branch", err);
      LogHelper.error("Unable to get current branch");
      return undefined;
    }
  }
}
