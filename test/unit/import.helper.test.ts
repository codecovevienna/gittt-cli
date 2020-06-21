import { assert, expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { ObjectReadableMock } from "stream-mock";
import { ImportHelper } from "../../helper";
import { IRecord } from "../../interfaces";
import { RECORD_TYPES } from "../../types";
import { AssertionError } from "assert";

const csvFilePath = "/path/to/csv/file.csv";
const csvCorrectInput = "AMOUNT,END,MESSAGE,TYPE\n10,1556727733000,Message Text,Time\n1,1556723833000,\"Message, new Text\",Time";
const csvCorrectOutput: IRecord[] = [{
  amount: 10,
  end: 1556727733000,
  message: "Message Text",
  type: RECORD_TYPES.Time,
},
{
  amount: 1,
  end: 1556723833000,
  message: "Message, new Text",
  type: RECORD_TYPES.Time,
}];

const csvOnlyHeaderInput = "AMOUNT,END,MESSAGE,TYPE";
const csvWrongSeparatorInput = "AMOUNT;END;MESSAGE;TYPE\n10;1556727733000;Message Text,Time\n1;1556723833000;Message new Text,Time";
const csvMalformedDataInput = "AMOUNT,END,MESSAGE,TYPE\n10,Message Text,Time\n1,Hallo Test,Message new Text,Time";
const csvMalformedHeaderInput = "amount,end,message,type\n10,1556727733000,Message Text,Time\n1,1556723833,Message new Text,Time";
const csvNoHeaderInput = "10,1556727733000,Message Text,Time\n1,1556723833,Message new Text,Time";
const csvBullshitInput = "ksdjf939jflwsfkdskjlfjlo3oqw9d92eijskljdjf apsflsflk jakjfieo jwfaksdjf  jfea fio";
const csvMissingColumnInput = "AMOUNT,MESSAGE\n10,Message Text\n1,Message new Text";

const csvReadableDateDefaultFormatInput = "AMOUNT,END,MESSAGE,TYPE\n1,2019-01-29 13:00,Message new Text,Time";
const csvWrongReadableDateDefaultFormatInput = "AMOUNT,END,MESSAGE,TYPE\n1,asdf,Message new Text,Time";
const csvReadableDateDefaultFormatOutput: IRecord[] = [{
  amount: 1,
  end: 1548766800000,
  message: "Message new Text",
  type: RECORD_TYPES.Time,
}];
const csvCommaSeperatedAmountInput = "AMOUNT,END,MESSAGE,TYPE\n\"1,5\",1556723833000,Message new Text,Time";
const csvCommaSeperatedAmountOutput: IRecord[] = [{
  amount: 1.5,
  end: 1556723833000,
  message: "Message new Text",
  type: RECORD_TYPES.Time,
}];

const expectedEmptyArray: IRecord[] = [];

describe("ImportHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should create instance", async function () {
    const importHelper: ImportHelper = new ImportHelper();
    expect(importHelper).to.be.instanceOf(ImportHelper);
  });

  it("should parse correct records", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvCorrectInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, csvCorrectOutput);
  });

  it("should parse records with readable date", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvReadableDateDefaultFormatInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, csvReadableDateDefaultFormatOutput);
  });

  it("should fail with wrong date format", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvWrongReadableDateDefaultFormatInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();

    let thrownError: AssertionError | undefined;
    try {
      await instance.importCsv(csvFilePath);
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
    assert.isNotEmpty(thrownError?.message);
    expect(thrownError?.message.indexOf("Line 2")).to.be.greaterThan(-1);
  });

  it("should parse records with comma seperated amount", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvCommaSeperatedAmountInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, csvCommaSeperatedAmountOutput);
  });

  it("should return empty array due to only header", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvOnlyHeaderInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, expectedEmptyArray);
  });

  it("should fail due to wrong separator", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvWrongSeparatorInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();

    let thrownError: AssertionError | undefined;
    try {
      await instance.importCsv(csvFilePath);
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

  it("should fail due to malformed data", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvMalformedDataInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();

    let thrownError: AssertionError | undefined;
    try {
      await instance.importCsv(csvFilePath);
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

  it("should fail due to malformed header", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvMalformedHeaderInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();

    let thrownError: AssertionError | undefined;
    try {
      await instance.importCsv(csvFilePath);
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

  it("should fail due to missing header", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvNoHeaderInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();

    let thrownError: AssertionError | undefined;
    try {
      await instance.importCsv(csvFilePath);
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

  it("should fail due to bullshit data", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvBullshitInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, expectedEmptyArray);
  });

  it("should fail due to missing column", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvMissingColumnInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();

    let thrownError: AssertionError | undefined;
    try {
      await instance.importCsv(csvFilePath);
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

});
