import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Unknown command test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should show help", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    const helpStub: SinonStub = sinon.stub(mockedCommander, "help");

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

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "unknown"];
    mockedApp.start();

    assert.isTrue(helpStub.called);
  });
});
