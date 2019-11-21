import axios, { AxiosResponse } from "axios";
import chalk from "chalk";
import commander, { Command, CommanderStatic } from "commander";
import inquirer from "inquirer";
import _, { isString } from "lodash";
import moment, { Moment } from "moment";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import {
  ChartHelper,
  FileHelper,
  GitHelper,
  ImportHelper,
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
import { RECORD_TYPES, GitRemoteError, GitNoOriginError, GitNoUrlError, ORDER_TYPE, ORDER_DIRECTION } from "./types";
import { isNullOrUndefined } from "util";

// tslint:disable-next-line no-var-requires
const packageJson: any = require("./package.json");
const APP_NAME: string = packageJson.name;
const APP_VERSION: string = packageJson.version;
const APP_CONFIG_DIR: string = ".gittt-cli";

export class App {
  private homeDir: string;
  private configDir: string;
  private fileHelper: FileHelper;
  private timerHelper: TimerHelper;
  private gitHelper: GitHelper;
  private projectHelper: ProjectHelper;
  private importHelper: ImportHelper;

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
    this.configDir = path.join(this.homeDir, `${APP_CONFIG_DIR}`);
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
    this.importHelper = new ImportHelper(this.projectHelper);

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
    const interactiveMode: boolean = process.argv.length === 3;

    let project: IProject | undefined;

    if (!interactiveMode) {
      project = await this.projectHelper.getProjectByName(cmd.project);
    } else {
      project = await this.getOrAskForProjectFromGit();
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    const integration: string = await QuestionHelper.chooseIntegration();

    switch (integration) {
      case "Jira":
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

  public async getOrAskForProjectFromGit(): Promise<IProject | undefined> {
    try {
      return this.projectHelper.getProjectFromGit();
    } catch (e) {
      if (e instanceof GitRemoteError) {
        const selectedProjectName: string = await QuestionHelper.chooseProjectFile(await this.fileHelper.findAllProjects());
        const [domain, name] = selectedProjectName.split("/");
        const project: IProject | undefined = await this.fileHelper.findProjectByName(
          // TODO find a better way?
          name.replace(".json", ""),
          ProjectHelper.domainToProjectMeta(domain),
        );

        if (!project) {
          throw new Error("Unable to find project on disk");
        }

        return project;
      } else {
        throw e;
      }
    }
  }

  public async publishAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let project: IProject | undefined;

    if (!interactiveMode) {
      project = await this.projectHelper.getProjectByName(cmd.project);
    } else {
      project = await this.getOrAskForProjectFromGit();
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    const configObject: IConfigFile = await this.fileHelper.getConfigObject();

    const link: any | undefined = configObject.links.find((li: IIntegrationLink) => {
      return project ? li.projectName === project.name : false;
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
    let projectFromGit: IProject | undefined;
    try {
      if (interactiveMode) {
        projectFromGit = await this.getOrAskForProjectFromGit();
      } else {
        projectFromGit = this.projectHelper.getProjectFromGit();
      }
    } catch (err) {
      LogHelper.debug("Unable to get project name from git folder", err);
      return this.exit("Unable to get project name from git folder", 1);
    }

    if (!projectFromGit) {
      return this.exit("No valid git project", 1);
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

    const updatedRecord: IRecord = Object.assign({}, chosenRecord);

    let year: number;
    let month: number;
    let day: number;
    let hour: number;
    let minute: number;
    let amount: number;
    let message: string | undefined;

    if (!interactiveMode) {
      if (cmd.type) {
        updatedRecord.type = cmd.type;
      } else {
        LogHelper.error("No type option found");
        return cmd.help();
      }

      if (!QuestionHelper.validateNumber(cmd.amount)) {
        LogHelper.error("No amount option found");
        return cmd.help();
      }

      amount = parseFloat(cmd.amount);

      year = QuestionHelper.validateNumber(cmd.year)
        ? parseInt(cmd.year, 10) : moment().year();
      month = QuestionHelper.validateNumber(cmd.month, 1, 12)
        ? parseInt(cmd.month, 10) : moment().month() + 1;
      day = QuestionHelper.validateNumber(cmd.day, 1, 31)
        ? parseInt(cmd.day, 10) : moment().date();
      hour = QuestionHelper.validateNumber(cmd.hour, 0, 23)
        ? parseInt(cmd.hour, 10) : moment().hour();
      minute = QuestionHelper.validateNumber(cmd.minute, 0, 59)
        ? parseInt(cmd.minute, 10) : moment().minute();

      message = (cmd.message && cmd.message.length > 0) ? cmd.message : undefined;
    } else {
      updatedRecord.type = await QuestionHelper.chooseType(chosenRecord.type);

      year = await QuestionHelper.askYear(moment(chosenRecord.end).year());
      month = await QuestionHelper.askMonth(moment(chosenRecord.end).month() + 1);
      day = await QuestionHelper.askDay(moment(chosenRecord.end).date());
      hour = await QuestionHelper.askHour(moment(chosenRecord.end).hour());
      minute = await QuestionHelper.askMinute(moment(chosenRecord.end).minute());
      amount = await QuestionHelper.askAmount(chosenRecord.amount);
      message = await QuestionHelper.askMessage(chosenRecord.message);
    }

    updatedRecord.updated = Date.now();
    updatedRecord.message = message;
    updatedRecord.amount = amount;

    const modifiedMoment: Moment = moment().set({
      date: day,
      hour,
      millisecond: 0,
      minute,
      month: month - 1,
      second: 0,
      year,
    });

    updatedRecord.end = modifiedMoment.unix() * 1000;

    const updatedRecords: IRecord[] = records.map((rc: IRecord) => {
      return rc.guid === updatedRecord.guid ? updatedRecord : rc;
    });

    const updatedProject: IProject = projectWithRecords;
    updatedProject.records = updatedRecords;

    await this.fileHelper.saveProjectObject(updatedProject);

    let changes: string = "";

    if (updatedRecord.amount !== chosenRecord.amount) {
      changes += `amount: ${updatedRecord.amount}, `;
    }
    if (updatedRecord.end !== chosenRecord.end) {
      changes += `end: ${updatedRecord.end}, `;
    }
    if (updatedRecord.message !== chosenRecord.message) {
      changes += `message: ${updatedRecord.message}, `;
    }
    if (updatedRecord.type !== chosenRecord.type) {
      changes += `type: ${updatedRecord.type}, `;
    }
    if (changes.length > 0) {
      changes = changes.slice(0, -2);
    }

    const commitMessage: string = changes.length > 0 ? `Updated record (${changes}) at ${updatedProject.name}` : `Updated record at ${updatedProject.name}`;

    await this.gitHelper.commitChanges(commitMessage);

    LogHelper.info(commitMessage);
  }

  // TODO pretty much the same as editAction, refactor?
  public async removeAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let projectFromGit: IProject | undefined;
    try {
      if (interactiveMode) {
        projectFromGit = await this.getOrAskForProjectFromGit();
      } else {
        projectFromGit = this.projectHelper.getProjectFromGit();
      }
    } catch (err) {
      LogHelper.debug("Unable to get project name from git folder", err);
      return this.exit("Unable to get project name from git folder", 1);
    }

    if (!projectFromGit) {
      return this.exit("No valid git project", 1);
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

    LogHelper.info(`Removed record (${moment(chosenRecord.end).format("DD.MM.YYYY, HH:mm:ss")
      }: ${chosenRecord.amount} ${chosenRecord.type} - "${_.truncate(chosenRecord.message)}") from project ${updatedProject.name}`);
  }

  public async commitAction(cmd: string, options: any): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 4;

    const amount: number = parseFloat(cmd);
    let message: string | undefined;
    let project: IProject | undefined;

    if (isNaN(amount)) {
      return this.exit("Unable to parse hours", 1);
    }

    message = options.message;
    project = await this.projectHelper.getProjectByName(options.project);

    if (interactiveMode) {
      if (!project) {
        project = await this.getOrAskForProjectFromGit();
      }
      if (!isString(message)) {
        message = await QuestionHelper.askMessage();
      }
    }

    await this.projectHelper.addRecordToProject({
      amount: amount,
      end: Date.now(),
      message: message,
      type: RECORD_TYPES.Time,
    }, project);
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
    let type: RECORD_TYPES;
    let project: IProject | undefined;

    if (!interactiveMode) {
      if (!QuestionHelper.validateNumber(cmd.amount)) {
        LogHelper.error("No amount option found");
        return cmd.help();
      }
      if (!cmd.type) {
        LogHelper.error("No type option found");
        return cmd.help();
      }


      amount = parseInt(cmd.amount, 10);
      type = cmd.type;

      year = QuestionHelper.validateNumber(cmd.year)
        ? parseInt(cmd.year, 10) : moment().year();
      month = QuestionHelper.validateNumber(cmd.month, 1, 12)
        ? parseInt(cmd.month, 10) : moment().month() + 1;
      day = QuestionHelper.validateNumber(cmd.day, 1, 31)
        ? parseInt(cmd.day, 10) : moment().date();
      hour = QuestionHelper.validateNumber(cmd.hour, 0, 23)
        ? parseInt(cmd.hour, 10) : moment().hour();
      minute = QuestionHelper.validateNumber(cmd.minute, 0, 59)
        ? parseInt(cmd.minute, 10) : moment().minute();

      project = await this.projectHelper.getProjectByName(cmd.project);
      message = (cmd.message && cmd.message.length > 0) ? cmd.message : undefined;
    } else {
      project = await this.getOrAskForProjectFromGit();
      year = await QuestionHelper.askYear();
      month = await QuestionHelper.askMonth();
      day = await QuestionHelper.askDay();
      hour = await QuestionHelper.askHour();
      minute = await QuestionHelper.askMinute();
      amount = await QuestionHelper.askAmount(1);
      message = await QuestionHelper.askMessage();
      type = await QuestionHelper.chooseType();
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
      type,
    };

    await this.projectHelper.addRecordToProject(newRecord, project);
  }

  public async importCsv(cmd: Command): Promise<void> {

    let filePath: string;

    if (cmd.file !== null) {
      filePath = (cmd.file && QuestionHelper.validateFile(cmd.file)) ? cmd.file : null;
      if (filePath !== null) {
        const records: IRecord[] = await this.importHelper.importCsv(filePath);
        //TODO check project
        await this.projectHelper.addRecordsToProject(records, undefined, true, false);
      }
    }
  }

  public async infoAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let order: string;
    let direction: string;
    let project: IProject | undefined;

    order = ORDER_TYPE.indexOf(cmd.order) === -1 ? ORDER_TYPE[0] : cmd.order;
    direction = ORDER_DIRECTION.indexOf(cmd.direction) === -1 ? ORDER_DIRECTION[0] : cmd.direction;

    if (!interactiveMode) {
      project = await this.projectHelper.getProjectByName(cmd.project);
    } else {
      project = await this.getOrAskForProjectFromGit();
    }

    const projects: IProject[] = await this.fileHelper.findAllProjects();

    // get current Gittt project
    if (!project) {
      return this.exit("No valid git project", 1);
    } else {
      // check if the project is a gittt project
      const foundProject: IProject = projects.filter((p: IProject) => project && p.name === project.name)[0];
      if (foundProject) {
        const hours: number = await this.projectHelper.getTotalHours(foundProject.name);
        LogHelper.log(`- ${foundProject.name}: ${hours}h`);
      } else {
        LogHelper.error("No gittt project in current git project.");
      }
    }

    LogHelper.info("");
    LogHelper.info(`Projects:`);
    // add hours to projects
    const projectsWithHours: any[] = [];
    for (const prj of projects) {
      const hours: number = await this.projectHelper.getTotalHours(prj.name);
      projectsWithHours.push({
        hours,
        project: prj,
      });
    }

    // order projects
    const orderedProjects: any[] = projectsWithHours.sort((a: any, b: any) => {
      if (order === "hours") {
        if (direction === "desc") {
          return (a.hours - b.hours) * -1;
        }
        return (a.hours - b.hours);
      }

      if (a.project.name < b.project.name) {
        return (direction === "desc") ? 1 : -1;
      }
      if (a.project.name > b.project.name) {
        return (direction === "desc") ? -1 : 1;
      }

      return 0;
    });

    // print projects
    for (const prj of orderedProjects) {
      LogHelper.log(`- ${prj.project.name}: ${prj.hours || "-1"}h`);
    }
  }

  public async listAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let project: IProject | undefined;

    if (!interactiveMode) {
      project = await this.projectHelper.getProjectByName(cmd.project);
    } else {
      project = await this.getOrAskForProjectFromGit();
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    const projectWithRecords: IProject | undefined = await this.fileHelper.findProjectByName(project.name);
    if (!projectWithRecords) {
      return this.exit(`Unable to find project "${project.name}"`, 1);
    }

    if (projectWithRecords.records.length === 0) {
      return this.exit(`No records found for "${project.name}"`, 1);
    }

    // sorting newest to latest
    const records: IRecord[] = projectWithRecords.records.sort((a: IRecord, b: IRecord) => {
      const aStartTime: moment.Moment = moment(a.end).subtract(a.amount, "hours");
      const bStartTime: moment.Moment = moment(b.end).subtract(b.amount, "hours");

      return bStartTime.diff(aStartTime);
    });

    LogHelper.info(`${projectWithRecords.name}`);
    LogHelper.print(`--------------------------------------------------------------------------------`);
    LogHelper.info(`TYPE\tAMOUNT\tTIME\t\t\tCOMMENT`);
    LogHelper.print(`--------------------------------------------------------------------------------`);

    let sumOfTime: number = 0;
    for (const record of records) {
      let line: string = "";
      line += `${record.type}\t`;
      line += chalk.yellow.bold(`${record.amount}h\t`);
      line += `${moment(record.end).subtract(record.amount, "hours").format("DD.MM.YYYY HH:mm:ss")}\t`;
      line += chalk.yellow.bold(`${record.message}`);
      sumOfTime += record.amount;
      LogHelper.print(line);
    }

    LogHelper.print(`--------------------------------------------------------------------------------`);
    LogHelper.info(`SUM:\t${sumOfTime}h`);
  }

  public async reportAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let project: IProject | undefined;

    if (!interactiveMode) {
      project = await this.projectHelper.getProjectByName(cmd.project);
    } else {
      project = await this.getOrAskForProjectFromGit();
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    const days: number = parseInt(cmd.days, 10) || 14; // default is 14 days (2 weeks sprint)
    const daysData: any = {};
    const weekdayData: any = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };

    // get tomorrow 00:00
    const now: moment.Moment = moment();
    now.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    now.add(1, "days");

    // get all records in timeframe
    for (const record of project.records) {
      const startTime: moment.Moment = moment(record.end).subtract(record.amount, "hours");

      // the difference will be positive for every day into the past
      const difference: moment.Duration = moment.duration(now.diff(startTime));

      // if difference is to great we skip the record
      if (difference.asDays() > days && days !== -1) {
        continue;
      }

      // add to daysData
      const dayString: string = startTime.format("MMM DD, YYYY (ddd)");
      daysData[dayString] = daysData[dayString] ? daysData[dayString] + record.amount : record.amount;

      // add to weeklyData
      const weekdayString: string = startTime.format("dddd");
      weekdayData[weekdayString] += record.amount;
    }

    LogHelper.info("----------------------------------------------------------------------");
    LogHelper.info(`Project: ${project.name}`);
    LogHelper.info(`for the last ${days} days`);
    LogHelper.info("----------------------------------------------------------------------");

    // seperator
    LogHelper.log("");

    // print daysData
    if (Object.keys(daysData).length > 0) {
      LogHelper.info("Days report");
      LogHelper.log("----------------------------------------------------------------------");
      LogHelper.log(ChartHelper.chart(daysData, true, 50, false, "h"));
    }

    // seperator
    LogHelper.log("");

    // print weeklyData
    LogHelper.info("Weekday report");
    LogHelper.log("----------------------------------------------------------------------");
    LogHelper.log(ChartHelper.chart(weekdayData, true, 50, false, "h"));
  }

  public initCommander(): CommanderStatic {
    commander.on("command:*", () => {
      commander.help();
    });

    // add version command
    commander
      .version(APP_VERSION);

    // Commit action
    commander
      .command("commit <hours>")
      .description("Committing current hours to the project")
      .option("-m, --message <message>", "Description of the spent hours")
      .option("-p, --project [project]", "Specify the project to commit to")
      .action(async (cmd: string, options: any): Promise<void> => await this.commitAction(cmd, options));

    // add command
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
      .option("-t, --type [type]", "Specify the type of the record")
      .option("-p, --project [project]", "Specify the project to add the record")
      .action(async (cmd: Command): Promise<void> => await this.addAction(cmd));

    // push command
    commander
      .command("push")
      .description("Pushing changes to repository")
      .action(async (cmd: Command): Promise<void> => {
        LogHelper.info("Pushing changes...");
        await this.gitHelper.pushChanges();
        LogHelper.info("Done");
      });

    // info command
    commander
      .command("info")
      .description("Lists info about gittt for this users (projects and hours)")
      .option("-o, --order <type>", "Specify the ordering (hours or name) default is " + ORDER_TYPE[0])
      .option("-d, --direction <direction>", "Specify the ordering direction (asc, desc)" + ORDER_DIRECTION[0])
      .option("-p, --project [project]", "Specify the project to get the information")
      .action((cmd: Command): Promise<void> => this.infoAction(cmd));

    // list command
    // will be changed in GITTT-85
    commander
      .command("list")
      .description("List of time tracks in project")
      .option("-p, --project [project]", "Specify the project to get the time tracks")
      .action((cmd: Command): Promise<void> => this.listAction(cmd));


    // report command
    // will be changed in GITTT-85
    commander
      .command("report")
      .description("Prints a small report")
      .option("-d, --days [number]", "Specify for how many days the report should be printed.")
      .option("-p, --project [project]", "Specify the project the report should be printed for")
      .action((cmd: Command): Promise<void> => this.reportAction(cmd));

    // log command
    // not needed anymore
    // commander
    //   .command("log")
    //   .description("List of local changes")
    //   .action(async () => {
    //     const logs: ReadonlyArray<DefaultLogFields> = await this.gitHelper.logChanges();
    //     if (logs.length > 0) {
    //       LogHelper.warn("Local changes:");
    //       for (const log of logs) {
    //         console.log(`${log.date}\n  ${log.message.trim()}`);
    //       }
    //     } else {
    //       LogHelper.info("Everything is up to date");
    //     }
    //   });

    // status command
    // not needed anymore
    // commander
    //   .command("status")
    //   .description("Overview of all projects")
    //   .action(async () => {
    //     const projects: IProject[] = await this.fileHelper.findAllProjects();
    //     let totalHours: number = 0;

    //     LogHelper.info("Projects:");
    //     for (const pL of projects) {
    //       const hours: number = await this.projectHelper.getTotalHours(pL.name);
    //       LogHelper.info(`${pL.name}:\t${hours}`);
    //       totalHours += hours;
    //     }
    //     LogHelper.info("");

    //     LogHelper.info("Summery:");
    //     LogHelper.info(`Total projects:\t${projects.length}`);
    //     LogHelper.info(`Total hours:\t${totalHours}`);
    //   });

    commander
      .command("setup")
      .description("Initializes config directory and setup of gittt git project")
      .action(async (): Promise<void> => await this.initConfigDir());

    // start command
    commander
      .command("start")
      .description("Start the timer")
      .action(async (): Promise<void> => await this.timerHelper.startTimer());

    // stop command
    commander
      .command("stop")
      .description("Stop the timer and commit to a project")
      .option("-k, --kill", "Kill the timer for a project")
      .option("-m, --message <message>", "Commit message for the project")
      .option("-p, --project [project]", "Specify the project to add your time to")
      .action(async (cmd: any): Promise<void> => {
        const interactiveMode: boolean = process.argv.length === 3;

        let project: IProject | undefined;

        if (!interactiveMode) {
          project = await this.projectHelper.getProjectByName(cmd.project);
        } else {
          project = await this.getOrAskForProjectFromGit();
        }

        if (cmd.kill) {
          await this.timerHelper.killTimer();
        } else {
          await this.timerHelper.stopTimer(cmd.message, project);
        }
      });

    // init command
    commander
      .command("init")
      .description("Initializes the project in current git directory")
      .action(async (): Promise<void> => {
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

    // link command
    commander
      .command("link")
      .description("Initializes link to third party applications")
      .option("-p, --project [project]", "Specify the project to link")
      .action(async (cmd: Command): Promise<void> => await this.linkAction(cmd));

    // publish command
    commander
      .command("publish")
      .description("Publishes stored records to external endpoint")
      .option("-p, --project [project]", "Specify the project to publish")
      .action(async (cmd: Command): Promise<void> => await this.publishAction(cmd));

    // edit command
    commander
      .command("edit")
      .description("Edit record of current project")
      .option("-g, --guid [guid]", "GUID of the record to edit")
      .option("-a, --amount <amount>", "Specify the amount")
      .option("-y, --year [year]", "Specify the year, defaults to current year")
      .option("-m, --month [month]", "Specify the month, defaults to current month")
      .option("-d, --day [day]", "Specify the day, defaults to current day")
      .option("-h, --hour [hour]", "Specify the hour, defaults to current hour")
      .option("-M, --minute [minute]", "Specify the minute, defaults to current minute")
      .option("-w, --message [message]", "Specify the message of the record")
      .option("-t, --type [type]", "Specify the type of the record")
      .option("-p, --project [project]", "Specify the project to edit")
      .action(async (cmd: Command): Promise<void> => await this.editAction(cmd));

    // remove command
    commander
      .command("remove")
      .description("Remove record from a project")
      .option("-g, --guid [guid]", "GUID of the record to remove")
      .option("-p, --project [project]", "Specify the project to remove a record")
      .action(async (cmd: Command): Promise<void> => await this.removeAction(cmd));

    // import command
    commander
      .command("import")
      .description("Import records from csv to current project")
      .option("-f, --file [file]", "CSV file with format (MESSAGE,END[int],AMOUNT[double])")
      .option("-p, --project [project]", "Specify the project to import records to")
      .action(async (cmd: Command): Promise<void> => {
        await this.importCsv(cmd);
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
