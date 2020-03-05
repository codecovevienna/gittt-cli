import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Link test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should link project to external tool", async function () {
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

    const linkActionStub = sinon.stub(mockedApp, "linkAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "link"];
    mockedApp.start();

    assert.isTrue(linkActionStub.calledOnce);
  });
});
