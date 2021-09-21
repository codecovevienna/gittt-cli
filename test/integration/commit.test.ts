import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Commit test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should call commit action", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
    }

    mockedHelper.ConfigHelper = class {
      public static instance: any;
      public static getInstance(): any { if (!this.instance) { this.instance = new this() } return this.instance }
      public isInitialized = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });

    const mockedApp: App = new proxy.App();

    const commitActionStub = sinon.stub(mockedApp, "commitAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "commit", "1337"];
    mockedApp.start();

    assert.isTrue(commitActionStub.calledOnce);
  });
});
