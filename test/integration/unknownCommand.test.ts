import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Unknown command test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should show help", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    const helpStub = sinon.stub(mockedCommander, "help");

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

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "unknown"];
    mockedApp.start();

    assert.isTrue(helpStub.called);
  });
});
