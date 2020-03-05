import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Export test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should export records", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
    }

    mockedHelper.ConfigHelper = class {
      public isInitialized = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });

    const mockedApp: App = new proxy.App();

    const exportActionStub = sinon.stub(mockedApp, "exportAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "export"];
    mockedApp.start();

    assert.isTrue(exportActionStub.calledOnce);
  });
});
