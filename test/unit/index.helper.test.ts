import { assert, expect } from "chai";
import { parseProjectNameFromGitUrl, findTicketNumberInBranch, findTicketNumberInMessage } from "../../helper";
import { IProject } from "../../interfaces";
import { findTicketNumberInBranch } from '../../helper/index';

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

  describe("findTicketNumberInBranch", function () {
    it("should get ticket number from branch", async function () {
      const ticketNumber = findTicketNumberInBranch("1337-awesome-new-feature");
      expect(ticketNumber).to.eq("1337");
    })

    it("should not get ticket number from branch [number not in the beginning]", async function () {
      const ticketNumber = findTicketNumberInBranch("woot-1337-awesome-new-feature");
      expect(ticketNumber).to.be.undefined;
    })

    it("should not get ticket number from branch [no ticket number]", async function () {
      const ticketNumber = findTicketNumberInBranch("awesome-new-feature");
      expect(ticketNumber).to.be.undefined;
    })

    it("should not get ticket number from branch [empty branch string]", async function () {
      const ticketNumber = findTicketNumberInBranch("");
      expect(ticketNumber).to.be.undefined;
    })
  })

  describe("findTicketNumberInMessage", function () {
    it("should find ticket number in message", async function () {
      const ticketNumber = findTicketNumberInMessage("Implemented awesome feature (#1337)");
      expect(ticketNumber).to.eq("1337");
    })

    it("should find ticket number in message with spaces", async function () {
      const ticketNumber = findTicketNumberInMessage("Implemented awesome feature (#  1337)");
      expect(ticketNumber).to.eq("1337");
    })

    it("should find ticket number in message with different braces", async function () {
      const ticketNumber = findTicketNumberInMessage("Implemented awesome feature {#1337}");
      expect(ticketNumber).to.eq("1337");
    })

    it("should find ticket number in message somewhere in the message", async function () {
      const ticketNumber = findTicketNumberInMessage("Implemented [#1337] awesome feature");
      expect(ticketNumber).to.eq("1337");
    })

    it("should not find ticket number in message", async function () {
      const ticketNumber = findTicketNumberInMessage("Implemented awesome feature [$1337]");
      expect(ticketNumber).to.be.undefined;
    })

    it("should not find ticket number in message with spaces", async function () {
      const ticketNumber = findTicketNumberInMessage("Implemented awesome feature [$  1337]");
      expect(ticketNumber).to.be.undefined;
    })

    it("should not find ticket number in message with text between # and numbers", async function () {
      const ticketNumber = findTicketNumberInMessage("Implemented awesome feature [#woot1337]");
      expect(ticketNumber).to.be.undefined;
    })
  })
});
