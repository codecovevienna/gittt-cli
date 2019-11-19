import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Start test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should start time tracking", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    const startTimerStub: SinonStub = sinon.stub().resolves();

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    mockedHelper.TimerHelper = class {
      public startTimer = startTimerStub;
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "start"];
    mockedApp.start();

    assert.isTrue(startTimerStub.called);
  });
});
