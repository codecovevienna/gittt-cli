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

describe("FileHelper", () => {
  before(() => {
    LogHelper.silence = true;
  })

  beforeEach(async () => {
    // Create sandbox directory
    await fs.ensureDir(sandboxDir);
  })
  afterEach(async () => {
    await fs.remove(sandboxDir)
  })

  it("should create instance", async () => {
    const fileHelper = new FileHelper(configDir, configFileName, projectsDir);
    assert.isTrue(fileHelper instanceof FileHelper);
  })

  it("should create config directories", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    fs.pathExistsSync(configDir)
    fs.pathExistsSync(path.join(configDir, projectsDir))
  })

  it("should init config file", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl)
  })

  it("should fail to init config file", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        ensureDirSync: sinon.stub().resolves(),
        writeJson: sinon.stub().rejects(new Error("Mocked error")),
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    try {
      await instance.initConfigFile(gitUrl)
    } catch (err) {
      assert.isDefined(err)
    }
  })

  it("should check existence of config file", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl)

    assert.isTrue(await instance.configDirExists())
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
    instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl)

    assert.isFalse(await instance.configDirExists())
  })

  it("should initialize config file", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl)

    const configFile: IConfigFile = await fs.readJson(path.join(configDir, configFileName));
    expect(configFile.created).to.be.a("Number");
    expect(configFile.gitRepo).to.eq(gitUrl)
  })

  it("should fail to initialize config file [dir does not exist]", async () => {
    const instance = new FileHelper("./sandbox/none-existing", configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"

    await instance.initConfigFile(gitUrl);
  })

  it("should get config file as IConfigFile", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const configObject = await instance.getConfigObject(true);

    assert.isDefined(configObject)
  })

  it("should get config file as IConfigFile from cache", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

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
    instance.createConfigDir();

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    try {
      await instance.getConfigObject(true);
    } catch (err) {
      assert.isDefined(err)
    }
  })

  it("should save project object", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const projectMeta: IProjectMeta = {
      host: "github.com",
      port: 22,
    }

    const project: IProject = {
      meta: projectMeta,
      name: "TestProject",
      records: [
        {
          created: Date.now(),
          count: 1337,
          message: "TestMessage",
          type: "Hour"
        }
      ]
    }
    await instance.initProject(project)

    await instance.saveProjectObject(project)
    // TODO check?
  })

  it("should fail to save project object", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        ensureDir: sinon.stub().resolves(),
        ensureDirSync: sinon.stub().resolves(),
        writeJson: sinon.stub()
          // init config
          .onCall(0).resolves()
          // init project
          .onCall(1).resolves()
          // save object
          .onCall(2).rejects(),
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const projectMeta: IProjectMeta = {
      host: "github.com",
      port: 22,
    }

    const project: IProject = {
      meta: projectMeta,
      name: "TestProject",
      records: [
        {
          created: Date.now(),
          count: 1337,
          message: "TestMessage",
          type: "Hour"
        }
      ]
    }
    await instance.initProject(project)

    try {
      await instance.saveProjectObject(project, projectMeta)
    } catch (err) {
      assert.isDefined(err);
    }
  })

  it("should get invalidate config cache", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);

    await instance.invalidateCache()
    // TODO check if it worked?
  })

  it("should initialize readme", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    await instance.initReadme()

    const readmeFile = await fs.readFile(path.join(configDir, "README.md"), 'UTF-8');
    expect(readmeFile.length).to.be.greaterThan(0);
  })

  it("should fail to initialize readme", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        ensureDirSync: sinon.stub().resolves(),
        writeFile: sinon.stub().rejects()
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    try {
      await instance.initReadme()
    } catch (err) {
      assert.isDefined(err);
    }
  })

  // it("should get project object", async () => {
  //   const instance = new FileHelper(configDir, configFileName, projectsDir);
  //   instance.createConfigDir()

  //   const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
  //   await instance.initConfigFile(gitUrl)

  //   const projectMeta: IProjectMeta = {
  //     host: "github.com",
  //     port: 22,
  //     name: "TestProject",
  //   }

  //   await instance.initProject("TestProject", projectMeta)

  //   const projectObject = await instance.getProjectObject(projectMeta)
  //   assert.isDefined(projectObject)
  // })

  // it("should fail to get project object", async () => {
  //   const proxy = proxyquire.noCallThru().load("../../helper/file", {
  //     'fs-extra': {
  //       writeJson: sinon.stub().resolves(),
  //       ensureDirSync: sinon.stub().resolves(),
  //       pathExists: sinon.stub().resolves(false)
  //     },
  //   });

  //   const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
  //   instance.createConfigDir()

  //   const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
  //   await instance.initConfigFile(gitUrl)

  //   const projectMeta: IProjectMeta = {
  //     host: "github.com",
  //     port: 22,
  //     name: "TestProject",
  //   }

  //   const projectObject = await instance.getProjectObject(projectMeta)
  //   assert.isUndefined(projectObject)
  // })

  // it("should fail to get project object", async () => {
  //   const proxy = proxyquire.noCallThru().load("../../helper/file", {
  //     'fs-extra': {
  //       writeJson: sinon.stub().resolves(),
  //       ensureDirSync: sinon.stub().resolves(),
  //       pathExists: sinon.stub()
  //         .onCall(0).resolves(true)
  //         .onCall(1).resolves(false)
  //     },
  //   });

  //   const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
  //   instance.createConfigDir()

  //   const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
  //   await instance.initConfigFile(gitUrl)

  //   const projectMeta: IProjectMeta = {
  //     host: "github.com",
  //     port: 22,
  //     name: "TestProject",
  //   }

  //   const projectObject = await instance.getProjectObject(projectMeta)
  //   assert.isUndefined(projectObject)
  // })

  // it("should fail to get project object", async () => {
  //   const proxy = proxyquire.noCallThru().load("../../helper/file", {
  //     'fs-extra': {
  //       writeJson: sinon.stub().resolves(),
  //       ensureDirSync: sinon.stub().resolves(),
  //       pathExists: sinon.stub().rejects()
  //     },
  //   });

  //   const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);
  //   instance.createConfigDir()

  //   const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
  //   await instance.initConfigFile(gitUrl)

  //   const projectMeta: IProjectMeta = {
  //     host: "github.com",
  //     port: 22,
  //     name: "TestProject",
  //   }

  //   const projectObject = await instance.getProjectObject(projectMeta)
  //   assert.isUndefined(projectObject)
  // })

  it("should save config file", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    await instance.saveConfigObject({
      created: Date.now(),
      gitRepo: "ssh://git@test.com/test/git-time-tracker.git"
    })

    // TODO check?
  })

  it("should fail to save config file", async () => {
    const proxy = proxyquire.noCallThru().load("../../helper/file", {
      'fs-extra': {
        ensureDirSync: sinon.stub().resolves(),
        writeJson: sinon.stub().rejects(),
      },
    });

    const instance = new proxy.FileHelper(configDir, configFileName, projectsDir);

    try {
      await instance.saveConfigObject({
        created: Date.now(),
        gitRepo: "ssh://git@test.com/test/git-time-tracker.git"
      })
    } catch (err) {
      assert.isDefined(err);
    }
  })

  it("should get all projects", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    await instance.initProject({
      name: "TestProject0",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    await instance.initProject({
      name: "TestProject1",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    const list = await instance.findAllProjects()
    expect(list.length).to.eq(2);
  })

  it("should get all projects for one domain", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    await instance.initProject({
      name: "TestProject0",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    await instance.initProject({
      name: "TestProject1",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    await instance.initProject({
      name: "TestProject2",
      records: [],
      meta: {
        host: "gitlab.com",
        port: 33,
      }
    })

    const listGithub = await instance.findProjectsForDomain({
      host: "github.com",
      port: 22,
    })
    expect(listGithub.length).to.eq(2);

    const listGitlab = await instance.findProjectsForDomain({
      host: "gitlab.com",
      port: 33,
    })
    expect(listGitlab.length).to.eq(1);

    const listNonExists = await instance.findProjectsForDomain({
      host: "google.com",
      port: 44,
    })
    expect(listNonExists.length).to.eq(0);
  })

  it("should get one project by name", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    await instance.initProject({
      name: "TestProject0",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    await instance.initProject({
      name: "TestProject1",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    await instance.initProject({
      name: "TestProject2",
      records: [],
      meta: {
        host: "gitlab.com",
        port: 33,
      }
    })

    const project = await instance.findProjectByName("TestProject1")
    assert.isDefined(project)
    if (project) {
      expect(project.name).to.eq("TestProject1")
    }
  })

  it("should get one project by name and domain", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    await instance.initProject({
      name: "TestProject0",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    await instance.initProject({
      name: "TestProject1",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    await instance.initProject({
      name: "TestProject2",
      records: [],
      meta: {
        host: "gitlab.com",
        port: 33,
      }
    })

    const project = await instance.findProjectByName("TestProject1", {
      host: "github.com",
      port: 22,
    })
    assert.isDefined(project)
    if (project) {
      expect(project.name).to.eq("TestProject1")
    }
  })

  it("should fail to get duplicated project by name", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    await instance.initProject({
      name: "TestProject2",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    await instance.initProject({
      name: "TestProject2",
      records: [],
      meta: {
        host: "gitlab.com",
        port: 33,
      }
    })

    try {
      await instance.findProjectByName("TestProject2")
    } catch (err) {
      assert.isDefined(err)
    }
  })

  it("should fail to get non existing project by name", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const project = await instance.findProjectByName("TestProject1")
    assert.isUndefined(project)
  })

  it("should initialize project file", async () => {
    const instance = new FileHelper(configDir, configFileName, projectsDir);
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    const initialProject = await instance.initProject({
      name: "TestProject",
      records: [],
      meta: {
        host: "github.com",
        port: 22,
      }
    })

    assert.isDefined(initialProject)

    const configFile: IProject = await fs.readJson(path.join(configDir, projectsDir, "github_com_22", "TestProject.json"));
    expect(configFile.name).to.eq("TestProject")
    expect(configFile.records).to.be.an("Array")
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
    instance.createConfigDir()

    const gitUrl = "ssh://git@test.com/test/git-time-tracker.git"
    await instance.initConfigFile(gitUrl)

    try {
      await instance.initProject("TestProject", {
        host: "github.com",
        port: 22,
        name: "TestProject",
      })
    } catch (err) {
      assert.isDefined(err)
    }

  })

  it("should decode domain directory to IProjectMeta", async () => {
    const projectMeta = await FileHelper.decodeDomainDirectory("test_github_at_22");

    expect(projectMeta.host).to.eq("test.github.at")
    expect(projectMeta.port).to.eq(22)
  })
})