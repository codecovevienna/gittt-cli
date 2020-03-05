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
