"use client"
import {ClientConfig, EndPoints, OptimizationRequest} from "@/lib/client/ClientTypes";
import {FileRequest, GetRequest, Request, RequestForFile, timedRequest} from "@/lib/client/Tunnel";
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

    public async OptimizationRequest(OptimizationReq: OptimizationRequest, modelFilepath?: string){
        try{
           return await Request(EndPoints.optimize, this.config, {
               ...OptimizationReq,
               modelFilepath,
           });
        } catch(e){
            return new Error("Request failed:", {cause: e})
        }
    }

    public async StatusUpdate(onMessage: (event:any)=>void){
        const eventSource = new EventSource(
            this.config.address+EndPoints.optimizeStatus
        )

        eventSource.onmessage = (event) => {
            onMessage(event);
        }

        eventSource.onerror = (event) => {
            eventSource.close();
        }

        return () => {
            eventSource.close();
        }
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
                return await FileRequest(EndPoints.referenceCSV, this.config, file);
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
                if(file instanceof Error)
                    throw file;
                const downloadLink = window.URL.createObjectURL(new Blob([file]));

                let fileName = ""
                const projectData = sessionStorage.getItem("loadedProject");
                if(projectData && projectData !== "undefined")
                    fileName = JSON.parse(projectData).projectData.name;

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

    public async getProjectFiles(){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.projectFiles, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async visualizeProjectFile(filePath:string){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.visualizeProjectFile, this.config, {filePath});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async DownloadOptimized(slot: "pt2" | "onnx", fileName?: string){
        if(this.config.type === "LOCAL"){
            try{
                const file = await RequestForFile(EndPoints.downloadOptimized, this.config, {slot, fileName});
                if(file instanceof Error)
                    throw file;

                const downloadLink = window.URL.createObjectURL(new Blob([file]));
                const link = document.createElement('a');
                link.href = downloadLink;
                link.setAttribute('download', fileName || `optimized_model.${slot}`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadLink);
                return 200;
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

    // ---------------- Model editor (descriptor-driven) ----------------

    public async getModelDescriptor(){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.getModelDescriptor, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getModelEditorCatalog(){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.getModelEditorCatalog, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async validateModelDescriptor(descriptor:any){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.validateModelDescriptor, this.config, {descriptor});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async editModel(args:{
        descriptor?: any,
        operation: string,
        payload?: any,
        persist?: boolean,
        viewMode?: "summary" | "detailed" | "hybrid",
        expandedNodes?: string[],
    }){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.editModel, this.config, {
                    descriptor: args.descriptor,
                    operation: args.operation,
                    payload: args.payload || {},
                    persist: Boolean(args.persist),
                    viewMode: args.viewMode || "summary",
                    expandedNodes: args.expandedNodes || [],
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async saveModelDescriptor(args:{
        descriptor: any,
        viewMode?: "summary" | "detailed" | "hybrid",
        expandedNodes?: string[],
    }){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.saveModelDescriptor, this.config, {
                    descriptor: args.descriptor,
                    viewMode: args.viewMode || "summary",
                    expandedNodes: args.expandedNodes || [],
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async visualizeModel(args:{
        descriptor?: any,
        viewMode?: "summary" | "detailed" | "hybrid",
        expandedNodes?: string[],
    }){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.visualizeModel, this.config, {
                    descriptor: args.descriptor,
                    viewMode: args.viewMode || "summary",
                    expandedNodes: args.expandedNodes || [],
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async expandModelNodes(args:{
        descriptor?: any,
        nodeIds: string[],
        expandedNodes?: string[],
    }){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.expandModelNodes, this.config, {
                    descriptor: args.descriptor,
                    nodeIds: args.nodeIds,
                    expandedNodes: args.expandedNodes || [],
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async collapseModelNodes(args:{
        descriptor?: any,
        nodeIds: string[],
        expandedNodes?: string[],
    }){
        if(this.config.type === "LOCAL"){
            try{
                return await Request(EndPoints.collapseModelNodes, this.config, {
                    descriptor: args.descriptor,
                    nodeIds: args.nodeIds,
                    expandedNodes: args.expandedNodes || [],
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

}