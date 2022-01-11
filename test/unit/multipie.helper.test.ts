import { assert, expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { IMultipieLink, IMultipieRolesResult, IProject } from "../../interfaces";
import { emptyHelper } from "../helper";
import { IRecord } from '../../interfaces/index';

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

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const multipieHelper = new proxy.MultipieHelper();
      try {
        await multipieHelper.getValidRoles(project, record);
      } catch (err: any) {
        expect(err.message).contains('Multiple multipie links found');
      }
    });

    it("should throw when no rolesEndpoint exists", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.ConfigHelper = class {
        public static getInstance(): any { return new this() }
        public isInitialized = sinon.stub().resolves(true);
        public findLinksByProject = sinon.stub().resolves([
          {
            endpoint: "https://test.com/v1/publish",
            linkType: "Multipie",
            projectName: "asdf",
            username: "asdf"
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

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const multipieHelper = new proxy.MultipieHelper();
      try {
        await multipieHelper.getValidRoles(project, record);
      } catch (err: any) {
        expect(err.message).contains('No roles endpoint set');
      }
    });

    it("should return roles as choices", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.ConfigHelper = class {
        public static getInstance(): any { return new this() }
        public isInitialized = sinon.stub().resolves(true);
        public findLinksByProject = sinon.stub().resolves([
          {
            endpoint: "https://test.com/v1/publish",
            rolesEndpoint: "https://test.com/v1/roles",
            linkType: "Multipie",
            projectName: "asdf",
            username: "asdf"
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

      const getRolesFromApiStub = sinon.stub(multipieHelper, "getRolesFromApi")
        .resolves([
          {
            role: "1"
          }
        ]);

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const roles = await multipieHelper.getValidRoles(project, record);
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
            endpoint: "https://test.com/v1/publish",
            rolesEndpoint: "https://test.com/v1/roles",
            linkType: "Multipie",
            projectName: "asdf",
            username: "asdf"
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

      const getRolesFromApiStub = sinon.stub(multipieHelper, "getRolesFromApi")
        .resolves([
          {
            role: "1"
          }
        ]);

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const roles = await multipieHelper.getValidRoles(project, record, 'old');
      assert.isTrue(getRolesFromApiStub.calledOnce);

      expect(roles).to.deep.eq([
        {
          name: 'old',
          value: 'old'
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
          data: [
            {
              role: 'test_role',
              /* eslint-disable @typescript-eslint/naming-convention */
              start_date: "2021-01-01",
              end_date: "2025-01-01",
              /* eslint-enable @typescript-eslint/naming-convention */
              factor: "1.0000"
            }
          ]
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
        endpoint: 'endpoint',
        rolesEndpoint: 'roles',
        clientSecret: 'secret',
        username: 'username',
      } as IMultipieLink;

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const multipieHelper = new multipieProxy.MultipieHelper();
      const roles = await multipieHelper.getRolesFromApi(link, record);
      expect(roles).to.deep.eq([
        {
          role: 'test_role',
          /* eslint-disable @typescript-eslint/naming-convention */
          start_date: "2021-01-01",
          end_date: "2025-01-01",
          /* eslint-enable @typescript-eslint/naming-convention */
          factor: "1.0000"
        }
      ]);
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
          data: [
            {
              role: 'test_role',
              /* eslint-disable @typescript-eslint/naming-convention */
              start_date: "2021-01-01",
              end_date: "2025-01-01",
              /* eslint-enable @typescript-eslint/naming-convention */
              factor: "1.0000"
            }
          ]
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
        endpoint: 'endpoint',
        rolesEndpoint: 'roles',
        clientSecret: 'secret',
        refreshToken: 'token',
      } as IMultipieLink;

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const multipieHelper = new multipieProxy.MultipieHelper();
      const roles = await multipieHelper.getRolesFromApi(link, record);
      expect(roles).to.deep.eq([
        {
          role: 'test_role',
          /* eslint-disable @typescript-eslint/naming-convention */
          start_date: "2021-01-01",
          end_date: "2025-01-01",
          /* eslint-enable @typescript-eslint/naming-convention */
          factor: "1.0000"
        }
      ]);
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
        endpoint: 'endpoint',
        rolesEndpoint: 'roles',
        clientSecret: 'secret',
      } as IMultipieLink;

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const multipieHelper = new multipieProxy.MultipieHelper();
      try {
        await multipieHelper.getRolesFromApi(link, record);
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
        endpoint: 'endpoint',
        rolesEndpoint: 'roles',
        clientSecret: 'secret',
        refreshToken: 'token',
      } as IMultipieLink;

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const multipieHelper = new multipieProxy.MultipieHelper();
      try {
        await multipieHelper.getRolesFromApi(link, record);
      } catch (err: any) {
        expect(err.message).contains('Loading roles request failed');
      }
    });

    it("should return empty roles without correct data", async function () {
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
          success: false,
          message: "Mocked error"
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
        endpoint: 'endpoint',
        rolesEndpoint: 'roles',
        clientSecret: 'secret',
        username: 'username',
      } as IMultipieLink;

      const record = {
        amount: 69,
        end: Date.now()
      } as IRecord

      const multipieHelper = new multipieProxy.MultipieHelper();
      const roles = await multipieHelper.getRolesFromApi(link, record);
      expect(roles.length).to.equals(0);
    });
  });
});
