import { assert, expect } from "chai";
import { parseProjectNameFromGitUrl } from "../../helper";
import { IProject } from "../../interfaces";

describe("Helper", function () {
  it("should parse git url [with namespace]", function () {
    const project: IProject = parseProjectNameFromGitUrl("ssh://git@github.com:443/test/mocked.git");
    assert.isArray(project.records);
    expect(project.name).to.eq("test_mocked");
    expect(project.meta?.host).to.eq("github.com");
    expect(project.meta?.port).to.eq(443);
    expect(project.meta?.raw).to.eq("ssh://git@github.com:443/test/mocked.git");
  });

  it("should parse git url [without namespace]", function () {
    const project: IProject = parseProjectNameFromGitUrl("ssh://git@github.com:443/mocked.git");
    assert.isArray(project.records);
    expect(project.name).to.eq("mocked");
    expect(project.meta?.host).to.eq("github.com");
    expect(project.meta?.port).to.eq(443);
    expect(project.meta?.raw).to.eq("ssh://git@github.com:443/mocked.git");
  });

  it("should parse git url [with sub domain]", function () {
    const project: IProject = parseProjectNameFromGitUrl("ssh://git@mock.github.com:443/test/mocked.git");
    assert.isArray(project.records);
    expect(project.name).to.eq("test_mocked");
    expect(project.meta?.host).to.eq("mock.github.com");
    expect(project.meta?.port).to.eq(443);
    expect(project.meta?.raw).to.eq("ssh://git@mock.github.com:443/test/mocked.git");
  });

  it("should parse git url [with sub groups]", function () {
    const project: IProject = parseProjectNameFromGitUrl("ssh://git@mock.github.com:443/group/subgroup/mocked.git");
    assert.isArray(project.records);
    expect(project.name).to.eq("group_subgroup_mocked");
    expect(project.meta?.host).to.eq("mock.github.com");
    expect(project.meta?.port).to.eq(443);
    expect(project.meta?.raw).to.eq("ssh://git@mock.github.com:443/group/subgroup/mocked.git");
  });

  it("should fail to parse git url [no port]", function () {
    try {
      parseProjectNameFromGitUrl("ssh://git@mock.github.com/test/mocked.git");
    } catch (err) {
      assert.isDefined(err);
    }
  });

  it("should fail to parse git url [no regex match]", function () {
    try {
      parseProjectNameFromGitUrl("ssh");
    } catch (err) {
      assert.isDefined(err);
    }
  });
});
