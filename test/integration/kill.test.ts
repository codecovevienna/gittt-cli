import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Kill test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should kill time tracking", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const killTimerStub: SinonStub = sinon.stub().resolves();

    // const proxy: any = proxyquire("../../app", {
    //   "./helper": {
    //     FileHelper: function FileHelper(): any {
    //       return {
    //         configDirExists: sinon.stub().resolves(true),
    //       };
    //     },
    //     GitHelper: function GitHelper(): any {
    //       return {};
    //     },
    //     ImportHelper: function ImportHelper(): any {
    //       return {};
    //     },
    //     LogHelper,
    //     ProjectHelper: function ProjectHelper(): any {
    //       return {};
    //     },
    //     TimerHelper: function TimerHelper(): any {
    //       return {
    //         killTimer: killTimerStub,
    //       };
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

    mockedHelper.TimerHelper = class {
      public killTimer = killTimerStub;
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

    process.argv = ["namespace", "mocked", "stop", "-k"];
    mockedApp.start();

    assert.isTrue(killTimerStub.calledOnce);
  });
});
