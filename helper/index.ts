import { IProject } from "../interfaces";

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
