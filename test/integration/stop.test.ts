import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { IProject } from "../../interfaces";
import { emptyHelper } from "../helper";

describe("Stop test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should stop time tracking", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    const stopActionStub: SinonStub = sinon.stub(mockedApp, "stopAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "stop", "-m", "mock"];
    mockedApp.start();

    assert.isTrue(stopActionStub.calledOnce);
  });
});
