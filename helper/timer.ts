import inquirer from "inquirer";
import { IOverrideAnswers } from "../interfaces";
import { FileHelper, LogHelper } from "./index";

export class TimerHelper {
    private fileHelper: FileHelper;
    constructor(fileHelper: FileHelper) {
        this.fileHelper = fileHelper;
    }

    public startTimer = async(): Promise<void> => {
        const now = Date.now();
        if(!this.fileHelper.timerFileExists()){

            // file does not exist just init with start time now

            this.fileHelper.initTimerFile;
            this.fileHelper.saveTimerObject({
                start: now,
                stop: 0
            })
        } else {
            
            // file exists check if timer is running

            if(this.isTimerRunning){
                const timer = this.fileHelper.getTimerObject();
                const diff = now - timer.start;
                LogHelper.info(`Timer is already started since ${diff} seconds`);
            } else {
                this.fileHelper.saveTimerObject({
                    start: now,
                    stop: 0
                });
                LogHelper.info("Started Timer");
            }
        }
    }

    public stopTimer = async(): Promise<void> => {

    }

    public killTimer = async(): Promise<void> => {

    }

    private isTimerRunning = async(): Promise<boolean> => {
        if(this.fileHelper.timerFileExists()){
            const timer = this.fileHelper.getTimerObject();
            if(timer.start < timer.stop)
                return true;
            else 
                return false;
        } 
        return false;
    }

    private readTimerFile = async(): Promise<

}