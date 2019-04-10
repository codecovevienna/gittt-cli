import { assert } from "chai";
import commander, { CommanderStatic } from "commander";
import inquirer from "inquirer";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import { FileHelper, GitHelper, LogHelper, ProjectHelper } from "./helper";
import { IConfigFile, IGitRepoAnswers, IInitAnswers, IInitProjectAnswers, IProject } from "./interfaces";

// tslint:disable-next-line no-var-requires
const packageJson: any = require("./package.json");
const APP_NAME: string = packageJson.name;
const APP_VERSION: string = packageJson.version;

export default class App {
  private homeDir: string;
  private configDir: string;
  private fileHelper: FileHelper;
  private gitHelper: GitHelper;
  private projectHelper: ProjectHelper;

  start(): void {
    if (process.argv.length === 2) {
      commander.help();
    } else {
      commander.parse(process.argv);
    }
  }

  exit(msg: string, code: number): void {
    if (code === 0) {
      LogHelper.warn(msg);
    } else {
      LogHelper.error(msg);
    }
    process.exit(code);
  }

  getHomeDir(): string {
    const home: string | null = require("os").homedir()
      || process.env.HOME
      || process.env.HOMEPATH
      || process.env.USERPROFIL;

    if (!home) {
      throw new Error("Unable to determinate home directory");
    }

    return home;
  }

  async setup() {
    this.homeDir = this.getHomeDir();
    this.configDir = path.join(this.homeDir, `.${APP_NAME}`);
    this.fileHelper = new FileHelper(this.configDir, "config.json", "projects");

    if (!(await this.fileHelper.configDirExists()) || !this.isConfigFileValid()) {
      const initAnswers: IInitAnswers = await inquirer.prompt([
        {
          message: `Looks like you never used ${APP_NAME}, should it be set up?`,
          name: "setup",
          type: "confirm",
        },
      ]) as IInitAnswers;

      if (initAnswers.setup) {
        await this.initConfigDir();
        LogHelper.info("Initialized git-time-tracker (GITTT) you are good to go now ;)\n\n");
      } else {
        this.exit(`${APP_NAME} does not work without setup, bye!`, 0);
      }
    }

    this.gitHelper = new GitHelper(this.configDir, this.fileHelper);
    this.projectHelper = new ProjectHelper(this.gitHelper, this.fileHelper);

    this.initCommander();
  }

  async initConfigDir(): Promise<void> {
    if (!(await this.fileHelper.configDirExists())) {
      this.fileHelper.createConfigDir();
      this.gitHelper = new GitHelper(this.configDir, this.fileHelper);

      if (!(await this.isConfigFileValid())) {
        const gitUrl: string = await this.askGitUrl();
        LogHelper.info("Initializing local repo");
        await this.gitHelper.initRepo(gitUrl);
        // TODO remove reset=true?
        LogHelper.info("Pulling repo...");
        await this.gitHelper.pullRepo();

        // Check if a valid config file is already in the repo
        if (!(await this.isConfigFileValid())) {
          LogHelper.info("Initializing gittt config file");
          await this.fileHelper.initConfigFile(gitUrl);
          LogHelper.info("Committing created config file");
          await this.gitHelper.commitChanges("Initialized config file");
          LogHelper.info("Pushing changes to remote repo");
          await this.gitHelper.pushChanges();
        }
      } else {
        await this.gitHelper.pullRepo();
      }

    } else {
      if (await this.isConfigFileValid()) {
        this.gitHelper = new GitHelper(this.configDir, this.fileHelper);
        await this.gitHelper.pullRepo();
        LogHelper.info(`Config directory ${this.configDir} already initialized`);
      } else {
        LogHelper.warn(`Config file exists, but is invalid`);
        this.exit("Invalid config file", 1);
        // TODO reinitialize?
      }
    }
  }

  initCommander(): CommanderStatic {
    commander
      .version(APP_VERSION);

    commander
      .command("commit <hours>")
      .description("Adding hours to the project")
      .option("-m, --message <message>", "Description of the spent hours")
      .action(async (cmd: string, options: any): Promise<void> => {
        const hours: number = parseFloat(cmd);
        if (isNaN(hours)) {
          this.exit("Unable to parse hours", 1);
        }

        await this.projectHelper.addRecordToProject({
          amount: hours,
          created: Date.now(),
          message: options.message,
          type: "Time",
        });
      });

    commander
      .command("push")
      .description("Pushing changes to repository")
      .action(async () => {
        LogHelper.info("Pushing changes...");
        await this.gitHelper.pushChanges();
        LogHelper.info("Done");
      });

    commander
      .command("list")
      .description("Listing all projects")
      .action(async () => {
        const projects: IProject[] = await this.fileHelper.findAllProjects();

        LogHelper.info("Projects:");
        for (const prj of projects) {
          console.log(`- ${prj.name}`);
        }
      });

    commander
      .command("log")
      .description("List of local changes")
      .action(async () => {
        const logs: ReadonlyArray<DefaultLogFields> = await this.gitHelper.logChanges();
        if (logs.length > 0) {
          LogHelper.warn("Local changes:");
          for (const log of logs) {
            console.log(`${log.date}\n  ${log.message.trim()}`);
          }
        } else {
          LogHelper.info("Everything is up to date");
        }
      });

    commander
      .command("status")
      .description("Overview of all projects")
      .action(async () => {
        const projects: IProject[] = await this.fileHelper.findAllProjects();
        let totalHours: number = 0;

        LogHelper.info("Projects:");
        for (const pL of projects) {
          const hours: number = await this.projectHelper.getTotalHours(pL.name);
          LogHelper.info(`${pL.name}:\t${hours}`);
          totalHours += hours;
        }
        LogHelper.info("");

        LogHelper.info("Summery:");
        LogHelper.info(`Total projects:\t${projects.length}`);
        LogHelper.info(`Total hours:\t${totalHours}`);
      });

    commander
      .command("setup")
      .description("Initializes config directory")
      .action(async () => {
        await this.initConfigDir();
      });

    commander
      .command("init")
      .description("Initializes the project in current git directory")
      .action(async () => {
        const initProjectAnswers: IInitProjectAnswers = await inquirer.prompt([
          {
            message: "This will reset the project if it is already initialized, are you sure?",
            name: "confirm",
            type: "confirm",
          },
        ]);

        if (initProjectAnswers.confirm) {
          await this.projectHelper.initProject();
        }
      });

    return commander;
  }

  async isConfigFileValid(): Promise<boolean> {
    let config: IConfigFile | undefined;

    try {
      config = await this.fileHelper.getConfigObject(true);

      // TODO use some kind of generic interface-json-schema-validator
      assert.isDefined(config.created, "created has to be defined");
      assert.isDefined(config.gitRepo, "gitRepo has to be defined");
    } catch (err) {
      LogHelper.debug(`Unable to parse config file: ${err.message}`);
      return false;
    }

    try {
      ProjectHelper.parseProjectNameFromGitUrl(config.gitRepo);
      return true;
    } catch (err) {
      LogHelper.debug("Unable to get project name", err);
      return false;
    }
  }

  async askGitUrl(): Promise<string> {
    const gitRepoAnswers: IGitRepoAnswers = await inquirer.prompt([
      {
        message: "Git Repository URL:",
        name: "gitRepo",
        type: "input",
        validate(input: any): boolean | string | Promise<boolean | string> {
          try {
            // Will throw if parsing fails
            ProjectHelper.parseProjectNameFromGitUrl(input);
            return true;
          } catch (err) {
            return "The url has to look like ssh://git@github.com:eiabea/awesomeProject.git";
          }
        },
      },
    ]);

    return gitRepoAnswers.gitRepo;
  }
}