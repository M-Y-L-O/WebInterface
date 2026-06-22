"use client"
import {ClientConfig, EndPoints, OptimizationTask} from "@/lib/client/ClientTypes";
import {FileRequest, Request, RequestForFile, timedRequest} from "@/lib/client/Tunnel";
import {RequestServer} from "@/lib/client/CloudTunnel";
import crypto from "crypto";
import {getUUID} from "@/lib/auth";

export class Client {

    config: ClientConfig;
    MessageSource: EventSource | null = null;

    public constructor(config:ClientConfig) {
        this.config = config;
    }

    public async TestConnection():Promise<any>{

        if(this.config.type === "LOCAL")
            try{
                const res = await timedRequest(EndPoints.health, this.config, 1000);
                if(res.message === "Request failed:")
                    return 500;
                return res;
            } catch (e){
                return 500;
            }
        else
            try{
                await RequestServer(EndPoints.health, this.config);
                return 200;
            } catch (e){
                return 500;
            }

    }

    public async Initialize():Promise<number|any>{
        try{
            return await Request(EndPoints.initialize, this.config, {apiKey: crypto.createHash('sha256').update(this.config.apiKey).digest('hex')});
        } catch (e){
            // @ts-ignore
            return e;
        }
    }

    public async OptimizationRequest(OptimizationTask:OptimizationTask){
        try{
           return await Request(EndPoints.optimize, this.config, OptimizationTask);
        } catch(e){
            return new Error("Request failed:", {cause: e})
        }
    }

    public async SubscribeToStatus(event?:any, err?:any){
        if(this.MessageSource)
            this.MessageSource.close()

        this.MessageSource = new EventSource(this.config.address+EndPoints.optimize);

        if(event){
            this.MessageSource.onmessage = event;
        }

        this.MessageSource.onerror = (e) => {
            err?.(e);
            this.UnSubscribeFromStatus();
        };
    }

    public async UnSubscribeFromStatus(){
        if(this.MessageSource)
            this.MessageSource.close()
    }

    public async LoadModel(file:File){
        if(this.config.type === "LOCAL"){
            try {
                return await FileRequest(EndPoints.referenceModel, this.config, file);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }


    public async LoadCSV(file:File){
        if(this.config.type === "LOCAL"){
            try {
                return await Request(EndPoints.referenceCSV, this.config, {file: file});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    //Project handling
    public async ExportProject(){
        if(this.config.type === "LOCAL"){
            try {
                console.log("Exporting project");
                const file = await RequestForFile(EndPoints.exportProject, this.config);
                const downloadLink = window.URL.createObjectURL(new Blob([file]));

                let fileName = ""
                const projectData = sessionStorage.getItem("loadedProject");
                if(projectData && projectData !== "undefined")
                    fileName = JSON.parse(projectData).projectData.name;
                console.log(fileName);

                const link = document.createElement('a');
                link.href = downloadLink;

                link.setAttribute('download', fileName+".mylo");

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadLink);

                return 200;
            } catch (e) {}
        }
    }

    public async NewProject(name:string){
        if(this.config.type === "LOCAL"){
            try {
                return await Request(EndPoints.newProject, this.config, {name: name, id: getUUID()});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getProject(){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.getProject, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async loadProject(file:File){
        if(this.config.type === "LOCAL"){
            try{
                return await FileRequest(EndPoints.loadProject, this.config, file);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async GetFile(extensions:string): Promise<File | undefined>{
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = extensions;
            input.onchange = () => {
                if (input.files && input.files.length > 0) {
                    const file = input.files[0];
                    if(!file)
                        return reject("No file selected");
                    resolve(file);
                }
            }
            input.click();
        })
    }

}