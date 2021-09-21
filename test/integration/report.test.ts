import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Report test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should call report Action", async function () {
    const mockedHelper: any = Object.assign({}, emptyHelper);
    const mockedCommander: CommanderStatic = proxyquire("commander", {});

    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
    }

    mockedHelper.ConfigHelper = class {
      public static instance: any;
      public static getInstance(): any { if (!this.instance) { this.instance = new this() } return this.instance }
      public isInitialized = sinon.stub().resolves(true);
    }

    mockedHelper.ChartHelper = class {
      public static chart = sinon.stub();
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });

    const mockedApp: App = new proxy.App();

    const reportActionStub = sinon.stub(mockedApp, "reportAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "report"];
    mockedApp.start();

    assert.isTrue(reportActionStub.calledOnce);
  });
});
