import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { IInitAnswers, IProject, IRecord } from "../../interfaces";
import { emptyHelper } from "../helper";

describe("Commit test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should call commit action", async () => {
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

    const commitActionStub: SinonStub = sinon.stub(mockedApp, "commitAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "commit", "1337"];
    mockedApp.start();

    assert.isTrue(commitActionStub.calledOnce);
  });
});
