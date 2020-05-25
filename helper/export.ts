import { writeFile, utils, WritingOptions, BookType } from 'xlsx';
import { IProject, IRecord } from '../interfaces';
import moment = require('moment');

export class ExportHelper {
  public static export(path = process.cwd(), name = "gittt-export", type: BookType = "ods", projects: IProject[] = []): void {
    const filePath = `${path}/${name}.${type}`;
    const wb = utils.book_new();
    for (const project of projects) {
      const sheetData = [
        ["Date", "Type", "Amount", "Comment"],
      ];

      for (let i = 1; i <= project.records.length; i++) {
        const recordData: any[] = [];
        const tmpRecord: IRecord = project.records[i - 1];
        recordData[0] = moment(tmpRecord.end).toDate();
        recordData[1] = tmpRecord.type;
        recordData[2] = tmpRecord.amount;
        recordData[3] = tmpRecord.message;
        sheetData[i] = recordData;
      }

      const ws = utils.aoa_to_sheet(sheetData);
      utils.book_append_sheet(wb, ws, project.name);
    }
    writeFile(wb, filePath, {
      cellDates: true,
      bookType: type
    } as WritingOptions);
  }
}
