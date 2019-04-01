// import { assert } from "chai"
// import { FileHelper, LogHelper, GitHelper } from "../../helper/index"
// import fs from "fs-extra";
// import path from "path";
// import simplegit from "simple-git/promise";
// import sinon from "sinon"
// import os from "os"
// import proxyquire from "proxyquire"
// import rewiremock from "rewiremock"

// const configDir = path.join(os.tmpdir(), ".git-time-tracker");
// const configFileName = "config.json"
// const projectsDir = "projects"

// describe.skip("GitHelper",()=>{
//   let fileHelper: FileHelper;
//   before(async ()=>{
//     proxyquire.noCallThru();
//     LogHelper.silence = false;
//   })
//   beforeEach(()=>{
//     rewiremock.enable()
//     fileHelper = new FileHelper(configDir, configFileName, projectsDir)
//     fileHelper.createConfigDir()
//   })
//   afterEach(async ()=>{
//     await fs.remove(configDir)
//     rewiremock.disable()
//   })

//   // it("should create instance",async ()=>{
//   //   const gitHelper = new GitHelper(configDir,fileHelper);
//   //   assert.isTrue(gitHelper instanceof GitHelper);
//   // })

//   // it("should init repo", async ()=>{
//   //   const remote = "ssh://stub@git.test.com/test/test.git"
//   //   const gitHelper = new GitHelper(configDir,fileHelper);
//   //   await gitHelper.initRepo(remote);

//   //   const gitConfig = (await fs.readFile(path.join(configDir, ".git", "config"))).toString();
//   //   assert.isTrue(gitConfig.includes(`url = ${remote}`))
//   // })

//   it("should pull repo",async ()=>{
//     const remote = "ssh://stub@git.test.com/test/test.git"
//     const mockedGit = simplegit(configDir);

//     const pullStub = sinon
//       .stub(mockedGit, "pull")
//       // .callsFake(async(remote?: string, branch?: string, options?: any)=>{
//       //   console.log("wooot")
//       //   return {
//       //     files: [],
//       //     insertions: {},
//       //     deletions: 1337,
//       //     summary: {
//       //       changes: 1337,
//       //       insertions: 1337,
//       //       deletions: 1337,
//       //     },
//       //     created: [],
//       //     deleted: [],
//       //   }
//       // })
//       .resolves({
//         files: [],
//         insertions: {},
//         deletions: 1337,
//         summary: {
//           changes: 1337,
//           insertions: 1337,
//           deletions: 1337,
//         },
//         created: [],
//         deleted: [],
//       })

//       // console.log(mockedGit.pull)

//       delete require.cache[require.resolve('../../helper/git')];

//       // const MockedGitHelper = await proxyquire("../../helper/git", {
//         //   'simple-git/promise': mockedGit,
//         // });

//         const { GitHelper } = rewiremock.proxy("../../helper/git",{
//           'simple-git/promise': mockedGit,
//         })

//           // const GitHelper = <GitHelper> proxyquire('../../helper/git', {
//           //   'simple-git/promise': mockedGit,
//           // })(configDir,fileHelper);

//         // const GitHelper = require("../../helper/git")
//         console.log(GitHelper)
//         console.log(new GitHelper(configDir,fileHelper))


//     // const gitHelper = new GitHelper(configDir,fileHelper);
//     // await gitHelper.initRepo(remote);
//     // await gitHelper.pullRepo();

//     // assert.isTrue(pullStub.called)
//   })
// })