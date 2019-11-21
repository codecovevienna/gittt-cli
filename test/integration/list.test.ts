import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { RECORD_TYPES } from "../../types";
import { emptyHelper } from "../helper";
import { IProject } from "../../interfaces";

describe("List test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should list projects", async () => {
    const mockedHelper: any = Object.assign({}, emptyHelper);
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
            type: RECORD_TYPES.Time,
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
            type: RECORD_TYPES.Time,
            updated: 1571323193712,
          },
        ],
      },
    );

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
      public findProjectByName = findProjectByNameStub;
    }

    mockedHelper.ProjectHelper = class {
      public getProjectFromGit = getProjectFromGitStub;
      public getOrAskForProjectFromGit = sinon.stub().resolves(
        {
          meta: {
            host: "",
            port: 0,
          },
          name: "mocked",
          records: [],
        } as IProject
      );
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "list"];
    mockedApp.start();

    assert.isTrue(findProjectByNameStub.called);
    assert.isTrue(getProjectFromGitStub.called);
  });
});
