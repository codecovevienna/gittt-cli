import { FileHelper, LogHelper, GitHelper, ProjectHelper } from "../../helper/index"
import { assert, expect } from "chai"
import { ExecOutputReturnValue } from "shelljs";
import fs from "fs-extra";
import path from "path";
import sinon from "sinon";
import proxyquire from "proxyquire";
import { ListLogSummary, DefaultLogFields } from "simple-git/typings/response";
import { IOverrideAnswers, IProject } from "../../interfaces";
import { StatusResult } from "simple-git/promise";
import { ShellString } from "shelljs";

const sandboxDir = "./sandbox"
const configDir = path.join(sandboxDir, ".git-time-tracker");
const configFileName = "config.json"
const projectsDir = "projects"

describe.only("ProjectHelper", () => {
  // let fileHelper: FileHelper

  before(() => {
    LogHelper.silence = true;
    proxyquire.noCallThru()
    // fileHelper = new FileHelper(configDir, configFileName, projectsDir);
    // fileHelper.createConfigDir()
    // gitHelper = new GitHelper(configDir, fileHelper);
  })

  beforeEach(async () => {
    // Create config directory
    // await fs.ensureDir(configDir);
    // fileHelper.createConfigDir()
  })
  afterEach(async () => {
    // await fs.remove(sandboxDir)
  })

  it("should create instance", async () => {
    const fileProxy = proxyquire("../../helper/file", {})
    const gitProxy = proxyquire("../../helper/git", {
      "simple-git/promise": (baseDir: string) => {
        expect(baseDir).to.eq(configDir)
        return {}
      }
    })

    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);
    const mockedGitHelper: GitHelper = new gitProxy.GitHelper(configDir, mockedFileHelper);

    const projectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);
    expect(projectHelper).to.be.instanceOf(ProjectHelper);
  })

  it("should parse git url [with namespace]", () => {
    const project: IProject = ProjectHelper.parseProjectNameFromGitUrl("ssh://git@github.com:443/test/mocked.git")
    assert.isArray(project.records)
    expect(project.name).to.eq("test_mocked")
    expect(project.meta.host).to.eq("github.com")
    expect(project.meta.port).to.eq(443)
    expect(project.meta.raw).to.eq("ssh://git@github.com:443/test/mocked.git")
  })

  it("should parse git url [without namespace]", () => {
    const project: IProject = ProjectHelper.parseProjectNameFromGitUrl("ssh://git@github.com:443/mocked.git")
    assert.isArray(project.records)
    expect(project.name).to.eq("mocked")
    expect(project.meta.host).to.eq("github.com")
    expect(project.meta.port).to.eq(443)
    expect(project.meta.raw).to.eq("ssh://git@github.com:443/mocked.git")
  })

  it("should parse git url [with subdomain]", () => {
    const project: IProject = ProjectHelper.parseProjectNameFromGitUrl("ssh://git@mock.github.com:443/test/mocked.git")
    assert.isArray(project.records)
    expect(project.name).to.eq("test_mocked")
    expect(project.meta.host).to.eq("mock.github.com")
    expect(project.meta.port).to.eq(443)
    expect(project.meta.raw).to.eq("ssh://git@mock.github.com:443/test/mocked.git")
  })

  it("should fail to parse git url [no port]", () => {
    try {
      ProjectHelper.parseProjectNameFromGitUrl("ssh://git@mock.github.com/test/mocked.git")
    } catch (err) {
      assert.isDefined(err)
    }
  })

  it("should get project from git", () => {
    const fileProxy = proxyquire("../../helper/file", {})
    const gitProxy = proxyquire("../../helper/git", {
      "simple-git/promise": (baseDir: string) => {
        expect(baseDir).to.eq(configDir)
        return {}
      }
    })

    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);
    const mockedGitHelper: GitHelper = new gitProxy.GitHelper(configDir, mockedFileHelper);

    const projectProxy = proxyquire("../../helper/project", {
      "shelljs": {
        exec: (): ExecOutputReturnValue => {
          return {
            code: 0,
            stderr: "",
            stdout: "ssh://git@github.com:443/test/mocked.git"
          }
        }
      }
    })

    const instance = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    const project = instance.getProjectFromGit()

    assert.isArray(project.records)
    expect(project.name).to.eq("test_mocked")
    expect(project.meta.host).to.eq("github.com")
    expect(project.meta.port).to.eq(443)
    expect(project.meta.raw).to.eq("ssh://git@github.com:443/test/mocked.git")
  })

  it("should fail to get project from git [shell exec fails]", () => {
    const fileProxy = proxyquire.load("../../helper/file", {})
    const gitProxy = proxyquire.load("../../helper/git", {
      "simple-git/promise": (baseDir: string) => {
        expect(baseDir).to.eq(configDir)
        return {}
      }
    })

    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);
    const mockedGitHelper: GitHelper = new gitProxy.GitHelper(configDir, mockedFileHelper);

    const projectProxy = proxyquire("../../helper/project", {
      "shelljs": {
        exec: (): ExecOutputReturnValue => {
          return {
            code: 1337,
            stderr: "",
            stdout: "ssh://git@github.com:443/test/mocked.git"
          }
        }
      }
    })

    const instance = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    try {
      instance.getProjectFromGit()
    } catch (err) {
      assert.isDefined(err)
    }
  })

  it("should fail to get project from git [invalid stdout]", () => {
    const fileProxy = proxyquire.load("../../helper/file", {})
    const gitProxy = proxyquire.load("../../helper/git", {
      "simple-git/promise": (baseDir: string) => {
        expect(baseDir).to.eq(configDir)
        return {}
      }
    })

    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);
    const mockedGitHelper: GitHelper = new gitProxy.GitHelper(configDir, mockedFileHelper);

    const projectProxy = proxyquire("../../helper/project", {
      "shelljs": {
        exec: (): ExecOutputReturnValue => {
          return {
            code: 0,
            stderr: "",
            stdout: "ssh"
          }
        }
      }
    })

    const instance = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    try {
      instance.getProjectFromGit()
    } catch (err) {
      assert.isDefined(err)
    }
  })
})