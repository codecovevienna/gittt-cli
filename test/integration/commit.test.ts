import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Commit test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should commit hours", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    const addRecordStub: SinonStub = sinon.stub().resolves();

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }
    mockedHelper.ProjectHelper = class {
      public addRecordToProject = addRecordStub
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "commit", "1337"];
    mockedApp.start();

    assert.isTrue(addRecordStub.called);
  });

  it("should fail to commit hours", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});

    // tslint:disable
    emptyHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": emptyHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "commit", "noNumber"];
    mockedApp.start();

    assert.isTrue(exitStub.calledOnce);
  });
});
