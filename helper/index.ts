import { IProject } from "../interfaces";
import { LogHelper } from "./log";
import { QuestionHelper } from "./question";

export { ConfigHelper } from "./config";
export { GitHelper } from "./git";
export { LogHelper } from "./log";
export { FileHelper } from "./file";
export { ProjectHelper } from "./project";
export { TimerHelper } from "./timer";
export { QuestionHelper } from "./question";
export { ImportHelper } from "./import";
export { ExportHelper } from "./export";
export { ValidationHelper } from "./validation";
export { RecordHelper } from "./record";
export { ChartHelper } from "./chart";
export { AuthHelper } from "./auth";
export { MultipieHelper } from "./multipie";

export function parseProjectNameFromGitUrl(input: string): IProject {
  const split: RegExpMatchArray | null = input
    .match(new RegExp("(\\w+://){0,1}(.+@)*([\\w\\d.]+)(:[\\d]*){0,1}/*(.*).git"));

  if (!split || split.length !== 6) {
    throw new Error("Unable to get project information from repo URL");
  }

  const [,
    /*schema*/,
    /*user*/,
    host,
    port,
    name] = split;

  const nameSplit: string[] = name.split("/");

  let parsedName: string;

  if (nameSplit.length > 1) {
    // Assuming namespace/project-name
    parsedName = name.replace(/\//g, "_");
  } else {
    // No slash found, using raw name
    parsedName = name;
  }

  return {
    meta: {
      host,
      port: parseInt(port.replace(":", ""), 10),
      raw: input,
    },
    name: parsedName,
    records: [],
  };
}

function executeRegExp(regex: RegExp, input: string): string | undefined {
  const match: RegExpExecArray | null = regex.exec(input);
  if (!match) {
    return undefined
  }

  // Return index 1, which contains first match group instead of whole match
  return match[1];
}

/**
 * Extracts ticket number from commit message
 * 
 * The commit message has to look something like this: Implemented awesome feature (#1337)
 * Which would return 1337
 * 
 * White spaces between the # an the ticket number are supported, but # is mandatory
 * e.g. Implemented awesome feature (# 1337)
 * 
 * @param  {string} branch
 * @returns {string} ticket number
 */
export function findTicketNumberInMessage(msg: string): string | undefined {
  return executeRegExp(new RegExp(/#[ ]*([0-9]+)/), msg);
}

/**
 * Extracts ticket number from branch
 * 
 * The branch has to look something like this: 1337-awesome-feature
 * Which would return 1337
 * 
 * @param  {string} branch
 * @returns {string} ticket number
 */
export function findTicketNumberInBranch(branch: string): string | undefined {
  return executeRegExp(new RegExp(/(^[0-9]+)-.*/), branch);
}

export async function appendTicketNumber(initialMessage: string, branchName: string | undefined): Promise<string> {
  let commitMessage = initialMessage;

  const ticketNumberMsg = findTicketNumberInMessage(initialMessage);
  let ticketNumberBranch = undefined;
  if (branchName) {
    ticketNumberBranch = findTicketNumberInBranch(branchName);
  }

  if (ticketNumberMsg && ticketNumberBranch) {
    LogHelper.debug(`Found ticket number in branch and commit message (message: ${ticketNumberMsg}, branch: ${ticketNumberBranch})`)
    LogHelper.debug(`Favor ticket number "${ticketNumberMsg}" in message and append nothing)`)
  } else if (!ticketNumberMsg && ticketNumberBranch) {
    LogHelper.debug(`Found ticket number only in branch (branch: ${ticketNumberBranch})`)
    const confirm = await QuestionHelper.confirmTicketNumber(ticketNumberBranch);
    if (confirm) {
      commitMessage = `${commitMessage} [#${ticketNumberBranch}]`;
    }
  }

  return commitMessage;
}

/**
 * Truncates and extends a given string to a given length
 * 
 * @param text which should be return to a fixed length
 * @param length of the string
 * @param dots how many '.' should be added to the end of the string when text length is longer than length
 * @returns fixed length string
 */
export function toFixedLength(text: string | undefined, length: number, dots = 3): string {

  if (length < 0) {
    length = 0;
  }

  if (dots < 0) {
    dots = 0;
  }

  if (dots > length) {
    return '.'.repeat(length);
  }

  if (text) {
    if (text.length > length) {
      return `${text.slice(0, length - dots)}` + '.'.repeat(dots);
    } else {
      return `${text}` + ' '.repeat(length - text.length);
    }
  } else {
    return ' '.repeat(length)
  }
}