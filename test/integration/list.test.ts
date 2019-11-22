import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("List test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should list projects", async function () {
    const mockedHelper: any = Object.assign({}, emptyHelper);
    const mockedCommander: CommanderStatic = proxyquire("commander", {});

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

    const listActionStub: SinonStub = sinon.stub(mockedApp, "listAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "list"];
    mockedApp.start();

    assert.isTrue(listActionStub.calledOnce);
  });
});
