import * as XLSX from 'xlsx';

export class ExportHelper {
  constructor() {
  }

  public export() {
    const data = [
      [1, 2, 3],
      [true, false, null, "sheetjs"],
      ["foo    bar", "baz", new Date("2014-02-19T14:30Z"), "0.3"],
      ["baz", null, "\u0BEE", 3.14159],
      ["hidden"],
      ["visible"]
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data, { cellDates: true });
    XLSX.utils.book_append_sheet(wb, ws, "GITTT");
    XLSX.writeFile(wb, "test.xlsx");
  }
}
