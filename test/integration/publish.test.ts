import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Publish test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should publish records to external tool", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);


    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });


    const mockedApp: App = new proxy.App();

    const publishActionStub: SinonStub = sinon.stub(mockedApp, "publishAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "publish"];
    mockedApp.start();

    assert.isTrue(publishActionStub.calledOnce);
  });
});
