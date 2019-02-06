import chalk from "chalk";
import { ChildProcess } from "child_process";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import shelljs, { ExecOutputReturnValue } from "shelljs";

// tslint:disable-next-line no-var-requires
const APP_NAME = require("./package.json").name;

const DEBUG = true;

(async () => {
  interface IInitAnswers {
    setup: boolean;
  }

  interface IProject {
    name: string;
  }

  interface IConfigFile {
    created: number;
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

  const info = (msg: any) => {
    console.log(chalk.green.bold(msg));
  };

  const getHomeDir = () => {
    const home = require("os").homedir()
      || process.env.HOME
      || process.env.HOMEPATH
      || process.env.USERPROFIL;

    if (!home) {
      throw new Error("Unable to determinate home directory");
    }

    return home;
  };

  const getProjectName = () => {
    debug("Trying to find project name from .git folder");
    const gitConfigExec: ExecOutputReturnValue | ChildProcess = shelljs.exec("git config remote.origin.url", {
      silent: true,
    });

    console.log(gitConfigExec);

    // if(typeof gitConfigExec == ChildProcess || gitConfigExec.code !== 0 || gitConfigExec.stdout.length < 4){
    //   return
    // }

    // const originUrl = gitConfigExec.stdout.trim();

    // console.log(originUrl)
  };

  const setup = () => {
    try {
      fs.mkdirSync(configDir);
      info(`Created config dir (${configDir})`);
    } catch (err) {
      debug(`Error creating config dir ${err}`);
    }

    try {
      fs.writeFileSync(configFile, JSON.stringify({
        created: Date.now(),
        projects: [],
      }));
      info(`Created config file (${configFile})`);
    } catch (err) {
      debug(`Error creating config file ${err}`);
    }
  };

  const homeDir = getHomeDir();
  const configDir = path.join(homeDir, `.${APP_NAME}`);
  const configFile = path.join(configDir, "config.json");
  const configExists = fs.existsSync(configFile);

  getProjectName();

  if (!configExists) {
    const initAnswers: IInitAnswers = await inquirer.prompt([
      {
        message: "Looks like you never used `${APP_NAME}`, should it be set up?",
        name: "setup",
        type: "confirm",
      },
    ]) as IInitAnswers;
    // const initAnswers = {
    //   setup: true
    // }

    if (initAnswers.setup) {
      setup();
    } else {
      warn(`${APP_NAME} does not work without setup, bye!`);
      process.exit(0);
    }

    debug(initAnswers);
  } else {
    const config: IConfigFile = JSON.parse(fs.readFileSync(configFile).toString());
    debug(config);
  }
})();
