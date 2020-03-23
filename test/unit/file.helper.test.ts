import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { FileHelper, LogHelper } from "../../helper/index";
import { IConfigFile, IProject, IProjectMeta, ITimerFile } from "../../interfaces";
import { RECORD_TYPES } from "../../types";

const configDir: string = path.join("mocked", ".git-time-tracker");
const configFileName = "config.json";
const projectsDir = "projects";
const timerFileName = "timer.json";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("FileHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  describe("Is file", function () {
    it("should validate file", async function () {
      const proxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          accessSync: sinon.stub().returns(true),
          statSync: sinon.stub()
            .returns({
              isFile: true,
            }),
        },
      });
      assert.isTrue(proxy.FileHelper.isFile("/tmp/mocked"));
    });

    it("should fail to validate file [file not readable]", async function () {
      const proxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          accessSync: sinon.stub().throws(new Error("File is not readable")),
          statSync: sinon.stub()
            .returns({
              isFile: true,
            }),
        },
      });
      assert.isFalse(proxy.FileHelper.isFile("/tmp/mocked"));
    });

    it("should fail to validate file [no file]", async function () {
      const proxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          accessSync: sinon.stub().returns(true),
          statSync: sinon.stub()
            .returns({
              isFile: false,
            }),
        },
      });
      assert.isFalse(proxy.FileHelper.isFile("/tmp/mocked"));
    });
  });

  describe("Get home directory", function () {
    it("should get home directory [from os]", async function () {
      const proxy: any = proxyquire("../../helper/file", {
        os: {
          homedir: sinon.stub().returns("/home/test"),
        },
      });

      // const app: App = new proxy.App();
      const homeDir: string = proxy.FileHelper.getHomeDir();

      expect(homeDir).to.eq("/home/test");
    });

    it("should get home directory [from process.env.HOME]", async function () {
      const proxy: any = proxyquire("../../helper/file", {
        os: {
          homedir: sinon.stub().returns(undefined),
        },
      });

      process.env.HOME = "/home/test";

      const homeDir: string = proxy.FileHelper.getHomeDir();

      expect(homeDir).to.eq("/home/test");

      delete process.env.HOME;
    });

    it("should get home directory [from process.env.HOMEPATH]", async function () {
      const proxy: any = proxyquire("../../helper/file", {
        os: {
          homedir: sinon.stub().returns(undefined),
        },
      });

      process.env.HOMEPATH = "/home/test";

      const homeDir: string = proxy.FileHelper.getHomeDir();

      expect(homeDir).to.eq("/home/test");

      delete process.env.HOMEPATH;
    });

    it("should get home directory [from process.env.USERPROFIL]", async function () {
      const proxy: any = proxyquire("../../helper/file", {
        os: {
          homedir: sinon.stub().returns(undefined),
        },
      });

      process.env.USERPROFIL = "/home/test";

      const homeDir: string = proxy.FileHelper.getHomeDir();

      expect(homeDir).to.eq("/home/test");

      delete process.env.USERPROFIL;
    });

    it("should fail to get home directory", async function () {
      const homedirStub = sinon.stub().returns(undefined);
      const proxy: any = proxyquire("../../helper/file", {
        os: {
          homedir: homedirStub,
        },
      });

      try {
        proxy.FileHelper.getHomeDir();
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(homedirStub.calledOnce);
    });
  });

  describe("General", function () {
    it("should create instance", async function () {
      const fileHelper: FileHelper = new FileHelper(configDir, configFileName, timerFileName, projectsDir);
      expect(fileHelper).to.be.instanceOf(FileHelper);
    });

    it("should initialize readme", async function () {
      const writeFileSpy = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeFile: writeFileSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      await instance.initReadme();

      assert.isTrue(writeFileSpy.calledOnce);
    });

    it("should fail to initialize readme", async function () {
      const writeFileSpy = sinon.stub().rejects();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeFile: writeFileSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      try {
        await instance.initReadme();
      } catch (err) {
        assert.isDefined(err);
      }
      assert.isTrue(writeFileSpy.calledOnce);
    });

    it("should invalidate cache", async function () {
      const writeJsonSpy = sinon.stub().resolves();
      const readJsonSpy = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonSpy,
          writeJson: writeJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      // Populate cache by initializing the config file
      const mockedConfig: IConfigFile = await instance.initConfigFile("ssh://git@mock.test.com:443/mocked/test.git");
      assert.isTrue(writeJsonSpy.calledOnce);

      const config: IConfigFile = await instance.getConfigObject();

      expect(config).to.deep.eq(mockedConfig);

      // Config loaded from cache, so no read file operation
      assert.isTrue(readJsonSpy.notCalled);

      instance.invalidateCache();

      await instance.getConfigObject();

      // After invalidating cache the config file has to be read from disk
      assert.isTrue(readJsonSpy.calledOnce);
    });
  });

  describe("Config file", function () {
    it("should create config directories", async function () {
      const ensureDirSyncSpy = sinon.spy();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          ensureDirSync: ensureDirSyncSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      await instance.createConfigDir();

      assert.isTrue(ensureDirSyncSpy.firstCall.calledWith(configDir));
      assert.isTrue(ensureDirSyncSpy.secondCall.calledWith(path.join(configDir, projectsDir)));
    });

    it("should init config file", async function () {
      const writeJsonSpy = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeJson: writeJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const gitUrl = "ssh://git@test.com/test/git-time-tracker.git";

      await instance.initConfigFile(gitUrl);

      assert.isTrue(writeJsonSpy.calledOnce);
    });

    it("should fail to init config file", async function () {
      const writeJsonSpy = sinon.stub().rejects(new Error("Mocked error"));
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeJson: writeJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const gitUrl = "ssh://git@test.com/test/git-time-tracker.git";

      try {
        await instance.initConfigFile(gitUrl);
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(writeJsonSpy.calledOnce);
    });

    it("should check validity of config file", async function () {
      const parseProjectNameFromGitUrlStub = sinon.stub().returns(true);
      const fileProxy: any = proxyquire("../../helper/file", {
        "./": {
          parseProjectNameFromGitUrl: parseProjectNameFromGitUrlStub,
          LogHelper
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      sinon.stub(instance, "getConfigObject").resolves({
        created: 1337,
        gitRepo: "ssh://git@mock.test.com:443/mocked/test.git",
        links: [],
      } as IConfigFile)

      assert.isTrue(await instance.isConfigFileValid());
      assert.isTrue(parseProjectNameFromGitUrlStub.calledOnce);
    });

    it("should check validity of config file [getConfigObject: throws]", async function () {
      const parseProjectNameFromGitUrlStub = sinon.stub().returns(true);
      const fileProxy: any = proxyquire("../../helper/file", {
        "./": {
          parseProjectNameFromGitUrl: parseProjectNameFromGitUrlStub,
          LogHelper
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      sinon.stub(instance, "getConfigObject").throws(new Error("Mocked error"))

      assert.isFalse(await instance.isConfigFileValid());
    });

    it("should check validity of config file [parseProjectNameFromGitUrl: throws]", async function () {
      const parseProjectNameFromGitUrlStub = sinon.stub().throws(new Error("Mocked error"))
      const fileProxy: any = proxyquire("../../helper/file", {
        "./": {
          parseProjectNameFromGitUrl: parseProjectNameFromGitUrlStub,
          LogHelper
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      sinon.stub(instance, "getConfigObject").resolves({
        created: 1337,
        gitRepo: "ssh://git@mock.test.com:443/mocked/test.git",
        links: [],
      } as IConfigFile)

      assert.isFalse(await instance.isConfigFileValid());
    });

    it("should check existence of config file", async function () {
      const pathExistsSpy = sinon.stub().resolves(true);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          pathExists: pathExistsSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const exists: boolean = await instance.configDirExists();

      assert.isTrue(exists);
      assert.isTrue(pathExistsSpy.calledOnce);
    });

    it("should fail to check existence of config file", async function () {
      const pathExistsSpy = sinon.stub().rejects(new Error("Mocked error"));
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          pathExists: pathExistsSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const exists: boolean = await instance.configDirExists();

      assert.isFalse(exists);
      assert.isTrue(pathExistsSpy.calledOnce);
    });

    it("should get config file as IConfigFile", async function () {
      const mockedConfig: IConfigFile = {
        created: 1337,
        gitRepo: "ssh://git@mock.test.com:443/mocked/test.git",
        links: [],
      };

      const readJsonSpy = sinon.stub().resolves(mockedConfig);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const config: IConfigFile = await instance.getConfigObject(true);

      expect(config).to.deep.eq(mockedConfig);
    });

    it("should get config file as IConfigFile from cache", async function () {
      const writeJsonSpy = sinon.stub().resolves();
      const readJsonSpy = sinon.stub();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonSpy,
          writeJson: writeJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      // Populate cache by initializing the config file
      const mockedConfig: IConfigFile = await instance.initConfigFile("ssh://git@mock.test.com:443/mocked/test.git");
      assert.isTrue(writeJsonSpy.calledOnce);

      const config: IConfigFile = await instance.getConfigObject();

      expect(config).to.deep.eq(mockedConfig);

      // Ensure that the config file is not read from disk
      assert.isTrue(readJsonSpy.notCalled);
    });

    it("should fail to get config file as IConfigFile", async function () {
      const readJsonSpy = sinon.stub().rejects(new Error("Mocked error"));
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      try {
        await instance.getConfigObject(true);
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(readJsonSpy.calledOnce);
    });
  });

  describe("Timer file", function () {
    it("should init timer file", async function () {
      const writeJsonStub = sinon.stub().resolves(true);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeJson: writeJsonStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      await instance.initTimerFile();

      assert.isTrue(writeJsonStub.calledOnce);
    });

    it("should fail to init timer file", async function () {
      const writeJsonStub = sinon.stub().rejects(new Error("Mocked error"));
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeJson: writeJsonStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      try {
        await instance.initTimerFile();
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(writeJsonStub.calledOnce);
    });

    it("should get timer object", async function () {
      const mockedTimerFile: ITimerFile = {
        start: 6,
        stop: 9,
      };

      const readJsonStub = sinon.stub().resolves(mockedTimerFile);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const timerFile: ITimerFile = await instance.getTimerObject();

      expect(timerFile).to.deep.eq(mockedTimerFile);
      assert.isTrue(readJsonStub.calledOnce);
    });

    it("should fail to get timer object", async function () {
      const readJsonStub = sinon.stub().rejects(new Error("Mocked error"));
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      try {
        await instance.getTimerObject();
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(readJsonStub.calledOnce);
    });

    it("should check if timer file exists [true]", async function () {
      const existsSyncStub = sinon.stub().returns(true);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          existsSync: existsSyncStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const exists: boolean = instance.timerFileExists();

      assert.isTrue(exists);
      assert.isTrue(existsSyncStub.calledOnce);
    });

    it("should check if timer file exists [false]", async function () {
      const existsSyncStub = sinon.stub().returns(false);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          existsSync: existsSyncStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const exists: boolean = instance.timerFileExists();

      assert.isFalse(exists);
      assert.isTrue(existsSyncStub.calledOnce);
    });

    it("should fail to check if timer file exists", async function () {
      const existsSyncStub = sinon.stub().throws(new Error("Mocked error"));
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          existsSync: existsSyncStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      try {
        instance.timerFileExists();
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(existsSyncStub.calledOnce);
    });

    it("should save timer object", async function () {
      const writeJsonStub = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeJson: writeJsonStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      await instance.saveTimerObject({
        start: 6,
        stop: 9,
      });

      assert.isTrue(writeJsonStub.calledOnce);
    });

    it("should fail to save timer object", async function () {
      const writeJsonStub = sinon.stub().rejects(new Error("Mocked error"));
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeJson: writeJsonStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      try {
        await instance.saveTimerObject({
          start: 6,
          stop: 9,
        });
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(writeJsonStub.calledOnce);
    });
  });

  describe("Project file", function () {
    it("should init project", async function () {
      const ensureDirSpy = sinon.spy();
      const writeJsonSpy = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          ensureDir: ensureDirSpy,
          writeJson: writeJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const project: IProject = {
        meta: {
          host: "mock.test.com",
          port: 443,
        },
        name: "Mocked",
        records: [],
      };

      await instance.initProject(project);

      assert.isTrue(ensureDirSpy.calledWith(path.join(configDir, projectsDir, "mock_test_com_443")));
      assert.isTrue(writeJsonSpy.calledOnce);
    });

    it("should fail to init project", async function () {
      const ensureDirSpy = sinon.stub().rejects(new Error("Mocked error"));
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          ensureDir: ensureDirSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const project: IProject = {
        meta: {
          host: "mock.test.com",
          port: 443,
        },
        name: "Mocked",
        records: [],
      };

      try {
        await instance.initProject(project);
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(ensureDirSpy.calledOnce);
    });

    it("should save project object", async function () {
      const writeJsonSpy = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeJson: writeJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const projectMeta: IProjectMeta = {
        host: "github.com",
        port: 22,
      };

      const project: IProject = {
        meta: projectMeta,
        name: "TestProject",
        records: [
          {
            amount: 1337,
            end: Date.now(),
            message: "TestMessage",
            type: RECORD_TYPES.Time,
          },
        ],
      };

      await instance.saveProjectObject(project);

      assert.isTrue(writeJsonSpy.calledOnce);
    });

    it("should fail to save project object", async function () {
      const writeJsonSpy = sinon.stub().rejects();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          writeJson: writeJsonSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const projectMeta: IProjectMeta = {
        host: "github.com",
        port: 22,
      };

      const project: IProject = {
        meta: projectMeta,
        name: "TestProject",
        records: [
          {
            amount: 1337,
            end: Date.now(),
            message: "TestMessage",
            type: RECORD_TYPES.Time,
          },
        ],
      };

      try {
        await instance.saveProjectObject(project);
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(writeJsonSpy.calledOnce);
    });

    it("should remove project file", async function () {
      const removeStub = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          remove: removeStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      await instance.removeProjectFile({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "mocked_test",
      } as IProject);

      assert.isTrue(removeStub.calledOnce);
    });
  });

  describe("Get projects", function () {
    it("should get all projects", async function () {
      const readdirSyncSpy = sinon.stub()
        .onCall(0).returns([
          "domain_one_1",
          "domain_one_2",
        ])
        .onCall(1).returns([
          "mock_project_1",
          "mock_project_2",
        ])
        .onCall(2).returns([
          "mock_project_3",
        ]);
      const readJsonSpy = sinon.stub()
        .onCall(0).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_1",
          records: [],
        } as IProject)
        .onCall(1).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_2",
          records: [],
        } as IProject)
        .onCall(2).resolves({
          meta: {
            host: "domain.one",
            port: 2,
          },
          name: "mock_project_3",
          records: [],
        });
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonSpy,
          readdirSync: readdirSyncSpy,
          lstatSync: sinon.stub().returns({
            isFile: () => false,
          })
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const allProjects: IProject[] = await instance.findAllProjects();

      expect(allProjects.length).to.eq(3);

      assert.isTrue(readdirSyncSpy.calledThrice);
      assert.isTrue(readJsonSpy.calledThrice);
    });

    it("should get all projects of one domain", async function () {
      const readdirSyncSpy = sinon.stub()
        .onCall(0).returns([
          "mock_project_1",
          "mock_project_2",
        ]);
      const readJsonSpy = sinon.stub()
        .onCall(0).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_1",
          records: [],
        } as IProject)
        .onCall(1).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_2",
          records: [],
        } as IProject);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          pathExists: sinon.stub().resolves(true),
          readJson: readJsonSpy,
          readdirSync: readdirSyncSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const allProjects: IProject[] = await instance.findProjectsForDomain({
        host: "domain.one",
        port: 1,
      });

      expect(allProjects.length).to.eq(2);

      assert.isTrue(readdirSyncSpy.calledOnce);
      assert.isTrue(readJsonSpy.calledTwice);
    });

    it("should get no project of one domain", async function () {
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          pathExists: sinon.stub().resolves(false),
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const allProjects: IProject[] = await instance.findProjectsForDomain({
        host: "domain.one",
        port: 1,
      });

      expect(allProjects.length).to.eq(0);
    });
    it("should get one project by name", async function () {
      const projectToFind: IProject = {
        meta: {
          host: "domain.one",
          port: 2,
        },
        name: "mock_project_3",
        records: [],
      };

      const readdirSyncSpy = sinon.stub()
        .onCall(0).returns([
          "domain_one_1",
          "domain_one_2",
        ])
        .onCall(1).returns([
          "mock_project_1",
          "mock_project_2",
        ])
        .onCall(2).returns([
          "mock_project_3",
        ]);
      const readJsonSpy = sinon.stub()
        .onCall(0).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_1",
          records: [],
        } as IProject)
        .onCall(1).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_2",
          records: [],
        } as IProject)
        .onCall(2).resolves(projectToFind);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonSpy,
          readdirSync: readdirSyncSpy,
          lstatSync: sinon.stub().returns({
            isFile: () => false,
          })
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const foundProject: IProject | undefined = await instance.findProjectByName("mock_project_3");

      expect(foundProject).to.deep.eq(projectToFind);

      assert.isTrue(readdirSyncSpy.calledThrice);
      assert.isTrue(readJsonSpy.calledThrice);
    });

    it("should get one project by name and domain", async function () {
      const projectToFind: IProject = {
        meta: {
          host: "domain.one",
          port: 2,
        },
        name: "mock_project_3",
        records: [],
      };

      const readdirSyncSpy = sinon.stub()
        .onCall(0).returns([
          "mock_project_3",
        ]);
      const readJsonSpy = sinon.stub()
        .onCall(0).resolves(projectToFind);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          pathExists: sinon.stub().resolves(true),
          readJson: readJsonSpy,
          readdirSync: readdirSyncSpy,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const foundProject: IProject | undefined = await instance.findProjectByName("mock_project_3", {
        host: "domain_one_2",
        port: 2,
      });

      expect(foundProject).to.deep.eq(projectToFind);

      assert.isTrue(readdirSyncSpy.calledOnce);
      assert.isTrue(readJsonSpy.calledOnce);
    });

    it("should get no project", async function () {
      const readdirSyncSpy = sinon.stub()
        .onCall(0).returns([
          "domain_one_1",
        ])
        .onCall(1).returns([
          "mock_project_1",
        ]);
      const readJsonSpy = sinon.stub()
        .onCall(0).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_1",
          records: [],
        } as IProject);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          pathExists: sinon.stub().resolves(true),
          readJson: readJsonSpy,
          readdirSync: readdirSyncSpy,
          lstatSync: sinon.stub().returns({
            isFile: () => false,
          })
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const foundProject: IProject | undefined = await instance.findProjectByName("mock_project_0");

      assert.isUndefined(foundProject);

      assert.isTrue(readdirSyncSpy.calledTwice);
      assert.isTrue(readJsonSpy.calledOnce);
    });

    it("should fail to get duplicated project by name", async function () {
      const readdirSyncSpy = sinon.stub()
        .onCall(0).returns([
          "domain_one_1",
        ])
        .onCall(1).returns([
          "mock_project_1",
          "mock_project_1",
        ]);
      const readJsonSpy = sinon.stub()
        .onCall(0).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_1",
          records: [],
        } as IProject)
        .onCall(1).resolves({
          meta: {
            host: "domain.one",
            port: 1,
          },
          name: "mock_project_1",
          records: [],
        } as IProject);
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          readJson: readJsonSpy,
          readdirSync: readdirSyncSpy,
          lstatSync: sinon.stub().returns({
            isFile: () => false,
          })
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      try {
        await instance.findProjectByName("mock_project_1");
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(readdirSyncSpy.calledTwice);
      assert.isTrue(readJsonSpy.calledTwice);
    });
  });

  describe("Domain directories", function () {
    it("should remove domain directory", async function () {
      const removeStub = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          remove: removeStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const findProjectsForDomainStub = sinon.stub(instance, "findProjectsForDomain").resolves([]);

      await instance.removeDomainDirectory({
        host: "github.com",
        port: 443,
      } as IProjectMeta);

      assert.isTrue(findProjectsForDomainStub.calledOnce);
      assert.isTrue(removeStub.calledOnce);
    });

    it("should remove domain directory [force]", async function () {
      const removeStub = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          remove: removeStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const findProjectsForDomainStub = sinon.stub(instance, "findProjectsForDomain").resolves([
        {
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "mocked_test",
        } as IProject,
      ]);

      await instance.removeDomainDirectory({
        host: "github.com",
        port: 443,
      } as IProjectMeta, true);

      assert.isTrue(findProjectsForDomainStub.calledOnce);
      assert.isTrue(removeStub.calledOnce);
    });

    it("should fail to remove domain directory [not empty]", async function () {
      const removeStub = sinon.stub().resolves();
      const fileProxy: any = proxyquire("../../helper/file", {
        "fs-extra": {
          remove: removeStub,
        },
      });

      const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

      const findProjectsForDomainStub = sinon.stub(instance, "findProjectsForDomain").resolves([
        {
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "mocked_test",
        } as IProject,
      ]);

      try {
        await instance.removeDomainDirectory({
          host: "github.com",
          port: 443,
        } as IProjectMeta);
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(findProjectsForDomainStub.calledOnce);
      assert.isTrue(removeStub.notCalled);
    });
  });
});
