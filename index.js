"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const inquirer_1 = __importDefault(require("inquirer"));
const path_1 = __importDefault(require("path"));
const shelljs_1 = __importDefault(require("shelljs"));
// tslint:disable-next-line no-var-requires
const APP_NAME = require("./package.json").name;
const DEBUG = true;
(() => __awaiter(this, void 0, void 0, function* () {
    const debug = (msg) => {
        if (DEBUG) {
            console.log(msg);
        }
    };
    const log = (msg) => {
        console.log(chalk_1.default.white.bold(msg));
    };
    const warn = (msg) => {
        console.log(chalk_1.default.yellow.bold(msg));
    };
    const info = (msg) => {
        console.log(chalk_1.default.green.bold(msg));
    };
    const getHomeDir = () => {
        const home = require("os").homedir()
            || process.env.HOME
            || process.env.HOMEPATH
            || process.env.USERPROFIL;
        if (!home) {
            throw new Error("Unable to determinate home directory");
        }
        return home;
    };
    const getProjectName = () => {
        debug("Trying to find project name from .git folder");
        const gitConfigExec = shelljs_1.default.exec("git config remote.origin.url", {
            silent: true,
        });
        console.log(gitConfigExec);
        // if(typeof gitConfigExec == ChildProcess || gitConfigExec.code !== 0 || gitConfigExec.stdout.length < 4){
        //   return
        // }
        // const originUrl = gitConfigExec.stdout.trim();
        // console.log(originUrl)
    };
    const setup = () => {
        try {
            fs_1.default.mkdirSync(configDir);
            info(`Created config dir (${configDir})`);
        }
        catch (err) {
            debug(`Error creating config dir ${err}`);
        }
        try {
            fs_1.default.writeFileSync(configFile, JSON.stringify({
                created: Date.now(),
                projects: [],
            }));
            info(`Created config file (${configFile})`);
        }
        catch (err) {
            debug(`Error creating config file ${err}`);
        }
    };
    const homeDir = getHomeDir();
    const configDir = path_1.default.join(homeDir, `.${APP_NAME}`);
    const configFile = path_1.default.join(configDir, "config.json");
    const configExists = fs_1.default.existsSync(configFile);
    getProjectName();
    if (!configExists) {
        const initAnswers = yield inquirer_1.default.prompt([
            {
                message: "Looks like you never used `${APP_NAME}`, should it be set up?",
                name: "setup",
                type: "confirm",
            },
        ]);
        // const initAnswers = {
        //   setup: true
        // }
        if (initAnswers.setup) {
            setup();
        }
        else {
            warn(`${APP_NAME} does not work without setup, bye!`);
            process.exit(0);
        }
        debug(initAnswers);
    }
    else {
        const config = JSON.parse(fs_1.default.readFileSync(configFile).toString());
        debug(config);
    }
}))();
