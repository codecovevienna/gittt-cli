import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { FileHelper, MultipieHelper } from "../../helper";
import { IMultipieLink, IMultipieRolesResult, IProject } from "../../interfaces";
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
  describe("getValidRoles", function () {
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
  describe("getRolesFromApi", function () {
    it("should load roles with legacyAuth", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.ConfigHelper = class {
        public static getInstance(): any { return new this() }
        public isInitialized = sinon.stub().resolves(true);
        public findLinksByProject = sinon.stub().resolves([{}, {}]);
      }
      mockedHelper.AuthHelper = class {
        public getLegacyAuth = () => {
          return "19666a4f-32dd-4049-b082-684c74115f28";
        }
      }
      const axiosGetStub = sinon.stub().resolves({
        status: 200,
        data: {
          success: true,
          data: {
            roles: ['test_role'],
          }
        } as IMultipieRolesResult,
      });
      const multipieProxy: any = proxyquire("../../helper/multipie", {
        ".": mockedHelper,
        "axios": {
          get: axiosGetStub,
        },
      });

      const link = {
        projectName: 'project',
        linkType: 'Multipie',
        host: 'https://test.com',
        endpoint: 'endpoint',
        roleEndpoint: 'roles',
        clientSecret: 'secret',
        username: 'username',
      } as IMultipieLink;

      const multipieHelper = new multipieProxy.MultipieHelper();
      const roles = await multipieHelper.getRolesFromApi(link);
      expect(roles.length).to.equals(1);
      expect(roles[0]).to.equals('test_role');
    });

    it("should load roles with OAuth", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.ConfigHelper = class {
        public static getInstance(): any { return new this() }
        public isInitialized = sinon.stub().resolves(true);
        public findLinksByProject = sinon.stub().resolves([{}, {}]);
      }
      mockedHelper.AuthHelper = class {
        public getAuthClient = () => {
          return {
            createToken: sinon.stub().resolves({
              refresh: sinon.stub().resolves({
                accessToken: "mocked"
              })
            })
          }
        }
      }
      const axiosGetStub = sinon.stub().resolves({
        status: 200,
        data: {
          success: true,
          data: {
            roles: ['test_role'],
          }
        } as IMultipieRolesResult,
      });
      const multipieProxy: any = proxyquire("../../helper/multipie", {
        ".": mockedHelper,
        "axios": {
          get: axiosGetStub,
        },
      });

      const link = {
        projectName: 'project',
        linkType: 'Multipie',
        host: 'https://test.com',
        endpoint: 'endpoint',
        roleEndpoint: 'roles',
        clientSecret: 'secret',
        refreshToken: 'token',
      } as IMultipieLink;

      const multipieHelper = new multipieProxy.MultipieHelper();
      try {
        const roles = await multipieHelper.getRolesFromApi(link);
        expect(roles.length).to.equals(1);
        expect(roles[0]).to.equals('test_role');
      } catch (err) {
        console.log(err);
      }
    });

    it("should throw without refreshToken", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.ConfigHelper = class {
        public static getInstance(): any { return new this() }
        public isInitialized = sinon.stub().resolves(true);
        public findLinksByProject = sinon.stub().resolves([{}, {}]);
      }
      mockedHelper.AuthHelper = class {
        public getAuthClient = () => {
          return {
            createToken: sinon.stub().resolves({
              refresh: sinon.stub().resolves({
                accessToken: "mocked"
              })
            })
          }
        }
      }
      const multipieProxy: any = proxyquire("../../helper/multipie", {
        ".": mockedHelper,
      });

      const link = {
        projectName: 'project',
        linkType: 'Multipie',
        host: 'https://test.com',
        endpoint: 'endpoint',
        roleEndpoint: 'roles',
        clientSecret: 'secret',
      } as IMultipieLink;

      const multipieHelper = new multipieProxy.MultipieHelper();
      try {
        await multipieHelper.getRolesFromApi(link);
      } catch (err: any) {
        expect(err.message).contains('Unable to find refresh token for this project');
      }
    });


    it("should throw when request fails", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.ConfigHelper = class {
        public static getInstance(): any { return new this() }
        public isInitialized = sinon.stub().resolves(true);
        public findLinksByProject = sinon.stub().resolves([{}, {}]);
      }
      mockedHelper.AuthHelper = class {
        public getAuthClient = () => {
          return {
            createToken: sinon.stub().resolves({
              refresh: sinon.stub().resolves({
                accessToken: "mocked"
              })
            })
          }
        }
      }
      const axiosGetStub = sinon.stub().throws(new Error("Mocked Error"));
      const multipieProxy: any = proxyquire("../../helper/multipie", {
        ".": mockedHelper,
        "axios": {
          get: axiosGetStub,
        },
      });

      const link = {
        projectName: 'project',
        linkType: 'Multipie',
        host: 'https://test.com',
        endpoint: 'endpoint',
        roleEndpoint: 'roles',
        clientSecret: 'secret',
        refreshToken: 'token',
      } as IMultipieLink;

      const multipieHelper = new multipieProxy.MultipieHelper();
      try {
        await multipieHelper.getRolesFromApi(link);
      } catch (err: any) {
        expect(err.message).contains('Loading roles request failed');
      }
    });
  });
});
