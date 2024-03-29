import inquirer, { ListQuestion, Question } from "inquirer";
import _ from "lodash";
import moment from "moment";
import { IJiraLink, IMultipieInputLink, IMultipieStoreLink, IProject, IRecord, ISelectChoice } from "../interfaces";
import { RECORD_TYPES } from "../types";
import { MultipieHelper, ProjectHelper, ValidationHelper } from ".";

export class QuestionHelper {
  public static filterJiraEndpoint = (input: any): boolean | string | Promise<boolean | string> => {
    const inputString = input as string;
    // Ensure no trailing slash
    if (inputString[inputString.length - 1] === "/") {
      return inputString.slice(0, inputString.length - 1);
    } else {
      return inputString;
    }
  }

  public static askYear = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().year(),
        message: "Year",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateYear,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askMonth = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().month() + 1,
        message: "Month",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateMonth,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askDay = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().date(),
        message: "Day",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateDay,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askHour = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().hour(),
        message: "Hour",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateHour,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askMinute = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().minute(),
        message: "Minute",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateMinute,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askAmount = async (oldAmount?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(oldAmount) ? oldAmount : undefined,
        message: "Amount",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateAmount,
      },
    ]);

    return parseFloat(choice.choice);
  }

  public static askMessage = async (defaultValue?: string): Promise<string | undefined> => {
    const choice: any = await inquirer.prompt([
      {
        default: defaultValue ? defaultValue : undefined,
        message: "Message",
        name: "choice",
        type: "input",
      },
    ]);

    return choice.choice.length > 0 ? choice.choice : undefined;
  }

  public static askGitUrl = async (): Promise<string> => {
    const choice: any = await inquirer.prompt([
      {
        message: "Git Repository URL:",
        name: "choice",
        type: "input",
        validate: ValidationHelper.validateGitUrl,
      },
    ]);

    return choice.choice;
  }

  public static askJiraLink = async (project: IProject, prevData?: IJiraLink, endpointVersion = "latest"): Promise<IJiraLink> => {
    const jiraAnswers: any = await inquirer.prompt([
      {
        default: prevData ? prevData.host : "https://jira.gittt.org",
        filter: QuestionHelper.filterJiraEndpoint,
        message: "Jira host",
        name: "host",
        type: "input",
        validate: ValidationHelper.validateJiraEndpoint,
      },
      {
        default: prevData ? prevData.username : undefined,
        message: "Jira username",
        name: "username",
        type: "input",
        // TODO validate
      },
      {
        message: prevData ? "Jira password (leave empty if not changed)" : "Jira password",
        name: "password",
        type: "password",
        // TODO validate
      },
      {
        default: prevData ? prevData.key : undefined,
        message: "Jira project key (e.g. GITTT)",
        name: "key",
        type: "input",
        validate: ValidationHelper.validateJiraKey,
      },
      {
        default: prevData ? prevData.issue : undefined,
        message: "Jira issue key (e.g. EPIC-1 or STORY-1337), may be empty",
        name: "issue",
        type: "input",
        validate: ValidationHelper.validateJiraIssueKey,
      },
    ]);
    const { host, key, issue, username, password } = jiraAnswers;

    let hash: string;
    // Assuming edit mode, use hash from prevData
    if (!password && prevData) {
      hash = prevData.hash;
    } else {
      hash = Buffer
        .from(`${username}:${password}`)
        .toString("base64");
    }

    const projectName: string = project.name;

    const link: IJiraLink = {
      host,
      endpoint: `/rest/gittt/${endpointVersion}/`,
      hash,
      key,
      issue,
      linkType: "Jira",
      projectName,
      username,
    };

    return link;
  }

  public static askMultipieLink = async (project: IProject, prevData?: IMultipieStoreLink): Promise<IMultipieInputLink> => {
    const multipieAnswers = await inquirer.prompt([
      {
        default: prevData ? prevData.endpoint : "https://multipie.gittt.org/v1/publish",
        // also works for generic hosts
        filter: QuestionHelper.filterJiraEndpoint,
        message: "Multipie publish endpoint",
        name: "endpoint",
        type: "input",
        validate: ValidationHelper.validateJiraEndpoint,
      },
      {
        default: prevData ? prevData.rolesEndpoint : "https://multipie.gittt.org/v1/roles",
        // also works for generic hosts
        filter: QuestionHelper.filterJiraEndpoint,
        message: "Multipie roles endpoint",
        name: "rolesEndpoint",
        type: "input",
        validate: ValidationHelper.validateJiraEndpoint,
      },
      {
        message: "gittt-cli client secret",
        name: "clientSecret",
        type: "input",
        validate: ValidationHelper.validateClientSecret,
      },
      {
        message: "Multipie username",
        name: "username",
        type: "input",
        validate: ValidationHelper.validateUsername
      },
      {
        message: "Multipie password",
        name: "password",
        type: "password",
        validate: ValidationHelper.validatePassword
      },
    ]) as {
      endpoint: string;
      rolesEndpoint: string;
      username: string;
      password: string;
      clientSecret: string;
    };

    const { endpoint, rolesEndpoint, username, password, clientSecret } = multipieAnswers;

    const projectName: string = project.name;

    const link: IMultipieInputLink = {
      endpoint,
      rolesEndpoint,
      linkType: "Multipie",
      projectName,
      username,
      password,
      clientSecret,
    };

    return link;
  }

  public static chooseRecord = async (records: IRecord[]): Promise<IRecord> => {
    const choice: any = await inquirer.prompt([
      {
        choices: records.map((rc: IRecord) => {
          return {
            name: `${moment(rc.end).format("DD.MM.YYYY, HH:mm:ss")}: ${rc.amount} ${rc.type} as "${rc.role}" - "${_.
              truncate(rc.message)}"`,
            value: rc.guid,
          };
        }),
        message: "List of records",
        name: "choice",
        type: "list",
      },
    ]);

    const chosenRecords: IRecord[] = records.filter((rc: IRecord) => {
      return rc.guid === choice.choice;
    });

    const [chosenRecord] = chosenRecords;

    return chosenRecord;
  }

  public static chooseType = async (oldType?: RECORD_TYPES): Promise<RECORD_TYPES> => {
    const choices: Array<ISelectChoice> = [
      {
        name: RECORD_TYPES.Time,
        value: RECORD_TYPES.Time,
      },
    ];

    const question: ListQuestion = {
      choices,
      message: "Type",
      name: "choice",
      type: "list",
    };

    if (oldType) {
      question.default = oldType;
    }

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseRole = async (project: IProject, record: IRecord, oldRole?: string,): Promise<string> => {
    const multipieHelper = new MultipieHelper();
    const availableRoles: Array<ISelectChoice> = await multipieHelper.getValidRoles(project, record, oldRole);

    const question: ListQuestion = {
      choices: availableRoles,
      message: "Role",
      name: "choice",
      type: "list",
    };

    if (oldRole) {
      question.default = oldRole;
    }

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseIntegration = async (): Promise<string> => {
    const choices: string[] = [
      "Jira",
      "Multipie",
    ];

    const question: ListQuestion = {
      choices,
      message: "What integration should be used?",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseDomain = async (domains: string[]): Promise<string> => {
    const question: ListQuestion = {
      choices: domains,
      message: "What domain should be used?",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseProjectFile = async (projects: IProject[]): Promise<string> => {
    const question: ListQuestion = {
      choices: projects.map((project: IProject) => {
        if (project.meta) {
          const { host, port } = project.meta;
          return {
            name: `${host}${port ? `:${port}` : ""} ${project.name}`,
            value: ProjectHelper.getProjectPath(project),
          };
        } else {
          return {
            name: `${project.name}`,
            value: ProjectHelper.getProjectPath(project),
          };
        }
      }),
      message: "Choose a project",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseOverrideLocalChanges = async (): Promise<number> => {
    const question: ListQuestion = {
      choices: [
        { name: "Override local config file", value: 0 },
        { name: "Override remote config file", value: 1 },
        { name: "Exit", value: 2 },
      ],
      message: `Remote repo is not empty, override local changes?`,
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return parseInt(choice.choice, 10);
  }

  public static confirmMigration = async (): Promise<boolean> => {
    const question: Question = {
      message: `Do you want to migrate from an existing project?`,
      name: "choice",
      type: "confirm",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static confirmLinkCreation = async (): Promise<boolean> => {
    const question: Question = {
      message: `Do you want to setup a new link for this project?`,
      name: "choice",
      type: "confirm",
    }

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static confirmPushLocalChanges = async (): Promise<boolean> => {
    const question: Question = {
      message: `Found local changes, they have to be pushed before publishing`,
      name: "choice",
      type: "confirm",
    }

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static confirmSetup = async (): Promise<boolean> => {
    const question: Question = {
      message: `Looks like you never used gittt before, should it be set up?`,
      name: "choice",
      type: "confirm",
    }

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static confirmInit = async (): Promise<boolean> => {
    const question: Question = {
      message: `This will reset the project if it is already initialized, are you sure?`,
      name: "choice",
      type: "confirm",
    }

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static confirmTicketNumber = async (ticketNumber: string): Promise<boolean> => {
    const question: Question = {
      message: `Ticket number (${ticketNumber}) found in branch name, should it be added to the commit message?`,
      name: "choice",
      type: "confirm",
    }

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }
}
