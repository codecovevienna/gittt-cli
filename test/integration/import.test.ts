import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";
import { emptyHelper } from "../helper";

describe("Import test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should import from csv", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static isFile = sinon.stub().resolves("/path");
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

    const importActionStub: SinonStub = sinon.stub(mockedApp, "importCsv").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "import"];
    mockedApp.start();

    assert.isTrue(importActionStub.calledOnce);
  });
});
