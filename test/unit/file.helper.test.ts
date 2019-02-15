import { assert } from "chai"
import { FileHelper } from "../../helper/index"
import fs from "fs-extra";
import path from "path";
import mock from "mock-fs"

const configDir = "/mock/.git-time-tracker"
const configFileName = "config.json"
const projectsDir = "projects"
 
describe("FileHelper",()=>{
  before(()=>{
    mock({
      "/mock": {}
    })
  })

  after(()=>{
    mock.restore();
  })

  it("should create instance",async ()=>{
    const fileHelper = new FileHelper(configDir,configFileName, projectsDir);
    assert.isTrue(fileHelper instanceof FileHelper);
  })

  it("should create config directories",async ()=>{
    const instance = new FileHelper(configDir,configFileName, projectsDir);

    await instance.createConfigDir()
    fs.pathExistsSync(configDir)
    fs.pathExistsSync(path.join(configDir, projectsDir))
  })
})