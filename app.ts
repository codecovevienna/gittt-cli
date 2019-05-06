import axios, { AxiosResponse } from "axios";
import commander, { Command, CommanderStatic } from "commander";
import inquirer from "inquirer";
import _ from "lodash";
import moment, { Moment } from "moment";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import {
  FileHelper,
  GitHelper,
  LogHelper,
  parseProjectNameFromGitUrl,
  ProjectHelper,
  QuestionHelper,
  TimerHelper,
} from "./helper";
import {
  IConfigFile,
  IInitAnswers,
  IInitProjectAnswers,
  IIntegrationLink,
  IJiraLink,
  IJiraPublishResult,
  IProject,
  IRecord,
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
        const gitUrl: string = await QuestionHelper.askGitUrl();
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
    const integration: string = await QuestionHelper.chooseIntegration();

    switch (integration) {
      case "Jira":
        const project: IProject = this.projectHelper.getProjectFromGit();

        if (!project) {
          return this.exit("Seems like you are not in a valid git directory", 1);
        }
        // TODO validate if record exists in projects dir(?)

        const jiraLink: IJiraLink = await QuestionHelper.askJiraLink(project);

        try {
          await this.fileHelper.addOrUpdateLink(jiraLink);
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
      LogHelper.warn(`Unable to find a link for "${project.name}"`);
      const linkSetupAnswer: any = await inquirer.prompt([
        {
          message: `Do you want to setup a new link for this project?`,
          name: "confirm",
          type: "confirm",
        },
      ]);

      if (linkSetupAnswer.confirm) {
        await this.linkAction(cmd);

        return await this.publishAction(cmd);
      } else {
        return this.exit(`Unable to publish without link`, 1);
      }
    }

    const populatedProject: IProject | undefined = await this.fileHelper.findProjectByName(project.name);

    if (!populatedProject) {
      return this.exit("Unable to find project", 1);
    }

    const logs: ReadonlyArray<DefaultLogFields> = await this.gitHelper.logChanges();
    if (logs.length > 0) {
      const pushConfirm: any = await inquirer.prompt([
        {
          default: true,
          message: "Found local changes, they have to be pushed before publishing",
          name: "push",
          type: "confirm",
        },
      ]);

      if (pushConfirm.push) {
        await this.gitHelper.pushChanges();
      } else {
        return this.exit("Unable to publish with local changes", 1);
      }
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

  public async filterRecordsByYear(records: IRecord[]): Promise<IRecord[]> {
    const allYears: string[] = [];

    for (const rc of records) {
      const currentYear: string = moment(rc.end).format("YYYY");
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
      ]) as {
        year: string,
      };

      return records.filter((rc: IRecord) => {
        const currentYear: string = moment(rc.end).format("YYYY");
        return currentYear === choiceYear.year;
      });

    } else {
      return records;
    }
  }

  public async filterRecordsByMonth(records: IRecord[]): Promise<IRecord[]> {
    // Check for month
    const allMonths: string[] = [];

    for (const rc of records) {
      const currentMonth: string = moment(rc.end).format("MMMM");
      if (allMonths.indexOf(currentMonth) === -1) {
        allMonths.push(currentMonth);
      }
    }

    // Check if records spanning over more than one month
    if (allMonths.length > 1) {
      const choiceMonth: any = await inquirer.prompt([
        {
          choices: allMonths,
          message: "List of Month",
          name: "month",
          type: "list",
        },
      ]) as {
        month: string,
      };

      return records.filter((rc: IRecord) => {
        const currentMonth: string = moment(rc.end).format("MMMM");
        return currentMonth === choiceMonth.month;
      });

    } else {
      return records;
    }
  }

  public async filterRecordsByDay(records: IRecord[]): Promise<IRecord[]> {
    // Check for days
    const allDays: string[] = [];

    for (const rc of records) {
      const currentDay: string = moment(rc.end).format("DD");
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
      ]) as {
        day: string,
      };

      return records.filter((rc: IRecord) => {
        const currentDay: string = moment(rc.end).format("DD");
        return currentDay === choiceDay.day;
      });

    } else {
      return records;
    }
  }

  public async editAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    // TODO move to own function, is used multiple times
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

    const { records } = projectWithRecords;
    let recordsToEdit: IRecord[];
    let chosenRecord: IRecord;

    if (!interactiveMode) {
      if (!cmd.guid) {
        LogHelper.error("No guid option found");
        return cmd.help();
      }

      const recordGuid: string = cmd.guid;

      const chosenRecords: IRecord[] = records.filter((rc: IRecord) => {
        return rc.guid === recordGuid;
      });

      chosenRecord = chosenRecords[0];

      if (!chosenRecord) {
        return this.exit(`No records found for guid "${recordGuid}"`, 1);
      }
    } else {
      recordsToEdit = await this.filterRecordsByYear(records);
      recordsToEdit = await this.filterRecordsByMonth(recordsToEdit);
      recordsToEdit = await this.filterRecordsByDay(recordsToEdit);

      chosenRecord = await QuestionHelper.chooseRecord(recordsToEdit);
    }

    const updatedRecord: IRecord = chosenRecord;

    if (!interactiveMode) {
      if (cmd.amount) {
        updatedRecord.amount = cmd.amount;
      } else {
        LogHelper.error("No amount option found");
        return cmd.help();
      }
      if (cmd.type) {
        updatedRecord.amount = cmd.amount;
      } else {
        LogHelper.error("No type option found");
        return cmd.help();
      }
    } else {
      updatedRecord.amount = await QuestionHelper.askAmount(chosenRecord.amount);
      updatedRecord.type = await QuestionHelper.chooseType(chosenRecord.type);
    }

    // TODO update from timestamp

    updatedRecord.updated = Date.now();

    const updatedRecords: IRecord[] = records.map((rc: IRecord) => {
      return rc.guid === updatedRecord.guid ? updatedRecord : rc;
    });

    const updatedProject: IProject = projectWithRecords;
    updatedProject.records = updatedRecords;

    await this.fileHelper.saveProjectObject(updatedProject);

    // TODO check if something really changed and take this in account in the message
    const commitMessage: string = `Updated record ${updatedRecord.guid} in project ${updatedProject.name}
New amount: ${updatedRecord.amount}
New type: ${updatedRecord.type}`;

    await this.gitHelper.commitChanges(commitMessage);
  }

  // TODO pretty much the same as editAction, refactor?
  public async removeAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

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

    const { records } = projectWithRecords;
    let recordsToDelete: IRecord[];
    let chosenRecord: IRecord;

    if (!interactiveMode) {
      if (!cmd.guid) {
        LogHelper.error("No guid option found");
        return cmd.help();
      }

      const recordGuid: string = cmd.guid;

      const chosenRecords: IRecord[] = records.filter((rc: IRecord) => {
        return rc.guid === recordGuid;
      });

      chosenRecord = chosenRecords[0];

      if (!chosenRecord) {
        return this.exit(`No records found for guid "${recordGuid}"`, 1);
      }
    } else {
      recordsToDelete = await this.filterRecordsByYear(records);
      recordsToDelete = await this.filterRecordsByMonth(recordsToDelete);
      recordsToDelete = await this.filterRecordsByDay(recordsToDelete);

      chosenRecord = await QuestionHelper.chooseRecord(recordsToDelete);
    }

    // TODO confirm deletion?
    const updatedRecords: IRecord[] = records.filter((rc: IRecord) => {
      return rc.guid !== chosenRecord.guid;
    });

    const updatedProject: IProject = projectWithRecords;
    updatedProject.records = updatedRecords;

    await this.fileHelper.saveProjectObject(updatedProject);

    const commitMessage: string = `Removed record ${chosenRecord.guid} from project ${updatedProject.name}`;

    await this.gitHelper.commitChanges(commitMessage);
  }

  public async addAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let year: number;
    let month: number;
    let day: number;
    let hour: number;
    let minute: number;
    let amount: number;
    let message: string | undefined;

    if (!interactiveMode) {
      if (!cmd.amount || !QuestionHelper.validateNumber(cmd.amount)) {
        LogHelper.error("No amount option found");
        return cmd.help();
      }

      amount = parseInt(cmd.amount, 10);

      year = (cmd.year && QuestionHelper.validateNumber(cmd.year))
        ? parseInt(cmd.year, 10) : moment().year();
      month = (cmd.month && QuestionHelper.validateNumber(cmd.month, 1, 12))
        ? parseInt(cmd.month, 10) : moment().month() + 1;
      day = (cmd.day && QuestionHelper.validateNumber(cmd.day, 1, 31))
        ? parseInt(cmd.day, 10) : moment().date();
      hour = (cmd.hour && QuestionHelper.validateNumber(cmd.hour, 0, 23))
        ? parseInt(cmd.hour, 10) : moment().hour();
      minute = (cmd.minute && QuestionHelper.validateNumber(cmd.minute, 0, 59))
        ? parseInt(cmd.minute, 10) : moment().minute();

      message = (cmd.message && cmd.message.length > 0) ? cmd.message : undefined;

    } else {
      year = await QuestionHelper.askYear();
      month = await QuestionHelper.askMonth();
      day = await QuestionHelper.askDay();
      hour = await QuestionHelper.askHour();
      minute = await QuestionHelper.askMinute();
      amount = await QuestionHelper.askAmount(1);
      message = await QuestionHelper.askMessage();
    }

    const modifiedMoment: Moment = moment().set({
      date: day,
      hour,
      millisecond: 0,
      minute,
      month: month - 1,
      second: 0,
      year,
    });

    const end: number = modifiedMoment.unix() * 1000;

    const newRecord: IRecord = {
      amount,
      end,
      message: message ? message : undefined,
      type: "Time",
    };

    await this.projectHelper.addRecordToProject(newRecord);
  }

  public initCommander(): CommanderStatic {
    commander
      .version(APP_VERSION);

    commander
      .command("commit <hours>")
      .description("Committing current hours to the project")
      .option("-m, --message <message>", "Description of the spent hours")
      .action(async (cmd: string, options: any): Promise<void> => {
        const hours: number = parseFloat(cmd);
        if (isNaN(hours)) {
          return this.exit("Unable to parse hours", 1);
        }

        await this.projectHelper.addRecordToProject({
          amount: hours,
          end: Date.now(),
          message: options.message,
          type: "Time",
        });
      });

    commander
      .command("add")
      .description("Adding hours to the project in the past")
      .option("-a, --amount <amount>", "Specify the amount")
      .option("-y, --year [year]", "Specify the year, defaults to current year")
      .option("-m, --month [month]", "Specify the month, defaults to current month")
      .option("-d, --day [day]", "Specify the day, defaults to current day")
      .option("-h, --hour [hour]", "Specify the hour, defaults to current hour")
      .option("-M, --minute [minute]", "Specify the minute, defaults to current minute")
      .option("-w, --message [message]", "Specify the message of the record")
      .action(async (cmd: Command): Promise<void> => {
        await this.addAction(cmd);
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

    commander
      .command("edit")
      .description("Edit record of current project")
      .option("-g, --guid [guid]", "GUID of the record to edit")
      .option("-a, --amount [amount]", "New amount for the record", parseFloat)
      .option("-t, --type [type]", "New Type for the record")
      .action(async (cmd: Command): Promise<void> => {
        await this.editAction(cmd);
      });

    commander
      .command("remove")
      .description("Remove record of current project")
      .option("-g, --guid [guid]", "GUID of the record to remove")
      .action(async (cmd: Command): Promise<void> => {
        await this.removeAction(cmd);
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
}
