import commander, { CommanderStatic } from "commander";
import inquirer from "inquirer";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import { FileHelper, GitHelper, LogHelper, ProjectHelper } from "./helper";
import { IGitRepoAnswers, IInitAnswers } from "./interfaces";

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

  const setup = async (): Promise<void> => {
    LogHelper.info("Where to store the projects");
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

    fileHelper.createConfigDir();
    LogHelper.info(`Created config dir (${configDir})`);

    const { gitRepo } = gitRepoAnswers;

    await fileHelper.initConfigFile(gitRepo);
    LogHelper.info("Created config file");
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

        for(const pL of projects){
          const hours = await projectHelper.getTotalHours(pL.name);
          LogHelper.info(`${pL.name}:\t${hours}`)
          totalHours += hours;
        }

        LogHelper.info(`Total projects:\t${projects.length}`)
        LogHelper.info(`Total hours:\t${totalHours}`)
      });

    return commander;
  };

  LogHelper.DEBUG = true;

  const homeDir = getHomeDir();
  const configDir = path.join(homeDir, `.${APP_NAME}`);
  const fileHelper: FileHelper = new FileHelper(configDir, "config.json", "projects");
  let gitHelper: GitHelper;
  let projectHelper: ProjectHelper;

  if (!(fileHelper.configFileExists())) {
    const initAnswers: IInitAnswers = await inquirer.prompt([
      {
        message: `Looks like you never used ${APP_NAME}, should it be set up?`,
        name: "setup",
        type: "confirm",
      },
    ]) as IInitAnswers;

    if (initAnswers.setup) {
      await setup();
      gitHelper = new GitHelper(configDir, fileHelper);
      projectHelper = new ProjectHelper(gitHelper, fileHelper);
      await gitHelper.initRepo();
    } else {
      exit(`${APP_NAME} does not work without setup, bye!`, 0);
    }
  }

  gitHelper = new GitHelper(configDir, fileHelper);
  projectHelper = new ProjectHelper(gitHelper, fileHelper);

  await projectHelper.init();

  initCommander();

  if (process.argv.length === 2) {
    commander.help();
  } else {
    commander.parse(process.argv);
  }

})();
