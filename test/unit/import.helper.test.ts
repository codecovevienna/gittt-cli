import { assert, expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { ObjectReadableMock } from "stream-mock";
import { ImportHelper } from "../../helper";
import { IRecord } from "../../interfaces";
import { RECORD_TYPES } from "../../types";

const csvFilePath = "/path/to/csv/file.csv";
const csvCorrectInput = "AMOUNT,END,MESSAGE\n10,1556727733,Message Text\n1,1556723833,Message new Text";
const expectedCorrectOutput: IRecord[] = [{
  amount: 10,
  end: 1556727733,
  message: "Message Text",
  type: RECORD_TYPES.Time,
},
{
  amount: 1,
  end: 1556723833,
  message: "Message new Text",
  type: RECORD_TYPES.Time,
}];

const csvOnlyHeaderInput = "AMOUNT,END,MESSAGE";
const csvWrongSeparatorInput = "AMOUNT;END;MESSAGE\n10;1556727733;Message Text\n1;1556723833;Message new Text";
const csvMalformedDataInput = "AMOUNT,END,MESSAGE\n10,Message Text\n1,Hallo Test,Message new Text";
const csvMalformedHeaderInput = "amount,end,message\n10,1556727733,Message Text\n1,1556723833,Message new Text";
const csvNoHeaderInput = "10,1556727733,Message Text\n1,1556723833,Message new Text";
const csvBullshitInput = "ksdjf939jflwsfkdskjlfjlo3oqw9d92eijskljdjf apsflsflk jakjfieo jwfaksdjf  jfea fio";
const csvMissingColumnInput = "AMOUNT,MESSAGE\n10,Message Text\n1,Message new Text";

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
    assert.deepStrictEqual(result, expectedCorrectOutput);
  });

  it("should fail due to only header", async function () {
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
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, expectedEmptyArray);
  });

  it("should fail due to malformed data", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvMalformedDataInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, expectedEmptyArray);
  });

  it("should fail due to malformed header", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvMalformedHeaderInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, expectedEmptyArray);
  });

  it("should fail due to missing header", async function () {
    const fileProxy: any = proxyquire("../../helper/import", {
      "fs-extra": {
        createReadStream: sinon.stub().returns(new ObjectReadableMock(csvNoHeaderInput)),
      },
    });

    const instance: ImportHelper = new fileProxy.ImportHelper();
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, expectedEmptyArray);
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
    const result: IRecord[] = await instance.importCsv(csvFilePath);

    assert.isArray(result);
    assert.deepStrictEqual(result, expectedEmptyArray);
  });

});
