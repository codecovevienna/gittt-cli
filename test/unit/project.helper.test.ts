import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { FileHelper, GitHelper, LogHelper, ProjectHelper, QuestionHelper } from "../../helper/index";
import { IIntegrationLink, IProject } from "../../interfaces";

const sandboxDir: string = "./sandbox";
const configDir: string = path.join(sandboxDir, ".git-time-tracker");
const configFileName: string = "config.json";
const timerFileName: string = "timer.json";
const projectsDir: string = "projects";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("ProjectHelper", () => {
  let mockedFileHelper: FileHelper;
  let mockedGitHelper: GitHelper;
  before(() => {
    proxyquire.noCallThru();

    const fileProxy: any = proxyquire("../../helper/file", {});
    const gitProxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (baseDir: string): any => {
        expect(baseDir).to.eq(configDir);
        return {};
      },
    });

    mockedFileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);
    mockedGitHelper = new gitProxy.GitHelper(configDir, mockedFileHelper);
  });

  it("should return project file name", async () => {
    expect(ProjectHelper.projectToProjectFilename({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "mocked",
      records: [],
    })).to.eq("mocked.json");
  });

  it("should return project meta from domain", async () => {
    expect(ProjectHelper.domainToProjectMeta("gitlab_com_10022")).to.deep.eq({
      host: "gitlab.com",
      port: 10022,
    });
  });

  it("should return project meta from domain [no port]", async () => {
    expect(ProjectHelper.domainToProjectMeta("gitlab_com")).to.deep.eq({
      host: "gitlab.com",
      port: 0,
    });
  });

  it("should return project file path", async () => {
    expect(ProjectHelper.getProjectPath({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "mocked",
      records: [],
    })).to.eq("github_com_443/mocked.json");
  });

  it("should create instance", async () => {
    const projectHelper: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);
    expect(projectHelper).to.be.instanceOf(ProjectHelper);
  });

  it("should initialize project", async () => {
    const initProjectStub: SinonStub = sinon.stub(mockedFileHelper, "initProject").resolves();
    const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);

    const project: IProject = await instance.initProject();

    expect(project.meta.host).to.eq("github.com");
    expect(project.meta.port).to.eq(443);
    expect(project.name).to.eq("test_mocked");

    assert.isTrue(initProjectStub.calledOnce);
    assert.isTrue(commitChangesStub.calledOnce);
    assert.isTrue(getProjectFromGitStub.calledOnce);

    initProjectStub.restore();
    commitChangesStub.restore();
    getProjectFromGitStub.restore();
  });

  it("should fail to initialize project", async () => {
    const initProjectStub: SinonStub = sinon
      .stub(mockedFileHelper, "initProject")
      .rejects(new Error("Mocked error"));

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);

    try {
      await instance.initProject();
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(initProjectStub.calledOnce);
    assert.isTrue(getProjectFromGitStub.calledOnce);

    initProjectStub.restore();
    getProjectFromGitStub.restore();
  });

  it("should add record to project", async () => {
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);
    const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

    const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);

    await instance.addRecordToProject({
      amount: 1337,
      created: 69,
      message: "test",
      type: "Time",
    });

    assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to test_mocked: "test"`));

    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(saveProjectObjectStub.calledOnce);
    assert.isTrue(getProjectFromGitStub.calledOnce);

    findProjectByNameStub.restore();
    commitChangesStub.restore();
    saveProjectObjectStub.restore();
    getProjectFromGitStub.restore();
  });

  it("should add record to project without message", async () => {
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);
    const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

    const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);

    await instance.addRecordToProject({
      amount: 1337,
      created: 69,
      type: "Time",
    });

    assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to test_mocked`));

    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(saveProjectObjectStub.calledOnce);
    assert.isTrue(getProjectFromGitStub.calledOnce);

    findProjectByNameStub.restore();
    commitChangesStub.restore();
    saveProjectObjectStub.restore();
    getProjectFromGitStub.restore();
  });

  it("should add record to project without created timestamp", async () => {
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);
    const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

    const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);

    await instance.addRecordToProject({
      amount: 1337,
      type: "Time",
    });

    assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to test_mocked`));

    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(saveProjectObjectStub.calledOnce);
    assert.isTrue(getProjectFromGitStub.calledOnce);

    findProjectByNameStub.restore();
    commitChangesStub.restore();
    saveProjectObjectStub.restore();
    getProjectFromGitStub.restore();
  });

  it("should add record of one hour to project without message", async () => {
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);
    const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

    const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);

    await instance.addRecordToProject({
      amount: 1,
      created: 69,
      type: "Time",
    });

    assert.isTrue(commitChangesStub.calledWith(`Added 1 hour to test_mocked`));

    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(saveProjectObjectStub.calledOnce);
    assert.isTrue(getProjectFromGitStub.calledOnce);

    findProjectByNameStub.restore();
    commitChangesStub.restore();
    saveProjectObjectStub.restore();
    getProjectFromGitStub.restore();
  });

  it("should add record to non existing project", async () => {
    const findProjectByNameStub: SinonStub = sinon
      .stub(mockedFileHelper, "findProjectByName")
      .resolves(undefined);

    const initProjectStub: SinonStub = sinon.stub(mockedFileHelper, "initProject").resolves({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);
    const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

    const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();
    const confirmMigrationStub: SinonStub = sinon.stub(QuestionHelper, "confirmMigration").resolves(false);

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);

    await instance.addRecordToProject({
      amount: 1337,
      created: 69,
      message: "test",
      type: "Time",
    });

    assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to test_mocked: "test"`));

    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(initProjectStub.calledOnce);
    assert.isTrue(saveProjectObjectStub.calledOnce);
    assert.isTrue(getProjectFromGitStub.calledTwice);

    findProjectByNameStub.restore();
    initProjectStub.restore();
    commitChangesStub.restore();
    saveProjectObjectStub.restore();
    getProjectFromGitStub.restore();
    confirmMigrationStub.restore();
  });

  it("should fail to add record to non existing project", async () => {
    const exitStub: SinonStub = sinon.stub(process, "exit");
    const findProjectByNameStub: SinonStub = sinon
      .stub(mockedFileHelper, "findProjectByName")
      .resolves(undefined);
    const initProjectStub: SinonStub = sinon
      .stub(mockedFileHelper, "initProject")
      .rejects(new Error("Mocked error"));

    const confirmMigrationStub: SinonStub = sinon.stub(QuestionHelper, "confirmMigration").resolves(false);

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [],
    } as IProject);

    await instance.addRecordToProject({
      amount: 1337,
      created: 69,
      message: "test",
      type: "Time",
    });

    assert.isTrue(exitStub.called);

    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(initProjectStub.calledOnce);
    assert.isTrue(getProjectFromGitStub.calledTwice);

    findProjectByNameStub.restore();
    getProjectFromGitStub.restore();
    initProjectStub.restore();
    exitStub.restore();
    confirmMigrationStub.restore();
  });

  it("should add record to migrated project", async () => {
    const findProjectByNameStub: SinonStub = sinon
      .stub(mockedFileHelper, "findProjectByName")
      // No project found to add record to
      .onCall(0).resolves(undefined)
      // Return project to migrate from
      .onCall(1).resolves({
        meta: {
          host: "from.com",
          port: 1337,
        },
        name: "migrate_from",
        records: [],
      } as IProject);

    const confirmMigrationStub: SinonStub = sinon.stub(QuestionHelper, "confirmMigration").resolves(true);
    const findAllProjectsStub: SinonStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([]);
    const chooseProjectFileStub: SinonStub = sinon.stub(QuestionHelper, "chooseProjectFile")
      .resolves("from_com/migrate_from.json");
    const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
    const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);
    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "to.com",
        port: 2212,
      },
      name: "migrate_to",
      records: [],
    } as IProject);

    const migrateStub: SinonStub = sinon.stub(instance, "migrate").resolves({
      meta: {
        host: "to.com",
        port: 2212,
      },
      name: "migrate_to",
      records: [],
    } as IProject);

    await instance.addRecordToProject({
      amount: 1337,
      created: 69,
      message: "test",
      type: "Time",
    });

    assert.isTrue(confirmMigrationStub.calledOnce);
    assert.isTrue(findAllProjectsStub.calledOnce);
    assert.isTrue(findProjectByNameStub.calledTwice);
    assert.isTrue(getProjectFromGitStub.calledTwice);
    assert.isTrue(migrateStub.calledOnce);
    assert.isTrue(saveProjectObjectStub.calledOnce);
    assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to migrate_to: "test"`));

    findProjectByNameStub.restore();
    confirmMigrationStub.restore();
    findAllProjectsStub.restore();
    chooseProjectFileStub.restore();
    getProjectFromGitStub.restore();
    migrateStub.restore();
    saveProjectObjectStub.restore();
    commitChangesStub.restore();
  });

  it("should fail to add record to migrated project [project not found]", async () => {
    const exitStub: SinonStub = sinon.stub(process, "exit");
    const findProjectByNameStub: SinonStub = sinon
      .stub(mockedFileHelper, "findProjectByName")
      // No project found to add record to
      .onCall(0).resolves(undefined)
      // Unable to find project on disk
      .onCall(1).resolves(undefined);

    const confirmMigrationStub: SinonStub = sinon.stub(QuestionHelper, "confirmMigration").resolves(true);
    const findAllProjectsStub: SinonStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([]);
    const chooseProjectFileStub: SinonStub = sinon.stub(QuestionHelper, "chooseProjectFile")
      .resolves("from_com/migrate_from.json");
    const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
    const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);
    const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
      meta: {
        host: "to.com",
        port: 2212,
      },
      name: "migrate_to",
      records: [],
    } as IProject);

    const migrateStub: SinonStub = sinon.stub(instance, "migrate").resolves({
      meta: {
        host: "to.com",
        port: 2212,
      },
      name: "migrate_to",
      records: [],
    } as IProject);

    try {
      await instance.addRecordToProject({
        amount: 1337,
        created: 69,
        message: "test",
        type: "Time",
      });
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(confirmMigrationStub.calledOnce);
    assert.isTrue(findAllProjectsStub.calledOnce);
    assert.isTrue(findProjectByNameStub.calledTwice);
    assert.isTrue(getProjectFromGitStub.calledOnce);
    assert.isTrue(migrateStub.notCalled);
    assert.isTrue(saveProjectObjectStub.notCalled);
    assert.isTrue(commitChangesStub.notCalled);

    findProjectByNameStub.restore();
    confirmMigrationStub.restore();
    findAllProjectsStub.restore();
    chooseProjectFileStub.restore();
    getProjectFromGitStub.restore();
    migrateStub.restore();
    saveProjectObjectStub.restore();
    commitChangesStub.restore();
    exitStub.restore();
  });

  it("should get total numbers of hours for project", async () => {
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [
        {
          amount: 2,
          created: 1,
          type: "Time",
        }, {
          amount: 3,
          created: 2,
          type: "Time",
        },
      ],
    } as IProject);

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const totalHours: number = await instance.getTotalHours("test_mocked");

    expect(totalHours).to.eq(5);

    assert.isTrue(findProjectByNameStub.calledOnce);
    findProjectByNameStub.restore();
  });

  it("should get total numbers of hours for project", async () => {
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [
        {
          amount: 2,
          created: 1,
          type: "Time",
        }, {
          amount: 3,
          created: 2,
        },
      ],
    } as IProject);

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    const totalHours: number = await instance.getTotalHours("test_mocked");

    expect(totalHours).to.eq(2);

    assert.isTrue(findProjectByNameStub.calledOnce);
    findProjectByNameStub.restore();
  });

  it("should fail to get total numbers of hours for non existing project", async () => {
    const findProjectByNameStub: SinonStub = sinon
      .stub(mockedFileHelper, "findProjectByName")
      .resolves(undefined);

    const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    try {
      await instance.getTotalHours("test_mocked");
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(findProjectByNameStub.calledOnce);
    findProjectByNameStub.restore();
  });

  it("should get project from git", () => {
    const shellExecStub: SinonStub = sinon.stub()
      .onCall(0).returns({
        code: 0,
        stderr: "",
        stdout: "origin",
      })
      .onCall(1).returns({
        code: 0,
        stderr: "",
        stdout: "ssh://git@github.com:443/test/mocked.git",
      });

    const projectProxy: any = proxyquire("../../helper/project", {
      shelljs: {
        exec: shellExecStub,
      },
    });

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    const project: IProject = instance.getProjectFromGit();

    assert.isArray(project.records);
    expect(project.name).to.eq("test_mocked");
    expect(project.meta.host).to.eq("github.com");
    expect(project.meta.port).to.eq(443);
    expect(project.meta.raw).to.eq("ssh://git@github.com:443/test/mocked.git");
  });

  it("should get project from git [multiple remotes]", () => {
    const shellExecStub: SinonStub = sinon.stub()
      .onCall(0).returns({
        code: 0,
        stderr: "",
        stdout: "test\nother\norigin\n",
      })
      .onCall(1).returns({
        code: 0,
        stderr: "",
        stdout: "ssh://git@github.com:443/test/mocked.git",
      });

    const projectProxy: any = proxyquire("../../helper/project", {
      shelljs: {
        exec: shellExecStub,
      },
    });

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    const project: IProject = instance.getProjectFromGit();

    assert.isArray(project.records);
    expect(project.name).to.eq("test_mocked");
    expect(project.meta.host).to.eq("github.com");
    expect(project.meta.port).to.eq(443);
    expect(project.meta.raw).to.eq("ssh://git@github.com:443/test/mocked.git");
  });

  it("should fail to get project from git [no origin remote]", () => {
    const shellExecStub: SinonStub = sinon.stub()
      .onCall(0).returns({
        code: 0,
        stderr: "",
        stdout: "test\nother\n",
      });

    const projectProxy: any = proxyquire("../../helper/project", {
      shelljs: {
        exec: shellExecStub,
      },
    });

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    let thrownError: Error | undefined;
    try {
      instance.getProjectFromGit();
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

  it("should fail to get project from git [shell exec fails]", () => {
    const shellExecStub: SinonStub = sinon.stub()
      .onCall(0).returns({
        code: 1337,
        stderr: "",
        stdout: "origin",
      });

    const projectProxy: any = proxyquire("../../helper/project", {
      shelljs: {
        exec: shellExecStub,
      },
    });

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    let thrownError: Error | undefined;
    try {
      instance.getProjectFromGit();
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

  it("should fail to get project from git [shell exec fails]", () => {
    const shellExecStub: SinonStub = sinon.stub()
      .onCall(0).returns({
        code: 0,
        stderr: "",
        stdout: "origin",
      })
      .onCall(1).returns({
        code: 1337,
        stderr: "",
        stdout: "ssh://git@github.com:443/test/mocked.git",
      });

    const projectProxy: any = proxyquire("../../helper/project", {
      shelljs: {
        exec: shellExecStub,
      },
    });

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    let thrownError: Error | undefined;
    try {
      instance.getProjectFromGit();
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

  it("should fail to get project from git [invalid stdout]", () => {
    const shellExecStub: SinonStub = sinon.stub()
      .onCall(0).returns({
        code: 0,
        stderr: "",
        stdout: "origin",
      })
      .onCall(1).returns({
        code: 0,
        stderr: "",
        stdout: "ssh",
      });

    const projectProxy: any = proxyquire("../../helper/project", {
      shelljs: {
        exec: shellExecStub,
      },
    });

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    let thrownError: Error | undefined;
    try {
      instance.getProjectFromGit();
    } catch (err) {
      thrownError = err;
    }
    assert.isDefined(thrownError);
  });

  it("should migrate project [only project in domain]", async () => {
    const fromProject: IProject = {
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    };

    const toProject: IProject = {
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [],
    };

    const projectProxy: any = proxyquire("../../helper/project", {});

    const findProjectsForDomainStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectsForDomain").resolves([
      fromProject,
    ]);
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(fromProject);
    const initProjectStub: SinonStub = sinon.stub(mockedFileHelper, "initProject").resolves();
    const removeDomainStub: SinonStub = sinon.stub(mockedFileHelper, "removeDomainDirectory").resolves();
    const findLinkByProjectStub: SinonStub = sinon.stub(mockedFileHelper, "findLinkByProject").resolves(undefined);

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    await instance.migrate(fromProject, toProject);

    assert.isTrue(findProjectsForDomainStub.calledOnce);
    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(initProjectStub.calledWith({
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    }));
    assert.isTrue(removeDomainStub.calledOnce);

    findProjectsForDomainStub.restore();
    findProjectByNameStub.restore();
    initProjectStub.restore();
    removeDomainStub.restore();
    findLinkByProjectStub.restore();
  });

  it("should migrate project [more projects in domain]", async () => {
    const additionalProject: IProject = {
      meta: {
        host: "bitbucket.com",
        port: 443,
      },
      name: "add_mocked",
      records: [
        {
          amount: 69,
          type: "Time",
        },
      ],
    };

    const fromProject: IProject = {
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    };

    const toProject: IProject = {
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [],
    };

    const projectProxy: any = proxyquire("../../helper/project", {});

    const findProjectsForDomainStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectsForDomain").resolves([
      fromProject,
      additionalProject,
    ]);
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(fromProject);
    const initProjectStub: SinonStub = sinon.stub(mockedFileHelper, "initProject").resolves();
    const removeProjectFileStub: SinonStub = sinon.stub(mockedFileHelper, "removeProjectFile").resolves();
    const findLinkByProjectStub: SinonStub = sinon.stub(mockedFileHelper, "findLinkByProject").resolves(undefined);

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    await instance.migrate(fromProject, toProject);

    assert.isTrue(findProjectsForDomainStub.calledOnce);
    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(initProjectStub.calledWith({
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    }));
    assert.isTrue(removeProjectFileStub.calledOnce);
    assert.isTrue(findLinkByProjectStub.calledOnce);

    findProjectsForDomainStub.restore();
    findProjectByNameStub.restore();
    initProjectStub.restore();
    removeProjectFileStub.restore();
    findLinkByProjectStub.restore();
  });

  it("should fail migrate project [project not found]", async () => {
    const fromProject: IProject = {
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    };

    const toProject: IProject = {
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [],
    };

    const projectProxy: any = proxyquire("../../helper/project", {});

    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(undefined);

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    try {
      await instance.migrate(fromProject, toProject);
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(findProjectByNameStub.calledOnce);

    findProjectByNameStub.restore();
  });

  it("should migrate project [only project in domain, with link]", async () => {
    const fromProject: IProject = {
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    };

    const toProject: IProject = {
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [],
    };

    const projectProxy: any = proxyquire("../../helper/project", {});

    const findProjectsForDomainStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectsForDomain").resolves([
      fromProject,
    ]);
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(fromProject);
    const initProjectStub: SinonStub = sinon.stub(mockedFileHelper, "initProject").resolves();
    const removeDomainStub: SinonStub = sinon.stub(mockedFileHelper, "removeDomainDirectory").resolves();
    const findLinkByProjectStub: SinonStub = sinon.stub(mockedFileHelper, "findLinkByProject").resolves({
      endpoint: "https://jira.com/rest/gittt/latest/",
      hash: "caetaep2gaediWea",
      key: "GITTT",
      linkType: "Jira",
      projectName: "test_mocked",
      username: "gittt",
    } as IIntegrationLink);
    const addOrUpdateLinkStub: SinonStub = sinon.stub(mockedFileHelper, "addOrUpdateLink").resolves();

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    await instance.migrate(fromProject, toProject);

    assert.isTrue(findProjectsForDomainStub.calledOnce);
    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(initProjectStub.calledWith({
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    }));
    assert.isTrue(removeDomainStub.calledOnce);
    assert.isTrue(addOrUpdateLinkStub.calledWith({
      endpoint: "https://jira.com/rest/gittt/latest/",
      hash: "caetaep2gaediWea",
      key: "GITTT",
      linkType: "Jira",
      projectName: "migrated_mocked",
      username: "gittt",
    }));

    findProjectsForDomainStub.restore();
    findProjectByNameStub.restore();
    initProjectStub.restore();
    removeDomainStub.restore();
    findLinkByProjectStub.restore();
    addOrUpdateLinkStub.restore();
  });

  it("should migrate project [only project in domain, invalid link]", async () => {
    const fromProject: IProject = {
      meta: {
        host: "github.com",
        port: 443,
      },
      name: "test_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    };

    const toProject: IProject = {
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [],
    };

    const projectProxy: any = proxyquire("../../helper/project", {});

    const findProjectsForDomainStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectsForDomain").resolves([
      fromProject,
    ]);
    const findProjectByNameStub: SinonStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(fromProject);
    const initProjectStub: SinonStub = sinon.stub(mockedFileHelper, "initProject").resolves();
    const removeDomainStub: SinonStub = sinon.stub(mockedFileHelper, "removeDomainDirectory").resolves();
    const findLinkByProjectStub: SinonStub = sinon.stub(mockedFileHelper, "findLinkByProject").resolves({
      endpoint: "https://jira.com/rest/gittt/latest/",
      hash: "caetaep2gaediWea",
      key: "GITTT",
      linkType: "Invalid",
      projectName: "test_mocked",
      username: "gittt",
    } as IIntegrationLink);
    const addOrUpdateLinkStub: SinonStub = sinon.stub(mockedFileHelper, "addOrUpdateLink").resolves();

    const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

    await instance.migrate(fromProject, toProject);

    assert.isTrue(findProjectsForDomainStub.calledOnce);
    assert.isTrue(findProjectByNameStub.calledOnce);
    assert.isTrue(initProjectStub.calledWith({
      meta: {
        host: "gitlab.com",
        port: 443,
      },
      name: "migrated_mocked",
      records: [
        {
          amount: 1337,
          type: "Time",
        },
      ],
    }));
    assert.isTrue(removeDomainStub.calledOnce);
    assert.isTrue(addOrUpdateLinkStub.notCalled);

    findProjectsForDomainStub.restore();
    findProjectByNameStub.restore();
    initProjectStub.restore();
    removeDomainStub.restore();
    findLinkByProjectStub.restore();
    addOrUpdateLinkStub.restore();
  });
});
