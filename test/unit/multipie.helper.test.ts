import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { FileHelper, MultipieHelper } from "../../helper";
import { IProject } from "../../interfaces";
import { emptyHelper } from "../helper";

const sandboxDir = "./sandbox";
const configDir: string = path.join(sandboxDir, ".git-time-tracker");
const configFileName = "config.json";
const timerFileName = "timer.json";
const projectsDir = "projects";

describe("MultipieHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should throw when multiple links are found", async function () {
    const mockedHelper: any = Object.assign({}, emptyHelper);

    mockedHelper.ConfigHelper = class {
      public static getInstance(): any { return new this() }
      public isInitialized = sinon.stub().resolves(true);
      public findLinksByProject = sinon.stub().resolves([{}, {}]);
    }
    const proxy: any = proxyquire("../../helper/multipie", {
      ".": mockedHelper,
    });

    const project = {
      meta: {
        host: "github.com",
        port: 10022,
      },
      name: "codecovevienna_gittt-cli",
      records: [],
    } as IProject;

    const multipieHelper = new proxy.MultipieHelper();
    try {
      await multipieHelper.getValidRoles(project);
    } catch (err: any) {
      expect(err.message).contains('Multiple multipie links found');
    }
  });

  it("should throw when no roleEndpoint exists", async function () {
    const mockedHelper: any = Object.assign({}, emptyHelper);

    mockedHelper.ConfigHelper = class {
      public static getInstance(): any { return new this() }
      public isInitialized = sinon.stub().resolves(true);
      public findLinksByProject = sinon.stub().resolves([
        {
          "host": "https://test.com",
          "endpoint": "/v1/publish",
          "linkType": "Multipie",
          "projectName": "asdf",
          "username": "asdf"
        }
      ]);
    }
    const proxy: any = proxyquire("../../helper/multipie", {
      ".": mockedHelper,
    });

    const project = {
      meta: {
        host: "github.com",
        port: 10022,
      },
      name: "codecovevienna_gittt-cli",
      records: [],
    } as IProject;

    const multipieHelper = new proxy.MultipieHelper();
    try {
      await multipieHelper.getValidRoles(project);
    } catch (err: any) {
      expect(err.message).contains('No role endpoint set');
    }
  });

  it("should return roles as choices", async function () {
    const mockedHelper: any = Object.assign({}, emptyHelper);

    mockedHelper.ConfigHelper = class {
      public static getInstance(): any { return new this() }
      public isInitialized = sinon.stub().resolves(true);
      public findLinksByProject = sinon.stub().resolves([
        {
          "host": "https://test.com",
          "endpoint": "/v1/publish",
          "roleEndpoint": "/v1/roles",
          "linkType": "Multipie",
          "projectName": "asdf",
          "username": "asdf"
        }
      ]);
    }
    const proxy: any = proxyquire("../../helper/multipie", {
      ".": mockedHelper,
    });

    const project = {
      name: "codecovevienna_gittt-cli",
      records: [],
    } as IProject;

    const multipieHelper = new proxy.MultipieHelper();

    const getRolesFromApiStub = sinon.stub(multipieHelper, "getRolesFromApi").resolves(["?", "1"]);

    const roles = await multipieHelper.getValidRoles(project);
    assert.isTrue(getRolesFromApiStub.calledOnce);

    expect(roles).to.deep.eq([
      {
        name: '?',
        value: '?'
      },
      {
        name: '1',
        value: '1'
      }
    ]);
  });

  it("should return roles as choices containing oldRole", async function () {
    const mockedHelper: any = Object.assign({}, emptyHelper);

    mockedHelper.ConfigHelper = class {
      public static getInstance(): any { return new this() }
      public isInitialized = sinon.stub().resolves(true);
      public findLinksByProject = sinon.stub().resolves([
        {
          "host": "https://test.com",
          "endpoint": "/v1/publish",
          "roleEndpoint": "/v1/roles",
          "linkType": "Multipie",
          "projectName": "asdf",
          "username": "asdf"
        }
      ]);
    }
    const proxy: any = proxyquire("../../helper/multipie", {
      ".": mockedHelper,
    });

    const project = {
      name: "codecovevienna_gittt-cli",
      records: [],
    } as IProject;

    const multipieHelper = new proxy.MultipieHelper();

    const getRolesFromApiStub = sinon.stub(multipieHelper, "getRolesFromApi").resolves(["?", "1"]);

    const roles = await multipieHelper.getValidRoles(project, 'old');
    assert.isTrue(getRolesFromApiStub.calledOnce);

    expect(roles).to.deep.eq([
      {
        name: 'old',
        value: 'old'
      },
      {
        name: '?',
        value: '?'
      },
      {
        name: '1',
        value: '1'
      }
    ]);
  });
});
