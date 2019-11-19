import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { ObjectReadableMock } from "stream-mock";
import { FileHelper, GitHelper, ImportHelper } from "../../helper";
import { IRecord } from "../../interfaces";

const sandboxDir: string = "./sandbox";
const configDir: string = path.join(sandboxDir, ".git-time-tracker");
const configFileName: string = "config.json";
const timerFileName: string = "timer.json";
const projectsDir: string = "projects";

const csvFilePath: string = "/path/to/csv/file.csv";
const csvCorrectInput: string = "AMOUNT,END,MESSAGE\n10,1556727733,Message Text\n1,1556723833,Message new Text";
const expectedCorrectOutput: IRecord[] = [{
  amount: 10,
  end: 1556727733,
  message: "Message Text",
  type: "Time",
},
{
  amount: 1,
  end: 1556723833,
  message: "Message new Text",
  type: "Time",
}];

const csvOnlyHeaderInput: string = "AMOUNT,END,MESSAGE";
const csvWrongSeparatorInput: string = "AMOUNT;END;MESSAGE\n10;1556727733;Message Text\n1;1556723833;Message new Text";
const csvMalformedDataInput: string = "AMOUNT,END,MESSAGE\n10,Message Text\n1,Hallo Test,Message new Text";
const csvMalformedHeaderInput: string = "amount,end,message\n10,1556727733,Message Text\n1,1556723833,Message new Text";
const csvNoHeaderInput: string = "10,1556727733,Message Text\n1,1556723833,Message new Text";
const csvBullshitInput: string = "ksdjf939jflwsfkdskjlfjlo3oqw9d92eijskljdjf apsflsflk jakjfieo jwfaksdjf  jfea fio";
const csvMissingColumnInput: string = "AMOUNT,MESSAGE\n10,Message Text\n1,Message new Text";

const expectedEmptyArray: IRecord[] = [];

describe("ImportHelper", () => {
  let mockedFileHelper: FileHelper;
  let mockedGitHelper: GitHelper;

  before(() => {
    proxyquire.noCallThru();

    const fileProxy: any = proxyquire("../../helper/file", {});
    const gitProxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (baseDir: string): any => {
        expect(baseDir).to.eq(configDir);
        return {};
      },
    });
    const projectProxy: any = proxyquire("../../helper/project", {});

    mockedFileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);
    mockedGitHelper = new gitProxy.GitHelper(configDir, mockedFileHelper);
  });

  it("should create instance", async () => {
    const importHelper: ImportHelper = new ImportHelper();
    expect(importHelper).to.be.instanceOf(ImportHelper);
  });

  it("should parse correct records", async () => {
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

  it("should fail due to only header", async () => {
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

  it("should fail due to wrong separator", async () => {
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

  it("should fail due to malformed data", async () => {
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

  it("should fail due to malformed header", async () => {
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

  it("should fail due to missing header", async () => {
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

  it("should fail due to bullshit data", async () => {
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

  it("should fail due to missing column", async () => {
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
