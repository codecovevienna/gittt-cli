import commander, { CommanderStatic } from "commander";
import inquirer from "inquirer";
import _ from "lodash";
import moment from "moment";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import { FileHelper, GitHelper, LogHelper, parseProjectNameFromGitUrl, ProjectHelper, TimerHelper } from "./helper";
import { IConfigFile, IGitRepoAnswers, IInitAnswers, IInitProjectAnswers, IProject, IRecord } from "./interfaces";
import { RECORD_TYPES } from "./types";

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
      .command("edit")
      .description("Edit record of current project")
      .action(async () => {
        // TODO refactor/split up
        let projectFromGit: IProject;
        try {
          projectFromGit = this.projectHelper.getProjectFromGit();
        } catch (err) {
          LogHelper.debug("Unable to get project name from git folder", err);
          return this.exit("Unable to get project name from git folder", 1);
        }

        const projectWithRecords: IProject | undefined = await this.fileHelper.findProjectByName(projectFromGit.name);
        if (!projectWithRecords) {
          return this.exit(`Unable to find project "${projectFromGit.name}"`, 1);
        }

        if (projectWithRecords.records.length === 0) {
          return this.exit(`No records found for "${projectFromGit.name}"`, 1);
        }

        console.log(projectWithRecords);

        const { records } = projectWithRecords;
        let recordsToEdit: IRecord[];

        // Check for years
        const allYears: string[] = [];

        for (const rc of projectWithRecords.records) {
          const currentYear: string = moment(rc.created).format("YYYY");
          if (allYears.indexOf(currentYear) === -1) {
            allYears.push(currentYear);
          }
        }

        // Check if records spanning over more than one year
        if (allYears.length > 1) {
          const choiceYear: any = await inquirer.prompt([
            {
              choices: allYears,
              message: "List of years",
              name: "year",
              type: "list",
            },
          ]);

          recordsToEdit = records.filter((rc: IRecord) => {
            const currentYear: string = moment(rc.created).format("YYYY");
            return currentYear === choiceYear.year;
          });

        } else {
          recordsToEdit = records;
        }

        // Check for month
        const allMonth: string[] = [];

        for (const rc of recordsToEdit) {
          const currentMonth: string = moment(rc.created).format("MMMM");
          if (allMonth.indexOf(currentMonth) === -1) {
            allMonth.push(currentMonth);
          }
        }

        // Check if records spanning over more than one month
        if (allMonth.length > 1) {
          const choiceMonth: any = await inquirer.prompt([
            {
              choices: allMonth,
              message: "List of Month",
              name: "month",
              type: "list",
            },
          ]);

          recordsToEdit = recordsToEdit.filter((rc: IRecord) => {
            const currentMonth: string = moment(rc.created).format("MMMM");
            return currentMonth === choiceMonth.month;
          });

        } else {
          recordsToEdit = recordsToEdit;
        }

        // Check for days
        const allDays: string[] = [];

        for (const rc of recordsToEdit) {
          const currentDay: string = moment(rc.created).format("DD");
          if (allDays.indexOf(currentDay) === -1) {
            allDays.push(currentDay);
          }
        }

        // Check if records spanning over more than one day
        if (allDays.length > 1) {
          const choiceDay: any = await inquirer.prompt([
            {
              choices: allDays,
              message: "List of Days",
              name: "day",
              type: "list",
            },
          ]);

          recordsToEdit = recordsToEdit.filter((rc: IRecord) => {
            const currentDay: string = moment(rc.created).format("DD");
            return currentDay === choiceDay.day;
          });

        } else {
          recordsToEdit = recordsToEdit;
        }

        const choice: any = await inquirer.prompt([
          {
            choices: recordsToEdit.map((rc: IRecord) => {
              return {
                name: `${moment(rc.created).format("dd.MM.YYYY, HH:mm:ss")}: ${rc.amount} ${rc.type} - "${_.
                  truncate(rc.message)}"`,
                value: rc.guid,
              };
            }),
            message: "List of records",
            name: "choice",
            type: "list",
          },
        ]);

        const chosenRecords: IRecord[] = recordsToEdit.filter((rc: IRecord) => {
          return rc.guid === choice.choice;
        });

        const [chosenRecord] = chosenRecords;

        const newAmountAnswer: any = await inquirer.prompt([
          {
            default: chosenRecord.amount,
            message: "Update amount",
            name: "amount",
            type: "number",
            validate(input: any): boolean | string | Promise<boolean | string> {
              return !isNaN(input);
            },
          },
        ]);

        const newAmount: number = newAmountAnswer.amount;

        const newTypeAnswer: any = await inquirer.prompt([
          {
            choices: [
              {
                name: "Time",
                value: "Time",
              },
            ],
            default: chosenRecord.type,
            message: "Update type",
            name: "type",
            type: "list",
          },
        ]);

        const newType: RECORD_TYPES = newTypeAnswer.type;

        const updatedRecord: IRecord = chosenRecord;
        updatedRecord.amount = newAmount;
        updatedRecord.type = newType;

        const updatedRecords: IRecord[] = projectWithRecords.records.map((rc: IRecord) => {
          return rc.guid === updatedRecord.guid ? updatedRecord : rc;
        });

        const updatedProject: IProject = projectWithRecords;
        updatedProject.records = updatedRecords;

        this.fileHelper.saveProjectObject(updatedProject);

        // TODO check if something really changed and take this in account in the message
        const commitMessage: string = `Updated record ${updatedRecord.guid} in project ${updatedProject.name}
New amount: ${updatedRecord.amount}
New type: ${updatedRecord.type}`;

        this.gitHelper.commitChanges(commitMessage);
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
