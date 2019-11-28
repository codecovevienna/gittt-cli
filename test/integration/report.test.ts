import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Report test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should call report Action", async () => {
    const mockedHelper: any = Object.assign({}, emptyHelper);
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedChartStub: SinonStub = sinon.stub();

    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    mockedHelper.ChartHelper = class {
      public static chart = sinon.stub();
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });

    const mockedApp: App = new proxy.App();

    const reportActionStub: SinonStub = sinon.stub(mockedApp, "reportAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "report"];
    mockedApp.start();

    assert.isTrue(reportActionStub.calledOnce);
  });
});
