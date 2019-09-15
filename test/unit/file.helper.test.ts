import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon, { SinonSpy, SinonStub } from "sinon";
import { FileHelper, LogHelper } from "../../helper/index";
import { IConfigFile, IProject, IProjectMeta, ITimerFile } from "../../interfaces";

const configDir: string = path.join("mocked", ".git-time-tracker");
const configFileName: string = "config.json";
const projectsDir: string = "projects";
const timerFileName: string = "timer.json";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("FileHelper", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should create instance", async () => {
    const fileHelper: FileHelper = new FileHelper(configDir, configFileName, timerFileName, projectsDir);
    expect(fileHelper).to.be.instanceOf(FileHelper);
  });

  it("should create config directories", async () => {
    const ensureDirSyncSpy: SinonSpy = sinon.spy();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        ensureDirSync: ensureDirSyncSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    instance.createConfigDir();

    assert.isTrue(ensureDirSyncSpy.firstCall.calledWith(configDir));
    assert.isTrue(ensureDirSyncSpy.secondCall.calledWith(path.join(configDir, projectsDir)));
  });

  it("should init config file", async () => {
    const writeJsonSpy: SinonStub = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const gitUrl: string = "ssh://git@test.com/test/git-time-tracker.git";

    await instance.initConfigFile(gitUrl);

    assert.isTrue(writeJsonSpy.calledOnce);
  });

  it("should fail to init config file", async () => {
    const writeJsonSpy: SinonStub = sinon.stub().rejects(new Error("Mocked error"));
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const gitUrl: string = "ssh://git@test.com/test/git-time-tracker.git";

    try {
      await instance.initConfigFile(gitUrl);
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(writeJsonSpy.calledOnce);
  });

  it("should add link to config file", async () => {
    const writeJsonSpy: SinonStub = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const getConfigObjectStub: SinonStub = sinon.stub(instance, "getConfigObject").resolves({
      created: 1234,
      gitRepo: "ssh://mocked",
      links: [],
    });

    const updatedConfigFile: IConfigFile = await instance.addOrUpdateLink({
      linkType: "mock",
      projectName: "mocked",
    });

    expect(updatedConfigFile.links.length).to.eq(1);

    assert.isTrue(writeJsonSpy.calledOnce);
    assert.isTrue(getConfigObjectStub.calledOnce);
  });

  it("should update link in config file", async () => {
    const writeJsonSpy: SinonStub = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const getConfigObjectStub: SinonStub = sinon.stub(instance, "getConfigObject").resolves({
      created: 1234,
      gitRepo: "ssh://mocked",
      links: [
        {
          linkType: "mock",
          projectName: "mocked",
        },
      ],
    });

    const updatedConfigFile: IConfigFile = await instance.addOrUpdateLink({
      endpoint: "http://test.com/api",
      hash: "1234asdf",
      key: "test",
      linkType: "mock",
      projectName: "mocked",
      username: "mock",
    });

    expect(updatedConfigFile.links.length).to.eq(1);

    assert.isTrue(writeJsonSpy.calledOnce);
    assert.isTrue(getConfigObjectStub.calledOnce);
  });

  it("should init project", async () => {
    const ensureDirSpy: SinonSpy = sinon.spy();
    const writeJsonSpy: SinonStub = sinon.stub().resolves();
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

  it("should fail to init project", async () => {
    const ensureDirSpy: SinonStub = sinon.stub().rejects(new Error("Mocked error"));
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

  it("should init timer file", async () => {
    const writeJsonStub: SinonStub = sinon.stub().resolves(true);
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonStub,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    await instance.initTimerFile();

    assert.isTrue(writeJsonStub.calledOnce);
  });

  it("should fail to init timer file", async () => {
    const writeJsonStub: SinonStub = sinon.stub().rejects(new Error("Mocked error"));
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

  it("should check existence of config file", async () => {
    const pathExistsSpy: SinonStub = sinon.stub().resolves(true);
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

  it("should fail to check existence of config file", async () => {
    const pathExistsSpy: SinonStub = sinon.stub().rejects(new Error("Mocked error"));
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

  it("should get config file as IConfigFile", async () => {
    const mockedConfig: IConfigFile = {
      created: 1337,
      gitRepo: "ssh://git@mock.test.com:443/mocked/test.git",
      links: [],
    };

    const readJsonSpy: SinonStub = sinon.stub().resolves(mockedConfig);
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        readJson: readJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const config: IConfigFile = await instance.getConfigObject(true);

    expect(config).to.deep.eq(mockedConfig);
  });

  it("should get config file as IConfigFile from cache", async () => {
    const writeJsonSpy: SinonStub = sinon.stub().resolves();
    const readJsonSpy: SinonStub = sinon.stub();
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

  it("should fail to get config file as IConfigFile", async () => {
    const readJsonSpy: SinonStub = sinon.stub().rejects(new Error("Mocked error"));
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

  it("should check if timer file exists [true]", async () => {
    const existsSyncStub: SinonStub = sinon.stub().returns(true);
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

  it("should check if timer file exists [false]", async () => {
    const existsSyncStub: SinonStub = sinon.stub().returns(false);
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

  it("should fail to check if timer file exists", async () => {
    const existsSyncStub: SinonStub = sinon.stub().throws(new Error("Mocked error"));
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

  it("should save project object", async () => {
    const writeJsonSpy: SinonStub = sinon.stub().resolves();
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
          created: Date.now(),
          message: "TestMessage",
          type: "Time",
        },
      ],
    };

    await instance.saveProjectObject(project);

    assert.isTrue(writeJsonSpy.calledOnce);
  });

  it("should fail to save project object", async () => {
    const writeJsonSpy: SinonStub = sinon.stub().rejects();
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
          created: Date.now(),
          message: "TestMessage",
          type: "Time",
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

  it("should invalidate cache", async () => {
    const writeJsonSpy: SinonStub = sinon.stub().resolves();
    const readJsonSpy: SinonStub = sinon.stub().resolves();
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

  it("should get timer object", async () => {
    const mockedTimerFile: ITimerFile = {
      start: 6,
      stop: 9,
    };

    const readJsonStub: SinonStub = sinon.stub().resolves(mockedTimerFile);
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

  it("should fail to get timer object", async () => {
    const readJsonStub: SinonStub = sinon.stub().rejects(new Error("Mocked error"));
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

  it("should initialize readme", async () => {
    const writeFileSpy: SinonStub = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeFile: writeFileSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    await instance.initReadme();

    assert.isTrue(writeFileSpy.calledOnce);
  });

  it("should fail to initialize readme", async () => {
    const writeFileSpy: SinonStub = sinon.stub().rejects();
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

  it("should get one project by name", async () => {
    const projectToFind: IProject = {
      meta: {
        host: "domain.one",
        port: 2,
      },
      name: "mock_project_3",
      records: [],
    };

    const readdirSyncSpy: SinonStub = sinon.stub()
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
    const readJsonSpy: SinonStub = sinon.stub()
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
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const foundProject: IProject | undefined = await instance.findProjectByName("mock_project_3");

    expect(foundProject).to.deep.eq(projectToFind);

    assert.isTrue(readdirSyncSpy.calledThrice);
    assert.isTrue(readJsonSpy.calledThrice);
  });

  it("should get one project by name and domain", async () => {
    const projectToFind: IProject = {
      meta: {
        host: "domain.one",
        port: 2,
      },
      name: "mock_project_3",
      records: [],
    };

    const readdirSyncSpy: SinonStub = sinon.stub()
      .onCall(0).returns([
        "mock_project_3",
      ]);
    const readJsonSpy: SinonStub = sinon.stub()
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

  it("should get no project", async () => {
    const readdirSyncSpy: SinonStub = sinon.stub()
      .onCall(0).returns([
        "domain_one_1",
      ])
      .onCall(1).returns([
        "mock_project_1",
      ]);
    const readJsonSpy: SinonStub = sinon.stub()
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
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const foundProject: IProject | undefined = await instance.findProjectByName("mock_project_0");

    assert.isUndefined(foundProject);

    assert.isTrue(readdirSyncSpy.calledTwice);
    assert.isTrue(readJsonSpy.calledOnce);
  });

  it("should fail to get duplicated project by name", async () => {
    const readdirSyncSpy: SinonStub = sinon.stub()
      .onCall(0).returns([
        "domain_one_1",
      ])
      .onCall(1).returns([
        "mock_project_1",
        "mock_project_1",
      ]);
    const readJsonSpy: SinonStub = sinon.stub()
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

  it("should save timer object", async () => {
    const writeJsonStub: SinonStub = sinon.stub().resolves();
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

  it("should fail to save timer object", async () => {
    const writeJsonStub: SinonStub = sinon.stub().rejects(new Error("Mocked error"));
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

  it("should get all projects", async () => {
    const readdirSyncSpy: SinonStub = sinon.stub()
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
    const readJsonSpy: SinonStub = sinon.stub()
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
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const allProjects: IProject[] = await instance.findAllProjects();

    expect(allProjects.length).to.eq(3);

    assert.isTrue(readdirSyncSpy.calledThrice);
    assert.isTrue(readJsonSpy.calledThrice);
  });

  it("should get all projects of one domain", async () => {
    const readdirSyncSpy: SinonStub = sinon.stub()
      .onCall(0).returns([
        "mock_project_1",
        "mock_project_2",
      ]);
    const readJsonSpy: SinonStub = sinon.stub()
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

  it("should get no project of one domain", async () => {
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
});
