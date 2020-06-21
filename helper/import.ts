import { assert, expect } from "chai";
import * as  Papa from "papaparse";
import fs from "fs-extra";
import { ICsvRow, IRecord } from "../interfaces";
import { RECORD_TYPES } from "../types";
import { LogHelper } from './';
import moment from "moment";
import { ParseResult } from "papaparse";

export class ImportHelper {
  public importCsv = async (filePath: string): Promise<IRecord[]> => {

    const fd: fs.ReadStream = fs.createReadStream(filePath);

    return new Promise<IRecord[]>((resolve, reject) => {
      Papa.parse(fd, {
        header: true,
        delimiter: ',',
        transformHeader: h => h.trim(),
        complete: (parsed: ParseResult<{
          AMOUNT: string;
          END: string;
          MESSAGE: string;
          TYPE: string;
        }>) => {

          if (parsed.errors.length > 0) {
            for (const err of parsed.errors) {
              LogHelper.debug(`[${err.type}] ${err.message}, row: ${err.row}`);
            }
            return reject(new Error("Unable to parse provided csv, check debug log for more information"));
          }

          try {
            resolve(parsed.data.map((chunk, index) => {
              assert.isNotEmpty(chunk.AMOUNT, "Amount is mandatory");
              assert.isNotEmpty(chunk.END, "End is mandatory");
              assert.isNotEmpty(chunk.MESSAGE, "Message is mandatory");
              assert.isNotEmpty(chunk.TYPE, "Message is mandatory");

              let end;
              if (isNaN(+chunk.END)) {
                // try to parse end date
                const parsedDate = moment.utc(chunk.END);

                if (!parsedDate.isValid()) {
                  throw new Error(`Unable to parse provided csv. Line ${index + 2} has no valid END date.`);
                }

                end = parsedDate.unix() * 1000;
              } else {
                end = parseInt(chunk.END, 10);
              }

              // check amount for german separator
              let amount;
              if (isNaN(+chunk.AMOUNT)) {
                amount = parseFloat(chunk.AMOUNT.replace(',', '.'));
              } else {
                amount = parseFloat(chunk.AMOUNT)
              }

              const row: ICsvRow = {
                AMOUNT: amount,
                END: end,
                MESSAGE: chunk.MESSAGE.toString().trim().replace(/"/gi, ""),
                TYPE: chunk.TYPE.toString().trim().replace(/"/gi, ""),
              };

              assert.isNumber(row.AMOUNT);
              assert.isNumber(row.END);
              assert.isNotEmpty(row.MESSAGE);
              expect(row.TYPE).to.eq(RECORD_TYPES.Time);

              return {
                amount: row.AMOUNT,  // Amount
                end: row.END, // End Date + End Time
                message: row.MESSAGE, // Description
                type: RECORD_TYPES.Time,
              } as IRecord;
            }));
          } catch (err) {
            reject(err)
          }
        },
        error: (err) => {
          reject(err)
        }
      })
    });
  }
}
