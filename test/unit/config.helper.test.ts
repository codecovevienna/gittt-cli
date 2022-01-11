import { expect, assert } from "chai";
import { ConfigHelper } from "../../helper";
import sinon from "sinon";
import { IConfigFile, IIntegrationLink, IJiraLink, IProject } from "../../interfaces";
import { emptyHelper } from "../helper";

describe("ConfigHelper", function () {
  describe("Links", function () {
    it("should fail to initialize (no FileHelper)", async function () {
      try {
        ConfigHelper.getInstance();
      } catch (err) {
        assert.isTrue(true);
      }
    });

    it("should fail to initialize new instance (no FileHelper)", async function () {
      try {
        ConfigHelper.getNewInstance();
      } catch (err) {
        assert.isTrue(true);
      }
    });

    it("should add link to config file", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const saveConfigObjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public getConfigObject = sinon.stub().resolves({
          created: 1234,
          gitRepo: "ssh://mocked",
          links: [],
        });

        public saveConfigObject = saveConfigObjectStub;
      }

      const instance: ConfigHelper = ConfigHelper.getNewInstance(new mockedHelper.FileHelper());

      const updatedConfigFile: IConfigFile = await instance.addOrUpdateLink({
        linkType: "mock",
        projectName: "mocked",
      } as IIntegrationLink);

      expect(updatedConfigFile.links.length).to.eq(1);

      assert.isTrue(saveConfigObjectStub.calledOnce);
    });

    it("should add different type of link to config file", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const saveConfigObjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public getConfigObject = sinon.stub().resolves({
          created: 1234,
          gitRepo: "ssh://mocked",
          links: [
            {
              linkType: "mock",
              projectName: "mocked",
            } as IIntegrationLink,
          ],
        });

        public saveConfigObject = saveConfigObjectStub;
      }

      const instance: ConfigHelper = ConfigHelper.getNewInstance(new mockedHelper.FileHelper());

      const updatedConfigFile: IConfigFile = await instance.addOrUpdateLink({
        linkType: "other",
        projectName: "mocked",
      } as IIntegrationLink);

      expect(updatedConfigFile.links.length).to.eq(2);

      assert.isTrue(saveConfigObjectStub.calledOnce);
    });

    it("should update link in config file", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const saveConfigObjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public getConfigObject = sinon.stub().resolves({
          created: 1234,
          gitRepo: "ssh://mocked",
          links: [
            {
              linkType: "mock",
              projectName: "mocked",
            } as IIntegrationLink,
          ],
        });

        public saveConfigObject = saveConfigObjectStub;
      }

      const instance: ConfigHelper = ConfigHelper.getNewInstance(new mockedHelper.FileHelper());

      const updatedConfigFile: IConfigFile = await instance.addOrUpdateLink({
        endpoint: "http://test.com/api",
        hash: "1234asdf",
        key: "test",
        linkType: "mock",
        projectName: "mocked",
        username: "mock",
      } as IJiraLink);

      expect(updatedConfigFile.links.length).to.eq(1);

      assert.isTrue(saveConfigObjectStub.calledOnce);
    });

    it("should update link with multiple types", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const saveConfigObjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public getConfigObject = sinon.stub().resolves({
          created: 1234,
          gitRepo: "ssh://mocked",
          links: [
            {
              linkType: "mock",
              projectName: "mocked",
            } as IIntegrationLink,
            {
              linkType: "fake",
              projectName: "mocked",
            } as IIntegrationLink,
          ],
        });

        public saveConfigObject = saveConfigObjectStub;
      }

      const instance: ConfigHelper = ConfigHelper.getNewInstance(new mockedHelper.FileHelper());

      const updatedConfigFile: IConfigFile = await instance.addOrUpdateLink({
        endpoint: "http://test.com/api",
        hash: "1234asdf",
        key: "test",
        linkType: "mock",
        projectName: "mocked",
        username: "updated",
      } as IJiraLink);

      expect(updatedConfigFile.links.length).to.eq(2);
      expect(updatedConfigFile).to.deep.equal({
        created: 1234,
        gitRepo: "ssh://mocked",
        links: [
          {
            linkType: "fake",
            projectName: "mocked",
          } as IIntegrationLink,
          {
            endpoint: "http://test.com/api",
            hash: "1234asdf",
            key: "test",
            linkType: "mock",
            projectName: "mocked",
            username: "updated",
          } as IJiraLink,
        ],
      })

      assert.isTrue(saveConfigObjectStub.calledOnce);
    });

    it("should find link by project", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public getConfigObject = sinon.stub().resolves({
          created: 1234,
          gitRepo: "ssh://mocked",
          links: [
            {
              linkType: "mock",
              projectName: "mocked",
            } as IIntegrationLink,
          ],
        });
      }

      const instance: ConfigHelper = ConfigHelper.getNewInstance(new mockedHelper.FileHelper());

      const foundLinks: IIntegrationLink[] = await instance.findLinksByProject({
        meta: {
          host: "github.com",
          port: 10022,
        },
        name: "mocked",
        records: [],
      } as IProject);

      expect(foundLinks[0]).to.deep.eq({
        linkType: "mock",
        projectName: "mocked",
      } as IIntegrationLink)

      // assert.isTrue(getConfigObjectStub.calledOnce);
    });

    it("should find link by project and type", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public getConfigObject = sinon.stub().resolves({
          created: 1234,
          gitRepo: "ssh://mocked",
          links: [
            {
              linkType: "mock",
              projectName: "mocked",
            } as IIntegrationLink,
            {
              linkType: "mock1",
              projectName: "mocked",
            } as IIntegrationLink,
            {
              linkType: "fake",
              projectName: "other",
            } as IIntegrationLink,
          ],
        });
      }

      const instance: ConfigHelper = ConfigHelper.getNewInstance(new mockedHelper.FileHelper());

      const foundLinks: IIntegrationLink[] = await instance.findLinksByProject({
        meta: {
          host: "github.com",
          port: 10022,
        },
        name: "mocked",
        records: [],
      } as IProject, "mock1");

      expect(foundLinks[0]).to.deep.eq({
        linkType: "mock1",
        projectName: "mocked",
      } as IIntegrationLink)
    });

    it("should fail to find link by project [unknown project name]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public getConfigObject = sinon.stub().resolves({
          created: 1234,
          gitRepo: "ssh://mocked",
          links: [
            {
              linkType: "mock",
              projectName: "mocked",
            } as IIntegrationLink,
          ],
        });
      }

      const instance: ConfigHelper = ConfigHelper.getNewInstance(new mockedHelper.FileHelper());

      const foundLinks: IIntegrationLink[] = await instance.findLinksByProject({
        meta: {
          host: "github.com",
          port: 10022,
        },
        name: "unknown",
        records: [],
      } as IProject);

      expect(foundLinks.length).to.eq(0)
    });

    it("should fail to find link by project [more links for same project name]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public getConfigObject = sinon.stub().resolves({
          created: 1234,
          gitRepo: "ssh://mocked",
          links: [
            {
              linkType: "mock",
              projectName: "mocked",
            } as IIntegrationLink,
            {
              linkType: "mock1",
              projectName: "mocked",
            } as IIntegrationLink,
            {
              linkType: "fake",
              projectName: "other",
            } as IIntegrationLink,
          ],
        });
      }

      const instance: ConfigHelper = ConfigHelper.getNewInstance(new mockedHelper.FileHelper());

      const foundLinks: IIntegrationLink[] = await instance.findLinksByProject({
        meta: {
          host: "github.com",
          port: 10022,
        },
        name: "mocked",
        records: [],
      } as IProject);

      expect(foundLinks.length).to.eq(2)
    });
  });
})