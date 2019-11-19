import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import { DefaultLogFields } from "simple-git/typings/response";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Log test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should log local changes", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const logChangesStub: SinonStub = sinon.stub().resolves([
      {
        author_email: "mock@mail.com",
        author_name: "mockAuthor",
        body: "mockedBody",
        date: "1.1.1970",
        hash: "mockedHash",
        message: "mockMessage",
        refs: "mockedRefs",
      } as DefaultLogFields,
    ]);

    // const proxy: any = proxyquire("../../app", {
    //   "./helper": {
    //     FileHelper: function FileHelper(): any {
    //       return {
    //         configDirExists: sinon.stub().resolves(true),
    //       };
    //     },
    //     GitHelper: function GitHelper(): any {
    //       return {
    //         logChanges: logChangesStub,
    //       };
    //     },
    //     ImportHelper: function ImportHelper(): any {
    //       return {};
    //     },
    //     LogHelper,
    //     ProjectHelper: function ProjectHelper(): any {
    //       return {};
    //     },
    //     TimerHelper: function TimerHelper(): any {
    //       return {};
    //     },
    //   },
    //   "commander": mockedCommander,
    // });

    const mockedHelper: any = Object.assign({}, emptyHelper);

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    mockedHelper.GitHelper = class {
      public logChanges = logChangesStub;
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    // sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    // sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "log"];
    mockedApp.start();

    assert.isTrue(logChangesStub.called);
  });

  it("should log everything up to date", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const logChangesStub: SinonStub = sinon.stub().resolves([]);

    // const proxy: any = proxyquire("../../app", {
    //   "./helper": {
    //     FileHelper: function FileHelper(): any {
    //       return {
    //         configDirExists: sinon.stub().resolves(true),
    //       };
    //     },
    //     GitHelper: function GitHelper(): any {
    //       return {
    //         logChanges: logChangesStub,
    //       };
    //     },
    //     ImportHelper: function ImportHelper(): any {
    //       return {};
    //     },
    //     LogHelper,
    //     ProjectHelper: function ProjectHelper(): any {
    //       return {};
    //     },
    //     TimerHelper: function TimerHelper(): any {
    //       return {};
    //     },
    //   },
    //   "commander": mockedCommander,
    // });

    const mockedHelper: any = Object.assign({}, emptyHelper);

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    mockedHelper.GitHelper = class {
      public logChanges = logChangesStub;
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    // sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    // sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "log"];
    mockedApp.start();

    assert.isTrue(logChangesStub.called);
  });
});
