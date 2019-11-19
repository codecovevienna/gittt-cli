import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";
import { RECORD_TYPES } from "../../types";

describe("List test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should list projects", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const findProjectByNameStub: SinonStub = sinon.stub().resolves(
      {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "mocked_project",
        records: [
          {
            amount: 2,
            created: 1572346125890,
            end: 1572346125745,
            guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb8",
            message: "A mocked message",
            type: RECORD_TYPES.Time,
            updated: 1572346125890,
          },
          {
            amount: 2.5,
            created: 1571323193712,
            end: 1571323193545,
            guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600290",
            message: "Some other mocked message",
            type: "Time",
            updated: 1571323193712,
          },
        ],
      },
    );
    const getProjectFromGitStub: SinonStub = sinon.stub().resolves(
      {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "mocked_project",
        records: [
          {
            amount: 2,
            created: 1572346125890,
            end: 1572346125745,
            guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb8",
            message: "A mocked message",
            type: RECORD_TYPES.Time,
            updated: 1572346125890,
          },
          {
            amount: 2.5,
            created: 1571323193712,
            end: 1571323193545,
            guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600290",
            message: "Some other mocked message",
            type: "Time",
            updated: 1571323193712,
          },
        ],
      },
    );

    const proxy: any = proxyquire("../../app", {
      "./helper": {
        FileHelper: function FileHelper(): any {
          return {
            configDirExists: sinon.stub().resolves(true),
            findProjectByName: findProjectByNameStub,
          };
        },
        GitHelper: function GitHelper(): any {
          return {};
        },
        ImportHelper: function ImportHelper(): any {
          return {};
        },
        LogHelper,
        ProjectHelper: function ProjectHelper(): any {
          return {
            getProjectFromGit: getProjectFromGitStub,
          };
        },
        TimerHelper: function TimerHelper(): any {
          return {};
        },
      },
      "commander": mockedCommander,
    });
    const mockedApp: App = new proxy.App();

    sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "list"];
    mockedApp.start();

    assert.isTrue(findProjectByNameStub.called);
    assert.isTrue(getProjectFromGitStub.called);
  });
});
