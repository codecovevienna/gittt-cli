import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon, { SinonInspectable } from "sinon";
import { FileHelper, LogHelper } from "../../helper/index";
import { IConfigFile, IProject, IProjectMeta } from "../../interfaces";

const configDir: string = path.join("mocked", ".git-time-tracker");
const configFileName: string = "config.json";
const projectsDir: string = "projects";

LogHelper.silence = true;

describe("FileHelper", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should create instance", async () => {
    const fileHelper: FileHelper = new FileHelper(configDir, configFileName, projectsDir);
    expect(fileHelper).to.be.instanceOf(FileHelper);
  });

  it("should create config directories", async () => {
    const ensureDirSyncSpy: SinonInspectable = sinon.spy();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        ensureDirSync: ensureDirSyncSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    instance.createConfigDir();

    assert.isTrue(ensureDirSyncSpy.firstCall.calledWith(configDir));
    assert.isTrue(ensureDirSyncSpy.secondCall.calledWith(path.join(configDir, projectsDir)));
  });

  it("should init config file", async () => {
    const writeJsonSpy: SinonInspectable = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const gitUrl: string = "ssh://git@test.com/test/git-time-tracker.git";

    await instance.initConfigFile(gitUrl);

    assert.isTrue(writeJsonSpy.calledOnce);
  });

  it("should fail to init config file", async () => {
    const writeJsonSpy: SinonInspectable = sinon.stub().rejects(new Error("Mocked error"));
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const gitUrl: string = "ssh://git@test.com/test/git-time-tracker.git";

    try {
      await instance.initConfigFile(gitUrl);
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(writeJsonSpy.calledOnce);
  });

  it("should init project", async () => {
    const ensureDirSpy: SinonInspectable = sinon.spy();
    const writeJsonSpy: SinonInspectable = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        ensureDir: ensureDirSpy,
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

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
    const ensureDirSpy: SinonInspectable = sinon.stub().rejects(new Error("Mocked error"));
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        ensureDir: ensureDirSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

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

  it("should check existence of config file", async () => {
    const pathExistsSpy: SinonInspectable = sinon.stub().resolves(true);
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        pathExists: pathExistsSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const exists: boolean = await instance.configDirExists();

    assert.isTrue(exists);
    assert.isTrue(pathExistsSpy.calledOnce);
  });

  it("should fail to check existence of config file", async () => {
    const pathExistsSpy: SinonInspectable = sinon.stub().rejects(new Error("Mocked error"));
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        pathExists: pathExistsSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const exists: boolean = await instance.configDirExists();

    assert.isFalse(exists);
    assert.isTrue(pathExistsSpy.calledOnce);
  });

  it("should get config file as IConfigFile", async () => {
    const mockedConfig: IConfigFile = {
      created: 1337,
      gitRepo: "ssh://git@mock.test.com:443/mocked/test.git",
    };

    const readJsonSpy: SinonInspectable = sinon.stub().resolves(mockedConfig);
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        readJson: readJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const config: IConfigFile = await instance.getConfigObject(true);

    expect(config).to.deep.eq(mockedConfig);
  });

  it("should get config file as IConfigFile from cache", async () => {
    const writeJsonSpy: SinonInspectable = sinon.stub().resolves();
    const readJsonSpy: SinonInspectable = sinon.stub();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        readJson: readJsonSpy,
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    // Populate cache by initializing the config file
    const mockedConfig: IConfigFile = await instance.initConfigFile("ssh://git@mock.test.com:443/mocked/test.git");
    assert.isTrue(writeJsonSpy.calledOnce);

    const config: IConfigFile = await instance.getConfigObject();

    expect(config).to.deep.eq(mockedConfig);

    // Ensure that the config file is not read from disk
    assert.isTrue(readJsonSpy.notCalled);
  });

  it("should fail to get config file as IConfigFile", async () => {
    const readJsonSpy: SinonInspectable = sinon.stub().rejects(new Error("Mocked error"));
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        readJson: readJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    try {
      await instance.getConfigObject(true);
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(readJsonSpy.calledOnce);
  });

  it("should save project object", async () => {
    const writeJsonSpy: SinonInspectable = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

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
    const writeJsonSpy: SinonInspectable = sinon.stub().rejects();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

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
    const writeJsonSpy: SinonInspectable = sinon.stub().resolves();
    const readJsonSpy: SinonInspectable = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        readJson: readJsonSpy,
        writeJson: writeJsonSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

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

  it("should initialize readme", async () => {
    const writeFileSpy: SinonInspectable = sinon.stub().resolves();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeFile: writeFileSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    await instance.initReadme();

    assert.isTrue(writeFileSpy.calledOnce);
  });

  it("should fail to initialize readme", async () => {
    const writeFileSpy: SinonInspectable = sinon.stub().rejects();
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        writeFile: writeFileSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

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

    const readdirSyncSpy: SinonInspectable = sinon.stub()
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
    const readJsonSpy: SinonInspectable = sinon.stub()
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

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

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

    const readdirSyncSpy: SinonInspectable = sinon.stub()
      .onCall(0).returns([
        "mock_project_3",
      ]);
    const readJsonSpy: SinonInspectable = sinon.stub()
      .onCall(0).resolves(projectToFind);
    const fileProxy: any = proxyquire("../../helper/file", {
      "fs-extra": {
        pathExists: sinon.stub().resolves(true),
        readJson: readJsonSpy,
        readdirSync: readdirSyncSpy,
      },
    });

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const foundProject: IProject | undefined = await instance.findProjectByName("mock_project_3", {
      host: "domain_one_2",
      port: 2,
    });

    expect(foundProject).to.deep.eq(projectToFind);

    assert.isTrue(readdirSyncSpy.calledOnce);
    assert.isTrue(readJsonSpy.calledOnce);
  });

  it("should get no project", async () => {
    const readdirSyncSpy: SinonInspectable = sinon.stub()
      .onCall(0).returns([
        "domain_one_1",
      ])
      .onCall(1).returns([
        "mock_project_1",
      ]);
    const readJsonSpy: SinonInspectable = sinon.stub()
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

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const foundProject: IProject | undefined = await instance.findProjectByName("mock_project_0");

    assert.isUndefined(foundProject);

    assert.isTrue(readdirSyncSpy.calledTwice);
    assert.isTrue(readJsonSpy.calledOnce);
  });

  it("should fail to get duplicated project by name", async () => {
    const readdirSyncSpy: SinonInspectable = sinon.stub()
      .onCall(0).returns([
        "domain_one_1",
      ])
      .onCall(1).returns([
        "mock_project_1",
        "mock_project_1",
      ]);
    const readJsonSpy: SinonInspectable = sinon.stub()
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

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    try {
      await instance.findProjectByName("mock_project_1");
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(readdirSyncSpy.calledTwice);
    assert.isTrue(readJsonSpy.calledTwice);
  });

  it("should get all projects", async () => {
    const readdirSyncSpy: SinonInspectable = sinon.stub()
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
    const readJsonSpy: SinonInspectable = sinon.stub()
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

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const allProjects: IProject[] = await instance.findAllProjects();

    expect(allProjects.length).to.eq(3);

    assert.isTrue(readdirSyncSpy.calledThrice);
    assert.isTrue(readJsonSpy.calledThrice);
  });

  it("should get all projects of one domain", async () => {
    const readdirSyncSpy: SinonInspectable = sinon.stub()
      .onCall(0).returns([
        "mock_project_1",
        "mock_project_2",
      ]);
    const readJsonSpy: SinonInspectable = sinon.stub()
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

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

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

    const instance: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const allProjects: IProject[] = await instance.findProjectsForDomain({
      host: "domain.one",
      port: 1,
    });

    expect(allProjects.length).to.eq(0);
  });
});
