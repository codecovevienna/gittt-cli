import chalk from "chalk";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import shelljs, { ExecOutputReturnValue } from "shelljs";
import simplegit, { StatusResult } from "simple-git/promise";

// tslint:disable-next-line no-var-requires
const APP_NAME = require("./package.json").name;

const DEBUG = true;

(async () => {
  interface IInitAnswers {
    setup: boolean;
  }

  interface IOverrideAnswers {
    override: number;
  }

  interface IProjectNameAnswers {
    userProjectNamespace: string;
    userProjectName: string;
  }

  interface IGitRepoAnswers {
    gitRepo: string;
  }

  interface IProject {
    name: string;
  }

  interface IConfigFile {
    created: number;
    gitRepo: string;
    projects: IProject[];
  }

  const debug = (msg: any) => {
    if (DEBUG) {
      console.log(msg);
    }
  };

  const log = (msg: any) => {
    console.log(chalk.white.bold(msg));
  };

  const warn = (msg: any) => {
    console.log(chalk.yellow.bold(msg));
  };

  const error = (msg: any) => {
    console.log(chalk.red.bold(msg));
  };

  const info = (msg: any) => {
    console.log(chalk.green.bold(msg));
  };

  const exit = (msg: string, code: number) => {
    warn(msg);
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

  const getProjectList = (config: IConfigFile): IProject[] => {
    return config.projects;
  };

  const getProjectByName = (config: IConfigFile, name: string): IProject | undefined => {
    config.projects.find((project: IProject) => {
        return project.name === name;
    });

    return;
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
    info("Unable to determinate project, please add it manually");
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
    debug("Trying to find project name from .git folder");
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
    info("Where to store the projects");
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

    try {
      fs.mkdirSync(configDir);
      info(`Created config dir (${configDir})`);
    } catch (err) {
      debug(`Error creating config dir ${err}`);
    }

    const { gitRepo } = gitRepoAnswers;

    try {
      fs.writeFileSync(configFile, JSON.stringify({
        created: Date.now(),
        gitRepo,
        projects: [],
      }));
      info(`Created config file (${configFile})`);
    } catch (err) {
      debug(`Error creating config file ${err}`);
    }
  };

  const getConfig = (): IConfigFile => {
    return JSON.parse(fs.readFileSync(configFile).toString());
  };

  const initRepo = async (config: IConfigFile) => {
    const git = simplegit(configDir);
    const repoInitialized = await git.checkIsRepo();
    if (!repoInitialized) {
      await git.init();
      await git.addRemote("origin", config.gitRepo);
    }

    try {
      await git.pull("origin", "master");
      info("Pulled repo successfully");
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
      console.log(override);

      switch (override) {
        case 0:
          await git.reset(["--hard", "origin/master"]);
          await git.pull("origin", "master");
          break;
        case 1:
          try {
            await git.add(configFile);
            info("Added initial config file");
            await git.commit("Setup commit");
            info("Committed initial config file");
            await git.raw(["push", "origin", "master", "--force"]);
            info("Pushed to repo");
            const status: StatusResult = await git.status();
            console.log(status);
          } catch (err) {
            warn("Unable to fetch repo " + config.gitRepo);
          }
          break;
        case 2:
          exit("Bye!", 0);
          break;

        default:
          break;
      }
    }
  };

  const initProject = async (config: IConfigFile) => {
    console.log(await getProjectName());
    console.log(config);

    console.log(await getProjectList(config));
    console.log(await getProjectByName(config, "test"));
  };

  const homeDir = getHomeDir();
  const configDir = path.join(homeDir, `.${APP_NAME}`);
  const configFile = path.join(configDir, "config.json");
  const configExists = fs.existsSync(configFile);
  let configObj: IConfigFile;

  if (!configExists) {
    const initAnswers: IInitAnswers = await inquirer.prompt([
      {
        message: `Looks like you never used ${APP_NAME}, should it be set up?`,
        name: "setup",
        type: "confirm",
      },
    ]) as IInitAnswers;

    if (initAnswers.setup) {
      await setup();
      configObj = getConfig();
      await initRepo(configObj);
    } else {
      exit(`${APP_NAME} does not work without setup, bye!`, 0);
    }
  }

  configObj = getConfig();

  await initProject(configObj);

})();
