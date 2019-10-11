import assert from "assert";
import csvParser, { CsvParser } from "csv-parser";
import fs from "fs-extra";
import { isNumber, isString } from "util";
import { ICsvRow, IRecord } from "../interfaces";
import { ProjectHelper } from "./project";

export class ImportHelper {
  private projectHelper: ProjectHelper;

  constructor(projectHelper: ProjectHelper) {
    this.projectHelper = projectHelper;
  }

  public importCsv = async (filePath: string): Promise<IRecord[]> => {

    const fd: fs.ReadStream = fs.createReadStream(filePath);
    const parser: CsvParser = csvParser();

    fd.pipe(parser);

    const result: IRecord[] = Array<IRecord>();

    return new Promise<IRecord[]>((resolve: (value?: IRecord[]) => void,
                                   reject: (reason?: any) => void): void => {
      parser.on("data", (data: any) => {
        try {
          assert(data.AMOUNT != null && isString(data.AMOUNT));
          assert(data.END != null && isString(data.END) && data.END > -1);
          assert(data.MESSAGE != null &&
            isString(data.MESSAGE) &&
            data.MESSAGE.length > 0);

          const row: ICsvRow = {
            AMOUNT: parseFloat(data.AMOUNT),
            END: parseInt(data.END, 10),
            MESSAGE: data.MESSAGE.toString().replace(/\"/gi, ""),
          };

          assert(row.AMOUNT != null && isNumber(row.AMOUNT));
          assert(row.END != null && isNumber(row.END) && row.END > -1);
          assert(row.MESSAGE != null &&
            isString(row.MESSAGE) &&
            row.MESSAGE.length > 0 &&
            row.MESSAGE.indexOf('"') < 0);

          const record: IRecord = {
            amount: row.AMOUNT,  // Amount
            end: row.END, // End Date + End Time
            message: row.MESSAGE, // Description
            type: "Time",
          };

          result.push(record);
        } catch (err) {
          // LogHelper.debug(data, err);
        }
      });

      parser.on("end", () => resolve(result));

      parser.on("error", () => reject());
    });
  }

}
