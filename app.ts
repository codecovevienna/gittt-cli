import axios, { AxiosResponse } from "axios";
import commander, { Command, CommanderStatic } from "commander";
import inquirer from "inquirer";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import { FileHelper, GitHelper, LogHelper, parseProjectNameFromGitUrl, ProjectHelper, TimerHelper } from "./helper";
import {
  IConfigFile,
  IGitRepoAnswers,
  IInitAnswers,
  IInitProjectAnswers,
  IIntegrationAnswers,
  IIntegrationLink,
  IJiraIntegrationAnswers,
  IJiraLink,
  IJiraPublishResult,
  IProject,
} from "./interfaces";

// tslint:disable-next-line no-var-requires
const packageJson: any = require("./package.json");
const APP_NAME: string = packageJson.name;
const APP_VERSION: string = packageJson.version;

export class App {
  private homeDir: string;
  private configDir: string;
  private fileHelper: FileHelper;
  private timerHelper: TimerHelper;
  private gitHelper: GitHelper;
  private projectHelper: ProjectHelper;

  public start(): void {
    if (process.argv.length === 2) {
      commander.help();
    } else {
      commander.parse(process.argv);
    }
  }

  public exit(msg: string, code: number): void {
    if (code === 0) {
      LogHelper.warn(msg);
    } else {
      LogHelper.error(msg);
    }
    process.exit(code);
  }

  public getHomeDir(): string {
    const home: string | null = require("os").homedir()
      || process.env.HOME
      || process.env.HOMEPATH
      || process.env.USERPROFIL;

    if (!home) {
      throw new Error("Unable to determinate home directory");
    }

    return home;
  }

  public async setup(): Promise<void> {
    this.homeDir = this.getHomeDir();
    this.configDir = path.join(this.homeDir, `.${APP_NAME}`);
    this.fileHelper = new FileHelper(this.configDir, "config.json", "timer.json", "projects");

    // TODO correct place to ask this?
    if (!(await this.fileHelper.configDirExists()) || !(await this.isConfigFileValid())) {
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
    this.timerHelper = new TimerHelper(this.fileHelper, this.projectHelper);

    this.initCommander();
  }

  public async initConfigDir(): Promise<void> {
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

  public async linkAction(cmd: Command): Promise<void> {
    const integrationAnswers: IIntegrationAnswers = await inquirer.prompt([
      {
        choices: [
          "Jira",
        ],
        message: "Link project to what integration?",
        name: "integration",
        type: "list",
      },
    ]);
    const { integration } = integrationAnswers;

    switch (integration) {
      case "Jira":
        const jiraAnswers: IJiraIntegrationAnswers = await inquirer.prompt([
          {
            message: "Jira gittt plugin endpoint",
            name: "endpoint",
            type: "input",
            // TODO validate?
          },
          {
            message: "Jira username",
            name: "username",
            type: "input",
            // TODO validate
          },
          {
            message: "Jira password",
            name: "password",
            type: "password",
            // TODO validate
          },
          {
            message: "Jira project key (e.g. GITTT)",
            name: "key",
            type: "input",
            // TODO validate
          },
        ]);

        const project: IProject = this.projectHelper.getProjectFromGit();

        if (!project) {
          return this.exit("Seems like you are not in a valid git directory", 1);
        }
        // TODO validate if record exists in projects dir(?)

        const hash: string = Buffer.from(`${jiraAnswers.username}:${jiraAnswers.password}`).toString("base64");

        const { endpoint, key, username } = jiraAnswers;
        const projectName: string = project.name;

        const link: IJiraLink = {
          endpoint,
          hash,
          key,
          linkType: "Jira",
          projectName,
          username,
        };

        try {
          await this.fileHelper.addOrUpdateLink(link);
        } catch (err) {
          LogHelper.debug(`Unable to add link to config file`, err);
          return this.exit(`Unable to add link to config file`, 1);
        }

        break;

      default:
        break;
    }
  }

  public async publishAction(cmd: Command): Promise<void> {
    const project: IProject = this.projectHelper.getProjectFromGit();

    if (!project) {
      return this.exit("Seems like you are not in a valid git directory", 1);
    }

    const configObject: IConfigFile = await this.fileHelper.getConfigObject();

    const link: any | undefined = configObject.links.find((li: IIntegrationLink) => {
      return li.projectName === project.name;
    });

    if (!link) {
      return this.exit(`Unable to find a link for "${project.name}"`, 1);
    }

    const populatedProject: IProject | undefined = await this.fileHelper.findProjectByName(project.name);

    if (!populatedProject) {
      return this.exit("Unable to find project", 1);
    }

    switch (link.linkType) {
      case "Jira":
        // cast generic link to jira link
        const jiraLink: IJiraLink = link;

        // Map local project to jira key
        LogHelper.debug(`Mapping "${populatedProject.name}" to Jira key "${jiraLink.key}"`);
        populatedProject.name = jiraLink.key;

        try {
          const publishResult: AxiosResponse = await axios
            .post(jiraLink.endpoint,
              populatedProject,
              {
                headers: {
                  "Authorization": `Basic ${jiraLink.hash}`,
                  "Cache-Control": "no-cache",
                  "Content-Type": "application/json",
                },
              },
            );

          const data: IJiraPublishResult = publishResult.data;

          if (data.success) {
            LogHelper.info("Successfully published data to Jira");
          } else {
            this.exit(`Unable to publish to Jira: ${data.message}`, 1);
          }
        } catch (err) {
          delete err.config;
          delete err.request;
          delete err.response;
          LogHelper.debug("Publish request failed", err);
          this.exit(`Publish request failed`, 1);
        }

        break;

      default:
        this.exit(`Link type "${link.linkType}" not implemented`, 1);
        break;
    }
  }

  public initCommander(): CommanderStatic {
    commander
      .version(APP_VERSION);

    commander
      .command("commit <hours>")
      .description("Adding hours to the project")
      .option("-m, --message <message>", "Description of the spent hours")
      .action(async (cmd: string, options: any): Promise<void> => {
        const hours: number = parseFloat(cmd);
        if (isNaN(hours)) {
          return this.exit("Unable to parse hours", 1);
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
      .command("start")
      .description("Start the timer")
      .action(async () => {
        await this.timerHelper.startTimer();
      });

    commander
      .command("stop")
      .description("Stop the timer and commit to a project")
      .option("-k, --kill", "Kill the timer for a project")
      .option("-m, --message <message>", "Commit message for the project")
      .action(async (cmd: any): Promise<void> => {
        if (cmd.kill) {
          await this.timerHelper.killTimer();
        } else {
          await this.timerHelper.stopTimer(cmd.message);
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
          await this.projectHelper.initProject();
        }
      });

    commander
      .command("link")
      .description("Initializes link to third party applications")
      .action(async (cmd: Command) => {
        await this.linkAction(cmd);
      });

    commander
      .command("publish")
      .description("Publishes stored records to external endpoint")
      .action(async (cmd: Command) => {
        await this.publishAction(cmd);
      });

    return commander;
  }

  public async isConfigFileValid(): Promise<boolean> {
    let config: IConfigFile | undefined;

    try {
      config = await this.fileHelper.getConfigObject(true);
    } catch (err) {
      LogHelper.debug(`Unable to parse config file: ${err.message}`);
      return false;
    }

    try {
      parseProjectNameFromGitUrl(config.gitRepo);
      return true;
    } catch (err) {
      LogHelper.debug("Unable to get project name", err);
      return false;
    }
  }

  public async askGitUrl(): Promise<string> {
    const gitRepoAnswers: IGitRepoAnswers = await inquirer.prompt([
      {
        message: "Git Repository URL:",
        name: "gitRepo",
        type: "input",
        validate(input: any): boolean | string | Promise<boolean | string> {
          try {
            // Will throw if parsing fails
            parseProjectNameFromGitUrl(input);
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
