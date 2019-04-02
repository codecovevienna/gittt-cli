import { assert, expect } from "chai"
import { FileHelper, LogHelper } from "../../helper/index"
import fs from "fs-extra";
import path from "path";
import sinon from "sinon"
import proxyquire from "proxyquire"
import { IConfigFile, IProject, IProjectMeta } from "../../interfaces";

const sandboxDir = "./sandbox"
const configDir = path.join(sandboxDir, ".git-time-tracker");
const configFileName = "config.json"
const projectsDir = "projects"

describe.only("FileHelper", () => {
  before(async () => {
    // LogHelper.silence = true;
    // Create sandbox directory
    await fs.ensureDir(sandboxDir);
  })
  after(async () => {
    await fs.remove(sandboxDir)
  })

  it("should create instance", async () => {
    const fileHelper = new FileHelper(configDir, configFileName, projectsDir);
    assert.isTrue(fileHelper instanceof FileHelper);
  })

  it("should create config directories", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);

    await instance.createConfigDir()
    fs.pathExistsSync(configDir)
    fs.pathExistsSync(path.join(configDir, projectsDir))
  })

  it("should check existence of config file", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl)

    assert.isTrue(await instance.configFileExists())
  })

  it("should fail to check existence of config file", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        writeJson: sinon.stub().resolves(),
        ensureDirSync: sinon.stub().resolves(),
        pathExists: sinon.stub().rejects()
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl)

    assert.isFalse(await instance.configFileExists())
  })

  it("should initialize config file", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl)

    const configFile: IConfigFile = await fs.readJson(path.join(configDir, configFileName));
    expect(configFile.created).to.be.a("Number");
    expect(configFile.gitRepo).to.eq(gitUrl)
  })

  it("should fail to initialize config file [dir does not exist]", async () => {
    const instance = new FileHelper("./sandbox/none-existing", configFileName, projectsDir);

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl);
  })

  it("should get config file as IConfigFile", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const configObject = await instance.getConfigObject(true);

    assert.isDefined(configObject)
  })

  it("should get config file as IConfigFile from cache", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const configObject = await instance.getConfigObject();

    assert.isDefined(configObject)
  })

  it("should fail to get config file as IConfigFile", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        writeJson: sinon.stub().resolves(),
        ensureDirSync: sinon.stub().resolves(),
        readJson: sinon.stub().rejects()
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const configObject = await instance.getConfigObject(true);

    assert.isUndefined(configObject)
  })

  it("should get project object", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const projectMeta: IProjectMeta = {
      host: "github.com",
      port: 22,
      name: "TestProject",
    }

    await instance.initProject(projectMeta)

    const projectObject = await instance.getProjectObject(projectMeta)
    assert.isDefined(projectMeta)
  })

  it("should fail to get project object", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        writeJson: sinon.stub().resolves(),
        ensureDirSync: sinon.stub().resolves(),
        pathExists: sinon.stub().resolves(false)
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const projectMeta: IProjectMeta = {
      host: "github.com",
      port: 22,
      name: "TestProject",
    }

    const projectObject = await instance.getProjectObject(projectMeta)
    assert.isUndefined(projectObject)
  })

  it("should fail to get project object", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        writeJson: sinon.stub().resolves(),
        ensureDirSync: sinon.stub().resolves(),
        pathExists: sinon.stub()
          .onCall(0).resolves(true)
          .onCall(1).resolves(false)
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const projectMeta: IProjectMeta = {
      host: "github.com",
      port: 22,
      name: "TestProject",
    }

    const projectObject = await instance.getProjectObject(projectMeta)
    assert.isUndefined(projectObject)
  })

  it("should fail to get project object", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        writeJson: sinon.stub().resolves(),
        ensureDirSync: sinon.stub().resolves(),
        pathExists: sinon.stub().rejects()
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const projectMeta: IProjectMeta = {
      host: "github.com",
      port: 22,
      name: "TestProject",
    }

    const projectObject = await instance.getProjectObject(projectMeta)
    assert.isUndefined(projectObject)
  })

  it("should initialize project file", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const initialProject = await instance.initProject({
      host: "github.com",
      port: 22,
      name: "TestProject",
    })

    assert.isDefined(initialProject)

    const configFile: IProject = await fs.readJson(path.join(configDir, projectsDir, "github_com_22", "TestProject.json"));
    expect(configFile.name).to.eq("TestProject")
    expect(configFile.hours).to.be.an("Array")
  })

  it("should fail to initialize project file", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        writeJson: sinon.stub().resolves(),
        ensureDirSync: sinon.stub().resolves(),
        ensureDir: sinon.stub().rejects()
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
    await instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const initialProject = await instance.initProject({
      host: "github.com",
      port: 22,
      name: "TestProject",
    })

    assert.isUndefined(initialProject)
  })
})