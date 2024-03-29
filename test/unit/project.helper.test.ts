import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { FileHelper, GitHelper, LogHelper, ProjectHelper } from "../../helper/index";
import { IProject, IRecord, IGitttFile } from "../../interfaces";
import { RECORD_TYPES, GitRemoteError, GitNoOriginError, GitNoRepoError, GitNoUrlError } from "../../types";
import { emptyHelper } from "../helper";

const sandboxDir = "./sandbox";
const configDir: string = path.join(sandboxDir, ".git-time-tracker");
const configFileName = "config.json";
const timerFileName = "timer.json";
const projectsDir = "projects";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("ProjectHelper", function () {
  let mockedFileHelper: FileHelper;
  let mockedGitHelper: GitHelper;
  before(function () {
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

  describe("General", function () {
    it("should create instance", async function () {
      const projectHelper: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);
      expect(projectHelper).to.be.instanceOf(ProjectHelper);
    });

    it("should return project file name", async function () {
      expect(ProjectHelper.projectToProjectFilename({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "mocked",
        records: [],
      })).to.eq("mocked.json");
    });

    it("should return project meta from domain", async function () {
      expect(ProjectHelper.domainToProjectMeta("gitlab_com_10022")).to.deep.eq({
        host: "gitlab.com",
        port: 10022,
      });
    });

    it("should return project meta from domain [no port]", async function () {
      expect(ProjectHelper.domainToProjectMeta("gitlab_com")).to.deep.eq({
        host: "gitlab.com",
        port: 0,
      });
    });

    it("should return project file path", async function () {
      expect(ProjectHelper.getProjectPath({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "mocked",
        records: [],
      })).to.eq("github_com_443/mocked.json");
    });

    it("should return project file path [no meta data]", async function () {
      expect(ProjectHelper.getProjectPath({
        name: "mocked",
        records: [],
      })).to.eq("mocked.json");
    });

    it("should get gittt project from .gittt.yml", async function () {
      const getGitttFileStub = sinon.stub(mockedFileHelper, "getGitttFile").resolves({
        name: "mocked_project_1",
      } as IGitttFile);

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const project: IProject = await instance.getGitttProject();

      expect(project).to.deep.eq({
        name: "mocked_project_1",
        records: []
      } as IProject);

      getGitttFileStub.restore();
    });

    it("should get gittt project with requiresRoles from .gittt.yml", async function () {
      const getGitttFileStub = sinon.stub(mockedFileHelper, "getGitttFile").resolves({
        name: "mocked_project_1",
        requiresRoles: true,
      } as IGitttFile);

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const project: IProject = await instance.getGitttProject();

      expect(project).to.deep.eq({
        name: "mocked_project_1",
        records: [],
        requiresRoles: true,
      } as IProject);

      getGitttFileStub.restore();
    });

    it("should get gittt project from .git/config", async function () {
      const getGitttFileStub = sinon.stub(mockedFileHelper, "getGitttFile").throws(new Error("mocked"))

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getProjectFromGitStub = sinon.stub(instance, "getProjectFromGit").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      } as IProject);

      const project: IProject = await instance.getGitttProject();

      expect(project?.meta?.host).to.eq("github.com");
      expect(project?.meta?.port).to.eq(443);
      expect(project?.name).to.eq("test_mocked");

      getProjectFromGitStub.restore();
      getGitttFileStub.restore();
    });

    it("should fail to get gittt project", async function () {
      const getGitttFileStub = sinon.stub(mockedFileHelper, "getGitttFile").throws(new Error("mocked"))

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getProjectFromGitStub = sinon.stub(instance, "getProjectFromGit").throws(new Error("mocked2"))

      try {
        await instance.getGitttProject()
      } catch (err: any) {
        expect(err).to.not.be.undefined
      }

      getProjectFromGitStub.restore();
      getGitttFileStub.restore();
    });

    it("should initialize project", async function () {
      const initProjectStub = sinon.stub(mockedFileHelper, "initProject").resolves();
      const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getProjectFromGitStub = sinon.stub(instance, "getGitttProject").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      } as IProject);

      const project: IProject = await instance.initProject();

      expect(project.meta?.host).to.eq("github.com");
      expect(project.meta?.port).to.eq(443);
      expect(project.name).to.eq("test_mocked");

      assert.isTrue(initProjectStub.calledOnce);
      assert.isTrue(commitChangesStub.calledOnce);
      assert.isTrue(getProjectFromGitStub.calledOnce);

      initProjectStub.restore();
      commitChangesStub.restore();
      getProjectFromGitStub.restore();
    });

    it("should fail to initialize project", async function () {
      const initProjectStub = sinon
        .stub(mockedFileHelper, "initProject")
        .rejects(new Error("Mocked error"));

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getProjectFromGitStub = sinon.stub(instance, "getGitttProject").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      } as IProject);

      try {
        await instance.initProject();
      } catch (err: any) {
        assert.isDefined(err);
      }

      assert.isTrue(initProjectStub.calledOnce);
      assert.isTrue(getProjectFromGitStub.calledOnce);

      initProjectStub.restore();
      getProjectFromGitStub.restore();
    });

    it("should get project by name", async function () {
      const mockedProject: IProject = {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      };

      const initProjectStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([mockedProject]);

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const project: IProject | undefined = await instance.getProjectByName("test_mocked");

      expect(project).to.eq(mockedProject);

      initProjectStub.restore();
    });

    it("should get project by name [fallback to git {no name}]", async function () {
      const mockedProject: IProject = {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      };

      const findAllProjectsStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([]);
      const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(mockedProject);

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getProjectFromGitStub = sinon.stub(instance, "getGitttProject").resolves(mockedProject);

      const project: IProject | undefined = await instance.getProjectByName("");

      expect(project).to.eq(mockedProject);
      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);

      findAllProjectsStub.restore();
      findProjectByNameStub.restore();
    });

    it("should fail to get project by name [no git folder]", async function () {
      const findAllProjectsStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([]);

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getProjectFromGitStub = sinon.stub(instance, "getGitttProject").throws(new Error("Mocked"));

      try {
        await instance.getProjectByName("test_mocked");
      } catch (err: any) {
        expect(err.message).to.eq("Mocked")
      }

      assert.isTrue(getProjectFromGitStub.calledOnce);

      findAllProjectsStub.restore();
    });

    it("should get or ask project from git [git directory]", async function () {
      const mockedProject: IProject = {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      };

      const populatedMockedProject: IProject = {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [
          {
            amount: 1337,
            end: 123456789,
            type: RECORD_TYPES.Time,
          } as IRecord
        ],
      };

      const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(populatedMockedProject);

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const initProjectStub = sinon.stub(instance, "getGitttProject").resolves(mockedProject);

      const project: IProject | undefined = await instance.getOrAskForProjectFromGit();

      expect(project).to.eq(populatedMockedProject);
      assert.isTrue(findProjectByNameStub.calledOnce);

      initProjectStub.restore();
      findProjectByNameStub.restore();
    });

    it("should get or ask project from git [not a git directory]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedProject: IProject = {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      };

      mockedHelper.QuestionHelper = class {
        public static chooseProjectFile = sinon.stub().resolves("domain/test_mocked");
      }

      const findAllProjectsStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([mockedProject]);
      const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(mockedProject);

      const proxy: any = proxyquire("../../helper/project", {
        "./": mockedHelper,
      });

      const instance: ProjectHelper = new proxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getProjectFromGitStub = sinon.stub(instance, "getProjectFromGit").throws(new GitRemoteError("Mocked Error"));

      const project: IProject | undefined = await instance.getOrAskForProjectFromGit();

      expect(project).to.eq(mockedProject);

      getProjectFromGitStub.restore();
      findProjectByNameStub.restore();
      findAllProjectsStub.restore();
    });

    it("should fail to get or ask project from git [wrong error type]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedProject: IProject = {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      };

      mockedHelper.QuestionHelper = class {
        public static chooseProjectFile = sinon.stub().resolves("domain/test_mocked");
      }

      const findAllProjectsStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([mockedProject]);
      const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(mockedProject);

      const proxy: any = proxyquire("../../helper/project", {
        "./": mockedHelper,
      });

      const instance: ProjectHelper = new proxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getGitttProjectStub = sinon.stub(instance, "getGitttProject").throws(new Error("Mocked Error"));

      let thrownError: Error | undefined;
      try {
        await instance.getOrAskForProjectFromGit();
      } catch (err: any) {
        thrownError = err;
      }
      assert.isDefined(thrownError);

      getGitttProjectStub.restore();
      findProjectByNameStub.restore();
      findAllProjectsStub.restore();
    });

    it("should fail to get or ask project from git [no project]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedProject: IProject = {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      };

      mockedHelper.QuestionHelper = class {
        public static chooseProjectFile = sinon.stub().resolves("domain/test_mocked");
      }

      const findAllProjectsStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([mockedProject]);
      const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(undefined);

      const proxy: any = proxyquire("../../helper/project", {
        "./": mockedHelper,
      });

      const instance: ProjectHelper = new proxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getGitttProjectStub = sinon.stub(instance, "getGitttProject").throws(new GitRemoteError("Mocked Error"));

      let thrownError: Error | undefined;
      try {
        await instance.getOrAskForProjectFromGit();
      } catch (err: any) {
        thrownError = err;
      }
      assert.isDefined(thrownError);

      getGitttProjectStub.restore();
      findProjectByNameStub.restore();
      findAllProjectsStub.restore();
    });
  });

  describe("Adding records", function () {
    it("should add record to project", async function () {
      const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

      const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      } as IProject);

      await instance.addRecordToProject({
        amount: 1337,
        end: 12054,
        message: "test",
        type: RECORD_TYPES.Time,
      });

      assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to test_mocked: "test"`));

      assert.isTrue(saveProjectObjectStub.calledOnce);
      assert.isTrue(getGitttProjectStub.calledOnce);

      commitChangesStub.restore();
      saveProjectObjectStub.restore();
      getGitttProjectStub.restore();
    });

    it("should add record to project without message", async function () {
      const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

      const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      } as IProject);

      await instance.addRecordToProject({
        amount: 1337,
        end: 12054,
        type: RECORD_TYPES.Time,
      });

      assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to test_mocked`));

      assert.isTrue(saveProjectObjectStub.calledOnce);
      assert.isTrue(getGitttProjectStub.calledOnce);

      commitChangesStub.restore();
      saveProjectObjectStub.restore();
      getGitttProjectStub.restore();
    });

    // it("should add record of one hour to project without message", async function () {
    //   const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
    //     meta: {
    //       host: "github.com",
    //       port: 443,
    //     },
    //     name: "test_mocked",
    //     records: [],
    //   } as IProject);
    //   const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

    //   const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    //   const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    //   const getProjectFromGitStub = sinon.stub(instance, "getProjectFromGit").returns({
    //     meta: {
    //       host: "github.com",
    //       port: 443,
    //     },
    //     name: "test_mocked",
    //     records: [],
    //   } as IProject);

    //   assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to test_mocked`));

    //   assert.isTrue(findProjectByNameStub.calledOnce);
    //   assert.isTrue(saveProjectObjectStub.calledOnce);
    //   assert.isTrue(getProjectFromGitStub.calledOnce);

    //   findProjectByNameStub.restore();
    //   commitChangesStub.restore();
    //   saveProjectObjectStub.restore();
    //   getProjectFromGitStub.restore();
    // });

    it("should add record to project without created timestamp", async function () {
      const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

      const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      } as IProject);

      await instance.addRecordToProject({
        amount: 1337,
        end: 12054,
        type: RECORD_TYPES.Time,
      });

      assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to test_mocked`));

      assert.isTrue(saveProjectObjectStub.calledOnce);
      assert.isTrue(getGitttProjectStub.calledOnce);

      commitChangesStub.restore();
      saveProjectObjectStub.restore();
      getGitttProjectStub.restore();
    });

    it("should add record of one hour to project without message", async function () {
      const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

      const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [],
      } as IProject);

      await instance.addRecordToProject({
        amount: 1,
        end: 12054,
        type: RECORD_TYPES.Time,
      });

      assert.isTrue(commitChangesStub.calledWith(`Added 1 hour to test_mocked`));

      assert.isTrue(saveProjectObjectStub.calledOnce);
      assert.isTrue(getGitttProjectStub.calledOnce);

      commitChangesStub.restore();
      saveProjectObjectStub.restore();
      getGitttProjectStub.restore();
    });

    // it("should add record to non existing project", async function () {
    //   const findProjectByNameStub = sinon
    //     .stub(mockedFileHelper, "findProjectByName")
    //     .resolves(undefined);

    //   const initProjectStub = sinon.stub(mockedFileHelper, "initProject").resolves({
    //     meta: {
    //       host: "github.com",
    //       port: 443,
    //     },
    //     name: "test_mocked",
    //     records: [],
    //   } as IProject);
    //   const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

    //   const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();
    //   const confirmMigrationStub = sinon.stub(QuestionHelper, "confirmMigration").resolves(false);

    //   const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    //   const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves({
    //     meta: {
    //       host: "github.com",
    //       port: 443,
    //     },
    //     name: "test_mocked",
    //     records: [],
    //   } as IProject);

    //   await instance.addRecordToProject({
    //     amount: 1,
    //     end: 12054,
    //     type: RECORD_TYPES.Time,
    //   });

    //   assert.isTrue(commitChangesStub.calledWith(`Added 1 hour to test_mocked`));

    //   assert.isTrue(confirmMigrationStub.calledOnce);
    //   assert.isTrue(findProjectByNameStub.calledOnce);
    //   assert.isTrue(initProjectStub.calledOnce);
    //   assert.isTrue(saveProjectObjectStub.calledOnce);
    //   assert.isTrue(getGitttProjectStub.calledTwice);

    //   findProjectByNameStub.restore();
    //   initProjectStub.restore();
    //   commitChangesStub.restore();
    //   saveProjectObjectStub.restore();
    //   getGitttProjectStub.restore();
    //   confirmMigrationStub.restore();
    // });

    // it("should fail to add record to non existing project", async function () {
    //   const exitStub = sinon.stub(process, "exit");
    //   const findProjectByNameStub = sinon
    //     .stub(mockedFileHelper, "findProjectByName")
    //     .resolves(undefined);
    //   const initProjectStub = sinon
    //     .stub(mockedFileHelper, "initProject")
    //     .rejects(new Error("Mocked error"));

    //   const confirmMigrationStub = sinon.stub(QuestionHelper, "confirmMigration").resolves(false);

    //   const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

    //   const getProjectFromGitStub = sinon.stub(instance, "getProjectFromGit").returns({
    //     meta: {
    //       host: "github.com",
    //       port: 443,
    //     },
    //     name: "test_mocked",
    //     records: [],
    //   } as IProject);

    //   await instance.addRecordToProject({
    //     amount: 1337,
    //     end: 12054,
    //     message: "test",
    //     type: RECORD_TYPES.Time,
    //   });

    //   assert.isTrue(exitStub.called);

    //   assert.isTrue(findProjectByNameStub.calledOnce);
    //   assert.isTrue(initProjectStub.calledOnce);
    //   assert.isTrue(getProjectFromGitStub.calledTwice);

    //   findProjectByNameStub.restore();
    //   getProjectFromGitStub.restore();
    //   initProjectStub.restore();
    //   exitStub.restore();
    //   confirmMigrationStub.restore();
    // });

    // TODO re-enable
    // it("should add record to migrated project", async function () {
    //   const findProjectByNameStub = sinon
    //     .stub(mockedFileHelper, "findProjectByName")
    //     // No project found to add record to
    //     .onCall(0).resolves(undefined)
    //     // Return project to migrate from
    //     .onCall(1).resolves({
    //       meta: {
    //         host: "from.com",
    //         port: 1337,
    //       },
    //       name: "migrate_from",
    //       records: [],
    //     } as IProject);

    //   const confirmMigrationStub = sinon.stub(QuestionHelper, "confirmMigration").resolves(true);
    //   const findAllProjectsStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([]);
    //   const chooseProjectFileStub = sinon.stub(QuestionHelper, "chooseProjectFile")
    //     .resolves("from_com/migrate_from.json");
    //   const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
    //   const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    //   const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);
    //   const getProjectFromGitStub = sinon.stub(instance, "getProjectFromGit").returns({
    //     meta: {
    //       host: "to.com",
    //       port: 2212,
    //     },
    //     name: "migrate_to",
    //     records: [],
    //   } as IProject);

    //   // const migrateStub = sinon.stub(instance, "migrate").resolves({
    //   //   meta: {
    //   //     host: "to.com",
    //   //     port: 2212,
    //   //   },
    //   //   name: "migrate_to",
    //   //   records: [],
    //   // } as IProject);

    //   await instance.addRecordToProject({
    //     amount: 1337,
    //     end: 12054,
    //     message: "test",
    //     type: RECORD_TYPES.Time,
    //   });

    //   assert.isTrue(confirmMigrationStub.calledOnce);
    //   assert.isTrue(findAllProjectsStub.calledOnce);
    //   assert.isTrue(findProjectByNameStub.calledTwice);
    //   assert.isTrue(getProjectFromGitStub.calledTwice);
    //   // assert.isTrue(migrateStub.calledOnce);
    //   assert.isTrue(saveProjectObjectStub.calledOnce);
    //   assert.isTrue(commitChangesStub.calledWith(`Added 1337 hours to migrate_to: "test"`));

    //   findProjectByNameStub.restore();
    //   confirmMigrationStub.restore();
    //   findAllProjectsStub.restore();
    //   chooseProjectFileStub.restore();
    //   getProjectFromGitStub.restore();
    //   // migrateStub.restore();
    //   saveProjectObjectStub.restore();
    //   commitChangesStub.restore();
    // });

    // TODO re-enable
    // it("should fail to add record to migrated project [project not found]", async function () {
    //   const exitStub = sinon.stub(process, "exit");
    //   const findProjectByNameStub = sinon
    //     .stub(mockedFileHelper, "findProjectByName")
    //     // No project found to add record to
    //     .onCall(0).resolves(undefined)
    //     // Unable to find project on disk
    //     .onCall(1).resolves(undefined);

    //   const confirmMigrationStub = sinon.stub(QuestionHelper, "confirmMigration").resolves(true);
    //   const findAllProjectsStub = sinon.stub(mockedFileHelper, "findAllProjects").resolves([]);
    //   const chooseProjectFileStub = sinon.stub(QuestionHelper, "chooseProjectFile")
    //     .resolves("from_com/migrate_from.json");
    //   const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
    //   const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

    //   const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);
    //   const getProjectFromGitStub = sinon.stub(instance, "getProjectFromGit").returns({
    //     meta: {
    //       host: "to.com",
    //       port: 2212,
    //     },
    //     name: "migrate_to",
    //     records: [],
    //   } as IProject);

    //   // const migrateStub = sinon.stub(instance, "migrate").resolves({
    //   //   meta: {
    //   //     host: "to.com",
    //   //     port: 2212,
    //   //   },
    //   //   name: "migrate_to",
    //   //   records: [],
    //   // } as IProject);

    //   try {
    //     await instance.addRecordToProject({
    //       amount: 1337,
    //       end: 69,
    //       message: "test",
    //       type: RECORD_TYPES.Time,
    //     });
    //   } catch (err: any) {
    //     assert.isDefined(err);
    //   }

    //   assert.isTrue(confirmMigrationStub.calledOnce);
    //   assert.isTrue(findAllProjectsStub.calledOnce);
    //   assert.isTrue(findProjectByNameStub.calledTwice);
    //   assert.isTrue(getProjectFromGitStub.calledOnce);
    //   // assert.isTrue(migrateStub.notCalled);
    //   assert.isTrue(saveProjectObjectStub.notCalled);
    //   assert.isTrue(commitChangesStub.notCalled);

    //   findProjectByNameStub.restore();
    //   confirmMigrationStub.restore();
    //   findAllProjectsStub.restore();
    //   chooseProjectFileStub.restore();
    //   getProjectFromGitStub.restore();
    //   // migrateStub.restore();
    //   saveProjectObjectStub.restore();
    //   commitChangesStub.restore();
    //   exitStub.restore();
    // });

    describe("Overlapping records", function () {
      it("should fail to add overlapping record [start smaller end inside]", async function () {
        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 10,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject,
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 10,
              end: 999,
              message: "test1",
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          false,
          true,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);

        getGitttProjectStub.restore();
      });

      it("should fail to add overlapping record [start larger end inside]", async function () {
        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 10,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject,
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 8,
              end: 999,
              message: "test1",
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          false,
          true,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);

        getGitttProjectStub.restore();
      });

      it("should fail to add overlapping record [start smaller end outside]", async function () {
        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 2,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject,
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 5,
              end: 1001,
              message: "test1",
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          false,
          true,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);

        getGitttProjectStub.restore();
      });

      it("should fail to add overlapping record [start inside end outside]", async function () {
        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 10,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject,
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 10,
              end: 1005,
              message: "test1",
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          false,
          true,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);

        getGitttProjectStub.restore();
      });

      it("should fail to add overlapping record [start same end same]", async function () {
        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 2,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject,
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 2,
              end: 1000,
              message: "test1",
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          false,
          true,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);

        getGitttProjectStub.restore();
      });

      it("should fail to add overlapping record, but add non overlapping [with message]", async function () {
        const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 2,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject,
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 5,
              end: 1001,
              message: "test0",
              type: RECORD_TYPES.Time,
            },
            {
              amount: 2,
              end: 2001,
              message: "test1",
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          false,
          true,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);
        assert.isTrue(saveProjectObjectStub.calledOnce);
        assert.isTrue(commitChangesStub.calledOnceWith(`Added 2 hours to test_mocked: "test1"`));

        getGitttProjectStub.restore();
        saveProjectObjectStub.restore();
        commitChangesStub.restore();
      });

      it("should fail to add overlapping record, but add non overlapping [without message]", async function () {
        const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 2,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject,
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 5,
              end: 1001,
              message: "test0",
              type: RECORD_TYPES.Time,
            },
            {
              amount: 2,
              end: 2001,
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          false,
          true,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);
        assert.isTrue(saveProjectObjectStub.calledOnce);
        assert.isTrue(commitChangesStub.calledOnceWith(`Added 2 hours to test_mocked`));

        getGitttProjectStub.restore();
        saveProjectObjectStub.restore();
        commitChangesStub.restore();
      });

      it("should fail to add overlapping record, but add multiple non overlapping", async function () {
        const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const commitChangesStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 2,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject,
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 5,
              end: 1001,
              message: "test0",
              type: RECORD_TYPES.Time,
            },
            {
              amount: 2,
              end: 2001,
              type: RECORD_TYPES.Time,
            },
            {
              amount: 3,
              end: 3001,
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          false,
          true,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);
        assert.isTrue(saveProjectObjectStub.calledOnce);
        assert.isTrue(commitChangesStub.calledOnceWith(`Added 2 records to test_mocked`));

        getGitttProjectStub.restore();
        saveProjectObjectStub.restore();
        commitChangesStub.restore();
      });
    });

    describe("Unique records", function () {
      it("should fail to add not unique record", async function () {
        const saveProjectObjectStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getGitttProjectStub = sinon.stub(instance, "getGitttProject").resolves(
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "test_mocked",
            records: [
              {
                amount: 2,
                end: 1000,
                message: "test",
                type: RECORD_TYPES.Time,
              },
            ],
          } as IProject
        );

        await instance.addRecordsToProject(
          [
            {
              amount: 2,
              end: 1000,
              message: "test",
              type: RECORD_TYPES.Time,
            },
          ],
          undefined,
          true,
          false,
        );

        assert.isTrue(getGitttProjectStub.calledOnce);
        assert.isTrue(saveProjectObjectStub.notCalled);

        getGitttProjectStub.restore();
        saveProjectObjectStub.restore();
      });
    });
  });

  describe("Total hours of project", function () {
    it("should get total numbers of hours for project", async function () {
      const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [
          {
            amount: 2,
            created: 1,
            type: RECORD_TYPES.Time,
          }, {
            amount: 3,
            created: 2,
            type: RECORD_TYPES.Time,
          },
        ],
      } as IProject);

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      const totalHours: number = await instance.getTotalHours("test_mocked");

      expect(totalHours).to.eq(5);

      assert.isTrue(findProjectByNameStub.calledOnce);
      findProjectByNameStub.restore();
    });

    it("should get total numbers of hours for project [no type]", async function () {
      const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves({
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "test_mocked",
        records: [
          {
            amount: 2,
            created: 1,
            type: RECORD_TYPES.Time,
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

    it("should fail to get total numbers of hours for non existing project", async function () {
      const findProjectByNameStub = sinon
        .stub(mockedFileHelper, "findProjectByName")
        .resolves(undefined);

      const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

      try {
        await instance.getTotalHours("test_mocked");
      } catch (err: any) {
        assert.isDefined(err);
      }

      assert.isTrue(findProjectByNameStub.calledOnce);
      findProjectByNameStub.restore();
    });
  });

  describe("Parse project from .git", function () {
    it("should get project from git", function () {
      const shellExecStub = sinon.stub()
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
      expect(project.meta?.host).to.eq("github.com");
      expect(project.meta?.port).to.eq(443);
      expect(project.meta?.raw).to.eq("ssh://git@github.com:443/test/mocked.git");
    });

    it("should get project from git [multiple remotes]", function () {
      const shellExecStub = sinon.stub()
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
      expect(project.meta?.host).to.eq("github.com");
      expect(project.meta?.port).to.eq(443);
      expect(project.meta?.raw).to.eq("ssh://git@github.com:443/test/mocked.git");
    });

    it("should fail to get project from git [no origin remote]", function () {
      const shellExecStub = sinon.stub()
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
      } catch (err: any) {
        thrownError = err;
      }
      assert.isDefined(thrownError);
      expect(thrownError).to.be.instanceOf(GitNoOriginError);
    });

    it("should fail to get project from git [no git repository]", function () {
      const shellExecStub = sinon.stub()
        .onCall(0).returns({
          code: 128,
          stderr: "No git repository",
          stdout: "",
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
      } catch (err: any) {
        thrownError = err;
      }
      assert.isDefined(thrownError);
      expect(thrownError).to.be.instanceOf(GitNoRepoError);
    });

    it("should fail to get project from git [shell exec fails]", function () {
      const shellExecStub = sinon.stub()
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
      } catch (err: any) {
        thrownError = err;
      }
      assert.isDefined(thrownError);
      expect(thrownError).to.be.instanceOf(GitRemoteError);
    });

    it("should fail to get project from git [shell exec fails second time]", function () {
      const shellExecStub = sinon.stub()
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
      } catch (err: any) {
        thrownError = err;
      }
      assert.isDefined(thrownError);
      expect(thrownError).to.be.instanceOf(GitNoUrlError);
    });

    it("should fail to get project from git [invalid stdout]", function () {
      const shellExecStub = sinon.stub()
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
      } catch (err: any) {
        thrownError = err;
      }
      assert.isDefined(thrownError);
      expect(thrownError).to.be.instanceOf(GitNoUrlError);
    });
  });

  // TODO re-enable
  // describe("Migration", function () {
  //   it("should migrate project [only project in domain]", async function () {
  //     const fromProject: IProject = {
  //       meta: {
  //         host: "github.com",
  //         port: 443,
  //       },
  //       name: "test_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     };

  //     const toProject: IProject = {
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [],
  //     };

  //     const projectProxy: any = proxyquire("../../helper/project", {});

  //     const findProjectsForDomainStub = sinon.stub(mockedFileHelper, "findProjectsForDomain").resolves([
  //     ]);
  //     const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(fromProject);
  //     const initProjectStub = sinon.stub(mockedFileHelper, "initProject").resolves();
  //     const removeDomainStub = sinon.stub(mockedFileHelper, "removeDomainDirectory").resolves();
  //     const findLinksByProjectStub = sinon.stub(mockedFileHelper, "findLinksByProject").resolves([]);

  //     const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

  //     await instance.migrate(fromProject, toProject);

  //     assert.isTrue(findProjectsForDomainStub.calledOnce);
  //     assert.isTrue(findProjectByNameStub.calledOnce);
  //     assert.isTrue(initProjectStub.calledWith({
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     }));
  //     assert.isTrue(removeDomainStub.calledOnce);

  //     findProjectsForDomainStub.restore();
  //     findProjectByNameStub.restore();
  //     initProjectStub.restore();
  //     removeDomainStub.restore();
  //     findLinksByProjectStub.restore();
  //   });

  //   it("should migrate project [more projects in domain]", async function () {
  //     const additionalProject: IProject = {
  //       meta: {
  //         host: "bitbucket.com",
  //         port: 443,
  //       },
  //       name: "add_mocked",
  //       records: [
  //         {
  //           amount: 69,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     };

  //     const fromProject: IProject = {
  //       meta: {
  //         host: "github.com",
  //         port: 443,
  //       },
  //       name: "test_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     };

  //     const toProject: IProject = {
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [],
  //     };

  //     const projectProxy: any = proxyquire("../../helper/project", {});

  //     const findProjectsForDomainStub = sinon.stub(mockedFileHelper, "findProjectsForDomain").resolves([
  //       fromProject,
  //       additionalProject,
  //     ]);
  //     const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(fromProject);
  //     const initProjectStub = sinon.stub(mockedFileHelper, "initProject").resolves();
  //     const removeProjectFileStub = sinon.stub(mockedFileHelper, "removeProjectFile").resolves();
  //     const findLinksByProjectStub = sinon.stub(mockedFileHelper, "findLinksByProject").resolves([]);

  //     const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

  //     await instance.migrate(fromProject, toProject);

  //     assert.isTrue(findProjectsForDomainStub.calledOnce);
  //     assert.isTrue(findProjectByNameStub.calledOnce);
  //     assert.isTrue(initProjectStub.calledWith({
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     }));
  //     assert.isTrue(removeProjectFileStub.calledOnce);
  //     assert.isTrue(findLinksByProjectStub.calledOnce);

  //     findProjectsForDomainStub.restore();
  //     findProjectByNameStub.restore();
  //     initProjectStub.restore();
  //     removeProjectFileStub.restore();
  //     findLinksByProjectStub.restore();
  //   });

  //   it("should fail migrate project [project not found]", async function () {
  //     const fromProject: IProject = {
  //       meta: {
  //         host: "github.com",
  //         port: 443,
  //       },
  //       name: "test_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     };

  //     const toProject: IProject = {
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [],
  //     };

  //     const projectProxy: any = proxyquire("../../helper/project", {});

  //     const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(undefined);

  //     const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

  //     try {
  //       await instance.migrate(fromProject, toProject);
  //     } catch (err: any) {
  //       assert.isDefined(err);
  //     }

  //     assert.isTrue(findProjectByNameStub.calledOnce);

  //     findProjectByNameStub.restore();
  //   });

  //   it("should migrate project [only project in domain, with link]", async function () {
  //     const fromProject: IProject = {
  //       meta: {
  //         host: "github.com",
  //         port: 443,
  //       },
  //       name: "test_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     };

  //     const toProject: IProject = {
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [],
  //     };

  //     const projectProxy: any = proxyquire("../../helper/project", {});

  //     const findProjectsForDomainStub = sinon.stub(mockedFileHelper, "findProjectsForDomain").resolves([
  //     ]);
  //     const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(fromProject);
  //     const initProjectStub = sinon.stub(mockedFileHelper, "initProject").resolves();
  //     const removeDomainStub = sinon.stub(mockedFileHelper, "removeDomainDirectory").resolves();
  //     const findLinksByProjectStub = sinon.stub(mockedFileHelper, "findLinksByProject").resolves([
  //       {
  //         endpoint: "https://jira.com/rest/gittt/latest/",
  //         hash: "caetaep2gaediWea",
  //         key: "GITTT",
  //         linkType: "Jira",
  //         projectName: "test_mocked",
  //         username: "gittt",
  //       } as IJiraLink,
  //       {
  //         endpoint: "https://jira.com/rest/gittt/latest/",
  //         linkType: "Multipie",
  //         projectName: "test_mocked",
  //         username: "gittt",
  //       } as IMultipieInputLink,
  //     ]);
  //     const addOrUpdateLinkStub = sinon.stub(mockedFileHelper, "addOrUpdateLink").resolves();

  //     const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

  //     await instance.migrate(fromProject, toProject);

  //     assert.isTrue(findProjectsForDomainStub.calledOnce);
  //     assert.isTrue(findProjectByNameStub.calledOnce);
  //     assert.isTrue(initProjectStub.calledWith({
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     }));
  //     assert.isTrue(removeDomainStub.calledOnce);
  //     assert.isTrue(addOrUpdateLinkStub.calledWith({
  //       endpoint: "https://jira.com/rest/gittt/latest/",
  //       hash: "caetaep2gaediWea",
  //       key: "GITTT",
  //       linkType: "Jira",
  //       projectName: "migrated_mocked",
  //       username: "gittt",
  //     }));

  //     findProjectsForDomainStub.restore();
  //     findProjectByNameStub.restore();
  //     initProjectStub.restore();
  //     removeDomainStub.restore();
  //     findLinksByProjectStub.restore();
  //     addOrUpdateLinkStub.restore();
  //   });

  //   it("should migrate project [only project in domain, invalid link]", async function () {
  //     const fromProject: IProject = {
  //       meta: {
  //         host: "github.com",
  //         port: 443,
  //       },
  //       name: "test_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     };

  //     const toProject: IProject = {
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [],
  //     };

  //     const projectProxy: any = proxyquire("../../helper/project", {});

  //     const findProjectsForDomainStub = sinon.stub(mockedFileHelper, "findProjectsForDomain").resolves([
  //     ]);
  //     const findProjectByNameStub = sinon.stub(mockedFileHelper, "findProjectByName").resolves(fromProject);
  //     const initProjectStub = sinon.stub(mockedFileHelper, "initProject").resolves();
  //     const removeDomainStub = sinon.stub(mockedFileHelper, "removeDomainDirectory").resolves();
  //     const findLinksByProjectStub = sinon.stub(mockedFileHelper, "findLinksByProject").resolves([{
  //       endpoint: "https://jira.com/rest/gittt/latest/",
  //       hash: "caetaep2gaediWea",
  //       key: "GITTT",
  //       linkType: "Invalid",
  //       projectName: "test_mocked",
  //       username: "gittt",
  //     } as IIntegrationLink]);
  //     const addOrUpdateLinkStub = sinon.stub(mockedFileHelper, "addOrUpdateLink").resolves();

  //     const instance: ProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);

  //     await instance.migrate(fromProject, toProject);

  //     assert.isTrue(findProjectsForDomainStub.calledOnce);
  //     assert.isTrue(findProjectByNameStub.calledOnce);
  //     assert.isTrue(initProjectStub.calledWith({
  //       meta: {
  //         host: "gitlab.com",
  //         port: 443,
  //       },
  //       name: "migrated_mocked",
  //       records: [
  //         {
  //           amount: 1337,
  //           end: 69,
  //           type: RECORD_TYPES.Time,
  //         },
  //       ],
  //     }));
  //     assert.isTrue(removeDomainStub.calledOnce);
  //     assert.isTrue(addOrUpdateLinkStub.notCalled);

  //     findProjectsForDomainStub.restore();
  //     findProjectByNameStub.restore();
  //     initProjectStub.restore();
  //     removeDomainStub.restore();
  //     findLinksByProjectStub.restore();
  //     addOrUpdateLinkStub.restore();
  //   });
  // });
});
