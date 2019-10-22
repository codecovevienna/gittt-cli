import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { FileHelper, GitHelper, LogHelper, ProjectHelper } from "../../helper/index";
import { IProject, IRecord } from "../../interfaces";

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

  describe("General", () => {
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
  });

  describe("Adding records", () => {
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
        end: 12054,
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
        end: 12054,
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
        end: 12054,
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
        end: 12054,
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
        end: 12054,
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
    });

    it("should fail to add record to non existing project", async () => {
      const exitStub: SinonStub = sinon.stub(process, "exit");
      const findProjectByNameStub: SinonStub = sinon
        .stub(mockedFileHelper, "findProjectByName")
        .resolves(undefined);
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

      await instance.addRecordToProject({
        amount: 1337,
        end: 12054,
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
    });

    describe("Overlapping records", () => {
      it("should fail to add overlapping record", async () => {
        const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const findProjectByNameStub: SinonStub = sinon
          .stub(mockedFileHelper, "findProjectByName")
          .resolves(undefined);
        const initProjectStub: SinonStub = sinon
          .stub(mockedFileHelper, "initProject")
          .resolves(
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
                  type: "Time",
                },
              ],
            } as IProject,
          );

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "test_mocked",
          records: [],
        } as IProject);

        await instance.addRecordsToProject(
          [
            {
              amount: 5,
              end: 1001,
              message: "test1",
              type: "Time",
            },
          ],
          false,
          true,
        );

        assert.isTrue(findProjectByNameStub.calledOnce);
        assert.isTrue(initProjectStub.calledOnce);
        assert.isTrue(getProjectFromGitStub.calledTwice);
        assert.isTrue(saveProjectObjectStub.notCalled);

        findProjectByNameStub.restore();
        getProjectFromGitStub.restore();
        initProjectStub.restore();
        saveProjectObjectStub.restore();
      });

      it("should fail to add overlapping record [same end and amount]", async () => {
        const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const findProjectByNameStub: SinonStub = sinon
          .stub(mockedFileHelper, "findProjectByName")
          .resolves(undefined);
        const initProjectStub: SinonStub = sinon
          .stub(mockedFileHelper, "initProject")
          .resolves(
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
                  type: "Time",
                },
              ],
            } as IProject,
          );

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "test_mocked",
          records: [],
        } as IProject);

        await instance.addRecordsToProject(
          [
            {
              amount: 2,
              end: 1000,
              message: "test1",
              type: "Time",
            },
          ],
          false,
          true,
        );

        assert.isTrue(findProjectByNameStub.calledOnce);
        assert.isTrue(initProjectStub.calledOnce);
        assert.isTrue(getProjectFromGitStub.calledTwice);
        assert.isTrue(saveProjectObjectStub.notCalled);

        findProjectByNameStub.restore();
        getProjectFromGitStub.restore();
        initProjectStub.restore();
        saveProjectObjectStub.restore();
      });

      it("should fail to add overlapping record, but add non overlapping [with message]", async () => {
        const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();
        const findProjectByNameStub: SinonStub = sinon
          .stub(mockedFileHelper, "findProjectByName")
          .resolves(undefined);
        const initProjectStub: SinonStub = sinon
          .stub(mockedFileHelper, "initProject")
          .resolves(
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
                  type: "Time",
                },
              ],
            } as IProject,
          );

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "test_mocked",
          records: [],
        } as IProject);

        await instance.addRecordsToProject(
          [
            {
              amount: 5,
              end: 1001,
              message: "test0",
              type: "Time",
            },
            {
              amount: 2,
              end: 2001,
              message: "test1",
              type: "Time",
            },
          ],
          false,
          true,
        );

        assert.isTrue(findProjectByNameStub.calledOnce);
        assert.isTrue(initProjectStub.calledOnce);
        assert.isTrue(getProjectFromGitStub.calledTwice);
        assert.isTrue(saveProjectObjectStub.calledOnce);
        assert.isTrue(commitChangesStub.calledOnceWith(`Added 2 hours to test_mocked: "test1"`));

        findProjectByNameStub.restore();
        getProjectFromGitStub.restore();
        initProjectStub.restore();
        saveProjectObjectStub.restore();
        commitChangesStub.restore();
      });

      it("should fail to add overlapping record, but add non overlapping [without message]", async () => {
        const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();
        const findProjectByNameStub: SinonStub = sinon
          .stub(mockedFileHelper, "findProjectByName")
          .resolves(undefined);
        const initProjectStub: SinonStub = sinon
          .stub(mockedFileHelper, "initProject")
          .resolves(
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
                  type: "Time",
                },
              ],
            } as IProject,
          );

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "test_mocked",
          records: [],
        } as IProject);

        await instance.addRecordsToProject(
          [
            {
              amount: 5,
              end: 1001,
              message: "test0",
              type: "Time",
            },
            {
              amount: 2,
              end: 2001,
              type: "Time",
            },
          ],
          false,
          true,
        );

        assert.isTrue(findProjectByNameStub.calledOnce);
        assert.isTrue(initProjectStub.calledOnce);
        assert.isTrue(getProjectFromGitStub.calledTwice);
        assert.isTrue(saveProjectObjectStub.calledOnce);
        assert.isTrue(commitChangesStub.calledOnceWith(`Added 2 hours to test_mocked`));

        findProjectByNameStub.restore();
        getProjectFromGitStub.restore();
        initProjectStub.restore();
        saveProjectObjectStub.restore();
        commitChangesStub.restore();
      });

      it("should fail to add overlapping record, but add multiple non overlapping", async () => {
        const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const commitChangesStub: SinonStub = sinon.stub(mockedGitHelper, "commitChanges").resolves();
        const findProjectByNameStub: SinonStub = sinon
          .stub(mockedFileHelper, "findProjectByName")
          .resolves(undefined);
        const initProjectStub: SinonStub = sinon
          .stub(mockedFileHelper, "initProject")
          .resolves(
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
                  type: "Time",
                },
              ],
            } as IProject,
          );

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "test_mocked",
          records: [],
        } as IProject);

        await instance.addRecordsToProject(
          [
            {
              amount: 5,
              end: 1001,
              message: "test0",
              type: "Time",
            },
            {
              amount: 2,
              end: 2001,
              type: "Time",
            },
            {
              amount: 3,
              end: 3001,
              type: "Time",
            },
          ],
          false,
          true,
        );

        assert.isTrue(findProjectByNameStub.calledOnce);
        assert.isTrue(initProjectStub.calledOnce);
        assert.isTrue(getProjectFromGitStub.calledTwice);
        assert.isTrue(saveProjectObjectStub.calledOnce);
        assert.isTrue(commitChangesStub.calledOnceWith(`Added 2 records to test_mocked`));

        findProjectByNameStub.restore();
        getProjectFromGitStub.restore();
        initProjectStub.restore();
        saveProjectObjectStub.restore();
        commitChangesStub.restore();
      });
    });

    describe("Unique records", () => {
      it("should fail to add not unique record", async () => {
        const saveProjectObjectStub: SinonStub = sinon.stub(mockedFileHelper, "saveProjectObject").resolves();
        const findProjectByNameStub: SinonStub = sinon
          .stub(mockedFileHelper, "findProjectByName")
          .resolves(undefined);
        const initProjectStub: SinonStub = sinon
          .stub(mockedFileHelper, "initProject")
          .resolves(
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
                  type: "Time",
                },
              ],
            } as IProject,
          );

        const instance: ProjectHelper = new ProjectHelper(mockedGitHelper, mockedFileHelper);

        const getProjectFromGitStub: SinonStub = sinon.stub(instance, "getProjectFromGit").returns({
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "test_mocked",
          records: [],
        } as IProject);

        await instance.addRecordsToProject(
          [
            {
              amount: 2,
              end: 1000,
              message: "test",
              type: "Time",
            },
          ],
          true,
          false,
        );

        assert.isTrue(findProjectByNameStub.calledOnce);
        assert.isTrue(initProjectStub.calledOnce);
        assert.isTrue(getProjectFromGitStub.calledTwice);
        assert.isTrue(saveProjectObjectStub.notCalled);

        findProjectByNameStub.restore();
        getProjectFromGitStub.restore();
        initProjectStub.restore();
        saveProjectObjectStub.restore();
      });
    });
  });

  describe("Total hours of project", () => {
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
  });

  describe("Parse project from .git", () => {
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
  });
});
