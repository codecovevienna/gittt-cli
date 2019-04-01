import { assert } from "chai";
import commander, { CommanderStatic } from "commander";
import inquirer from "inquirer";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import { FileHelper, GitHelper, LogHelper, ProjectHelper } from "./helper";
import { IConfigFile, IGitRepoAnswers, IInitAnswers } from "./interfaces";

// tslint:disable-next-line no-var-requires
const packageJson = require("./package.json");
const APP_NAME = packageJson.name;
const APP_VERSION = packageJson.version;

(async (): Promise<void> => {
  const exit = (msg: string, code: number): void => {
    if (code === 0) {
      LogHelper.warn(msg);
    } else {
      LogHelper.error(msg);
    }
    process.exit(code);
  };

  const getHomeDir = (): string => {
    const home = require("os").homedir()
      || process.env.HOME
      || process.env.HOMEPATH
      || process.env.USERPROFIL;

    if (!home) {
      throw new Error("Unable to determinate home directory");
    }

    return home;
  };

  const isConfigFileValid = (): boolean => {
    if (!(fileHelper.configFileExists())) {
      LogHelper.debug("Config file does not exist");
      return false;
    }

    let config: IConfigFile;

    try {
      config = fileHelper.getConfigObject(true);

      // TODO use some kind of generic interface-json-schema-validator
      assert.isDefined(config.created, "created has to be defined");
      assert.isDefined(config.gitRepo, "gitRepo has to be defined");
      assert.isDefined(config.projects, "projects has to be defined");
      assert.isArray(config.projects, "projects has to be an array");
    } catch (err) {
      LogHelper.debug(`Unable to parse config file: ${err.message}`);
      return false;
    }

    const projectName = ProjectHelper.parseProjectNameFromGitUrl(config.gitRepo);

    if (projectName) {
      return true;
    } else {
      LogHelper.debug("Project name is undefined");
      return false;
    }

  };

  const askGitUrl = async (): Promise<string> => {
    const gitRepoAnswers = await inquirer.prompt([
      {
        message: "Git Repository URL:",
        name: "gitRepo",
        type: "input",
        validate(input) {
          const projectName = ProjectHelper.parseProjectNameFromGitUrl(input);

          const valid = (input.length > 0 && !!projectName);

          if (valid) {
            return true;
          } else {
            return "The url has to look like ssh://git@github.com:eiabea/awesomeProject.git";
          }
        },
      },
    ]) as IGitRepoAnswers;

    return gitRepoAnswers.gitRepo;
  };

  const init = async (): Promise<void> => {
    if (!(fileHelper.configFileExists())) {
      LogHelper.info(`Initializing config directory ${configDir}`);
      try {
        fileHelper.createConfigDir();
        LogHelper.info("Created config directory");
      } catch (err) {
        LogHelper.error("Error creating config directory");
        exit(err.message, 1);
      }

      gitHelper = new GitHelper(configDir, fileHelper);

      if (!isConfigFileValid()) {
        const gitUrl = await askGitUrl();
        await gitHelper.initRepo(gitUrl);
        // TODO remove reset=true?
        await gitHelper.pullRepo();

        // Check if a valid config file is already in the repo
        if (!isConfigFileValid()) {
          await fileHelper.initConfigFile(gitUrl);
          await gitHelper.commitChanges("Initialized config file");
          await gitHelper.pushChanges();
        }
      } else {
        await gitHelper.pullRepo();
      }

    } else {
      if (isConfigFileValid()) {
        gitHelper = new GitHelper(configDir, fileHelper);
        await gitHelper.pullRepo();
        LogHelper.info(`Config directory ${configDir} already initialized`);
      } else {
        LogHelper.warn(`Config file exists, but is invalid`);
        exit("Invalid config file", 1);
        // TODO reinitialize?
      }
    }
  };

  const initCommander = (): CommanderStatic => {
    commander
      .version(APP_VERSION);

    commander
      .command("commit <hours>")
      .description("Adding hours to the project")
      .option("-m, --message <message>", "Description of the spent hours")
      .action(async (cmd: string, options: any): Promise<void> => {
        const hours = parseFloat(cmd);
        if (isNaN(hours)) {
          exit("Unable to parse hours", 1);
        }

        await projectHelper.addHoursToProject(await projectHelper.getProjectName(), {
          count: hours,
          created: Date.now(),
          message: options.message,
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
        const projects = await projectHelper.getProjectList();

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
        const projects = await projectHelper.getProjectList();
        let totalHours = 0;

        LogHelper.info("Projects:");
        for (const pL of projects) {
          const hours = await projectHelper.getTotalHours(pL.name);
          LogHelper.info(`${pL.name}:\t${hours}`);
          totalHours += hours;
        }
        LogHelper.info("");

        LogHelper.info("Summery:");
        LogHelper.info(`Total projects:\t${projects.length}`);
        LogHelper.info(`Total hours:\t${totalHours}`);
      });

    commander
      .command("init")
      .description("Initializes config directory")
      .action(async () => {
        await init();
      });

    return commander;
  };

  LogHelper.DEBUG = true;

  const homeDir = getHomeDir();
  const configDir = path.join(homeDir, `.${APP_NAME}`);
  const fileHelper: FileHelper = new FileHelper(configDir, "config.json", "projects");
  let gitHelper: GitHelper;

  if (!isConfigFileValid()) {
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
