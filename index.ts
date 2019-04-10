import { assert } from "chai";
import commander, { CommanderStatic } from "commander";
import inquirer from "inquirer";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import { FileHelper, GitHelper, LogHelper, ProjectHelper, TimerHelper } from "./helper";
import { IConfigFile, IGitRepoAnswers, IInitAnswers, IInitProjectAnswers, IProject } from "./interfaces";

// tslint:disable-next-line no-var-requires
const packageJson: any = require("./package.json");
const APP_NAME: string = packageJson.name;
const APP_VERSION: string = packageJson.version;

(async (): Promise<void> => {
  function exit(msg: string, code: number): void {
    if (code === 0) {
      LogHelper.warn(msg);
    } else {
      LogHelper.error(msg);
    }
    process.exit(code);
  }

  function getHomeDir(): string {
    const home: string | null = require("os").homedir()
      || process.env.HOME
      || process.env.HOMEPATH
      || process.env.USERPROFIL;

    if (!home) {
      throw new Error("Unable to determinate home directory");
    }

    return home;
  }

  async function isConfigFileValid(): Promise<boolean> {
    let config: IConfigFile | undefined;

    try {
      config = await fileHelper.getConfigObject(true);

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

  async function askGitUrl(): Promise<string> {
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

  async function init(): Promise<void> {
    if (!(await fileHelper.configDirExists())) {
      fileHelper.createConfigDir();
      gitHelper = new GitHelper(configDir, fileHelper);

      if (!(await isConfigFileValid())) {
        const gitUrl: string = await askGitUrl();
        LogHelper.info("Initializing local repo");
        await gitHelper.initRepo(gitUrl);
        // TODO remove reset=true?
        LogHelper.info("Pulling repo...");
        await gitHelper.pullRepo();

        // Check if a valid config file is already in the repo
        if (!(await isConfigFileValid())) {
          LogHelper.info("Initializing gittt config file");
          await fileHelper.initConfigFile(gitUrl);
          LogHelper.info("Committing created config file");
          await gitHelper.commitChanges("Initialized config file");
          LogHelper.info("Pushing changes to remote repo");
          await gitHelper.pushChanges();
        }
      } else {
        await gitHelper.pullRepo();
      }

    } else {
      if (await isConfigFileValid()) {
        gitHelper = new GitHelper(configDir, fileHelper);
        await gitHelper.pullRepo();
        LogHelper.info(`Config directory ${configDir} already initialized`);
      } else {
        LogHelper.warn(`Config file exists, but is invalid`);
        exit("Invalid config file", 1);
        // TODO reinitialize?
      }
    }
  }

  function initCommander(): CommanderStatic {
    commander
      .version(APP_VERSION);

    commander
      .command("commit <hours>")
      .description("Adding hours to the project")
      .option("-m, --message <message>", "Description of the spent hours")
      .action(async (cmd: string, options: any): Promise<void> => {
        const hours: number = parseFloat(cmd);
        if (isNaN(hours)) {
          exit("Unable to parse hours", 1);
        }

        await projectHelper.addRecordToProject({
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
        await gitHelper.pushChanges();
        LogHelper.info("Done");
      });

    commander
      .command("list")
      .description("Listing all projects")
      .action(async () => {
        const projects: IProject[] = await fileHelper.findAllProjects();

        LogHelper.info("Projects:");
        for (const prj of projects) {
          console.log(`- ${prj.name}`);
        }
      });

    commander
      .command("log")
      .description("List of local changes")
      .action(async () => {
        const logs: ReadonlyArray<DefaultLogFields> = await gitHelper.logChanges();
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
        const projects: IProject[] = await fileHelper.findAllProjects();
        let totalHours: number = 0;

        LogHelper.info("Projects:");
        for (const pL of projects) {
          const hours: number = await projectHelper.getTotalHours(pL.name);
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
        await init();
      });

    commander
      .command("start")
      .description("Start the timer")
      .action(async () => {
        await timerHelper.startTimer();
      });

    commander
      .command("stop")
      .description("Stop the timer and commit to a project")
      .option("-k, --kill", "Kill the timer for a project")
      .action(async (cmd: any): Promise<void> => {
        if (cmd.kill) {
          await timerHelper.killTimer();
        } else {
          await timerHelper.stopTimer();
        }
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
          await projectHelper.initProject();
        }
      });

    return commander;
  }

  const homeDir = getHomeDir();
  const configDir = path.join(homeDir, `.${APP_NAME}`);
  const fileHelper: FileHelper = new FileHelper(configDir, "config.json", "timer.json", "projects");
  let gitHelper: GitHelper;
  const timerHelper: TimerHelper = new TimerHelper(fileHelper);

  if (!(await fileHelper.configDirExists()) || !isConfigFileValid()) {
    const initAnswers: IInitAnswers = await inquirer.prompt([
      {
        message: `Looks like you never used ${APP_NAME}, should it be set up?`,
        name: "setup",
        type: "confirm",
      },
    ]) as IInitAnswers;

    if (initAnswers.setup) {
      await init();
      LogHelper.info("Initialized git-time-tracker (GITTT) you are good to go now ;)\n\n");
    } else {
      exit(`${APP_NAME} does not work without setup, bye!`, 0);
    }
  }

  gitHelper = new GitHelper(configDir, fileHelper);
  const projectHelper: ProjectHelper = new ProjectHelper(gitHelper, fileHelper);

  initCommander();

  if (process.argv.length === 2) {
    commander.help();
  } else {
    commander.parse(process.argv);
  }
})();
