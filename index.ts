import commander from "commander";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import shelljs, { ExecOutputReturnValue } from "shelljs";
import { DefaultLogFields } from "simple-git/typings/response";
import { GitHelper, LogHelper } from "./helper";
import { FileHelper } from "./helper/file";
import { IConfigFile, IGitRepoAnswers, IHour, IInitAnswers, IProject, IProjectNameAnswers } from "./interfaces";

// tslint:disable-next-line no-var-requires
const packageJson = require("./package.json");
const APP_NAME = packageJson.name;
const APP_VERSION = packageJson.version;

(async () => {
  const exit = (msg: string, code: number) => {
    if (code === 0) {
      LogHelper.warn(msg);
    } else {
      LogHelper.error(msg);
    }
    process.exit(code);
  };

  const saveProject = async (project: IProject) => {
    const config: IConfigFile = await fileHelper.getConfigObject();

    // remove project from config file
    const filteredProjects = config.projects.filter(({ name }) => name !== project.name);

    // add project to config file

    filteredProjects.push(project);
    // save config file

    config.projects = filteredProjects;

    await fileHelper.saveConfigObject(config);
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

  const getProjectList = (config: IConfigFile): IProject[] => {
    return config.projects;
  };

  const getProjectByName = (config: IConfigFile, name: string): IProject | undefined => {
    return config.projects.find((project: IProject) =>  project.name === name);
  };

  const parseProjectNameFromGitUrl = (input: string): string | undefined => {
    const split = input
      .match(new RegExp("(\\w+:\/\/)(.+@)*([\\w\\d\.]+)(:[\\d]+){0,1}\/*(.*)\.git"));

    if (!split || split.length !== 6) {
      return;
    }

    const [,
      /*schema*/,
      /*user*/,
      /*domain*/,
      /*port*/,
      projectName] = split;

    return projectName;
  };

  const getProjectNameUser = async (): Promise<string> => {
    LogHelper.info("Unable to determinate project, please add it manually");
    const projectNameAnswer = await inquirer.prompt([
      {
        message: "Project namespace:",
        name: "userProjectNamespace",
        type: "input",
        validate(input) {
          const valid = input.length > 0;

          if (valid) {
            return true;
          } else {
            return "The namespace must not be empty";
          }
        },
      },
      {
        message: "Project name:",
        name: "userProjectName",
        type: "input",
        validate(input) {
          const valid = input.length > 0;

          if (valid) {
            return true;
          } else {
            return "The name must not be empty";
          }
        },
      },
    ]) as IProjectNameAnswers;

    const { userProjectName, userProjectNamespace } = projectNameAnswer;

    return `${userProjectNamespace}/${userProjectName}`;
  };

  const getProjectNameGit = (): string | undefined => {
    LogHelper.debug("Trying to find project name from .git folder");
    const gitConfigExec: ExecOutputReturnValue = shelljs.exec("git config remote.origin.url", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitConfigExec.code !== 0 || gitConfigExec.stdout.length < 4) {
      return;
    }

    const originUrl = gitConfigExec.stdout.trim();

    return parseProjectNameFromGitUrl(originUrl);
  };

  const getProjectName = async (): Promise<string> => {
    let projectName = getProjectNameGit();

    if (!projectName) {
      projectName = await getProjectNameUser();
    }

    return projectName;
  };

  const setup = async (): Promise<void> => {
    LogHelper.info("Where to store the projects");
    const gitRepoAnswers = await inquirer.prompt([
      {
        message: "Git Repository URL:",
        name: "gitRepo",
        type: "input",
        validate(input) {
          const projectName = parseProjectNameFromGitUrl(input);

          const valid = (input.length > 0 && !!projectName);

          if (valid) {
            return true;
          } else {
            return "The url has to look like ssh://git@github.com:eiabea/awesomeProject.git";
          }
        },
      },
    ]) as IGitRepoAnswers;

    await fileHelper.createConfigDir();
    LogHelper.info(`Created config dir (${configDir})`);

    const { gitRepo } = gitRepoAnswers;

    await fileHelper.initConfigFile(gitRepo);
    LogHelper.info("Created config file");
  };

  const initCommander = async (config: IConfigFile) => {
    commander
      .version(APP_VERSION);

    commander
      .command("commit <hours>")
      .description("Adding hours to the project")
      .option("-m, --message <message>", "Description of the spent hours")
      .action(async (cmd, options) => {
        const hours = parseFloat(cmd);
        if (isNaN(hours)) {
          exit("Unable to parse hours", 1);
        }

        await addHoursToProject(config, await getProjectName(), {
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
        const projects = await getProjectList(config);

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

    return commander;
  };

  const initProject = async (config: IConfigFile) => {
    const name = await getProjectName();
    const project = await getProjectByName(config, name);
    const hours: IHour[] = [];

    if (!project) {
      config.projects.push({
        hours,
        name,
      });

      await fileHelper.saveConfigObject(config);
      await gitHelper.commitChanges(`Initiated ${name}`);
      await gitHelper.pushChanges();
    }

  };

  const addHoursToProject = async (config: IConfigFile, projectName: string, hour: IHour) => {
    const project = await getProjectByName(config, projectName);
    if (!project) {
      throw new Error(`Project "${projectName}" not found`);
    }

    project.hours.push(hour);

    await saveProject(project);

    const hourString = hour.count === 1 ? "hour" : "hours";

    await gitHelper.commitChanges(`Added ${hour.count} ${hourString} to ${projectName}: "${hour.message}"`);
  };

  LogHelper.DEBUG = true;

  const homeDir = getHomeDir();
  const configDir = path.join(homeDir, `.${APP_NAME}`);
  let configObj: IConfigFile;
  let gitHelper: GitHelper;
  let fileHelper: FileHelper;
  fileHelper = new FileHelper(configDir, "config.json");

  if (!(await fileHelper.configFileExists())) {
    const initAnswers: IInitAnswers = await inquirer.prompt([
      {
        message: `Looks like you never used ${APP_NAME}, should it be set up?`,
        name: "setup",
        type: "confirm",
      },
    ]) as IInitAnswers;

    if (initAnswers.setup) {
      await setup();
      configObj = await fileHelper.getConfigObject();
      gitHelper = new GitHelper(configDir);
      await gitHelper.initRepo(configObj);
    } else {
      exit(`${APP_NAME} does not work without setup, bye!`, 0);
    }
  }

  configObj = await fileHelper.getConfigObject();
  gitHelper = new GitHelper(configDir);

  await initProject(configObj);

  await initCommander(configObj);

  if (process.argv.length === 2) {
    commander.help();
  } else {
    commander.parse(process.argv);
  }

})();
