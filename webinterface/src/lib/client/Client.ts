"use client"
import {ClientConfig, ClientType, EndPoints, ModelDiagnosticsRequest, OptimizationRequest} from "@/lib/client/ClientTypes";
import {FileRequest, GetRequest, Request, RequestForFile, sseUrl, timedRequest} from "@/lib/client/Tunnel";
import crypto from "crypto";
import {getUUID} from "@/lib/auth";
import type { ConnectionResult } from "@/lib/store/types";
import { useProjectStore } from "@/lib/store/projectStore";

export class Client {

    config: ClientConfig;
    MessageSource: EventSource | null = null;

    public constructor(config:ClientConfig) {
        this.config = config;
    }

    public async TestConnection(): Promise<ConnectionResult> {
        try {
            const timeout = this.config.type === ClientType.CLOUD ? 8000 : 1000;
            const res = await timedRequest(EndPoints.health, this.config, timeout);
            if (res instanceof Error || res?.message === "Request failed:") {
                return {
                    ok: false,
                    status: "error",
                    error: res instanceof Error ? res.message : "Request failed",
                    raw: res,
                };
            }
            if (res?.Status === "Timed out") {
                return { ok: false, status: "timed_out", raw: res };
            }
            if (res?.Status === true) {
                return { ok: true, status: "connected", raw: res };
            }
            // CLOUD sessions are initialized by the orchestrator; treat missing Status as error.
            if (this.config.type === ClientType.CLOUD) {
                return {
                    ok: false,
                    status: "error",
                    error: "Cloud agent is not initialized",
                    raw: res,
                };
            }
            return { ok: false, status: "needs_init", raw: res };
        } catch (error) {
            return {
                ok: false,
                status: "error",
                error: error instanceof Error ? error.message : "Connection failed",
            };
        }
    }

    public async Initialize():Promise<number|any>{
        // Orchestrator already calls /initialize for CLOUD containers.
        if (this.config.type === ClientType.CLOUD) {
            return { message: "Already initialized" };
        }
        try{
            return await Request(EndPoints.initialize, this.config, {apiKey: crypto.createHash('sha256').update(this.config.apiKey).digest('hex')});
        } catch (e){
            // @ts-ignore
            return e;
        }
    }

    public async Disconnect(): Promise<any> {
        if (this.config.type === ClientType.CLOUD) {
            return { message: "Cloud sessions are managed by the orchestrator" };
        }
        try {
            return await Request(EndPoints.disconnect, this.config, {});
        } catch (e) {
            return e;
        }
    }

    /** True when Authorization is accepted by the agent. */
    public async VerifyAuth(): Promise<boolean> {
        if (this.config.type === ClientType.CLOUD) return true;
        try {
            const res = await GetRequest(EndPoints.optimizationReport, this.config);
            if (res instanceof Error) return false;
            // 404 = no report yet, but auth passed; 401 = wrong key.
            return res.status !== 401;
        } catch {
            return false;
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
        const eventSource = new EventSource(sseUrl(this.config, EndPoints.optimizeStatus));

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

    public async getOptimizationReport(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                const res = await GetRequest(EndPoints.optimizationReport, this.config);
                if(res instanceof Error)
                    return res;
                if(!res.ok){
                    const body = await res.json().catch(() => ({}));
                    return new Error(body?.error || `Request failed: ${res.status}`);
                }
                return await res.json();
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async ModelDiagnosticsRequest(req: ModelDiagnosticsRequest){
        try{
            return await Request(EndPoints.modelDiagnostics, this.config, req);
        } catch(e){
            return new Error("Request failed:", {cause: e})
        }
    }

    public async getModelDiagnosticsReport(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                const res = await GetRequest(EndPoints.modelDiagnosticsReport, this.config);
                if(res instanceof Error)
                    return res;
                if(!res.ok){
                    const body = await res.json().catch(() => ({}));
                    return new Error(body?.error || `Request failed: ${res.status}`);
                }
                return await res.json();
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async LoadModel(file:File){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try {
                return await FileRequest(EndPoints.referenceModel, this.config, file);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }


    public async LoadCSV(file:File){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try {
                return await FileRequest(EndPoints.referenceCSV, this.config, file);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getAdvancedAnalysis(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try {
                return await Request(EndPoints.advancedAnalysis, this.config, {});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getCorrelationAnalysis(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try {
                return await Request(EndPoints.correlationAnalysis, this.config, {});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getChartData(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try {
                return await Request(EndPoints.chartData, this.config, {});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getTargetAnalysis(targetColumn: string){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try {
                return await Request(EndPoints.targetAnalysis, this.config, {targetColumn});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    //Project handling
    /** Export current agent project as a Blob (no browser download). */
    public async exportProjectBlob(): Promise<Blob> {
        if (this.config.type !== ClientType.LOCAL && this.config.type !== ClientType.CLOUD) {
            throw new Error("Unsupported client type");
        }
        const file = await RequestForFile(EndPoints.exportProject, this.config);
        if (file instanceof Error) throw file;
        return file;
    }

    /** Export and trigger a local `.mylo` download. */
    public async ExportProject(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try {
                const file = await this.exportProjectBlob();
                const downloadLink = window.URL.createObjectURL(file);

                let fileName = "project";
                const project = useProjectStore.getState().project;
                if (project?.projectData?.name) {
                    fileName = project.projectData.name;
                }

                const link = document.createElement('a');
                link.href = downloadLink;
                link.setAttribute('download', fileName+".mylo");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadLink);

                return 200;
            } catch (e) {
                console.error(e);
                return new Error("Export failed", {cause: e});
            }
        }
    }

    public async NewProject(name:string){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try {
                return await Request(EndPoints.newProject, this.config, {name: name, id: getUUID()});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getProject(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.getProject, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getProjectFiles(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.projectFiles, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async visualizeProjectFile(filePath:string){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.visualizeProjectFile, this.config, {filePath});
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async DownloadOptimized(slot: "pt2" | "onnx", fileName?: string){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
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

    public async generateOnnxFromPt2(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.generateOnnxFromPt2, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async loadProject(file:File){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
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
            input.oncancel = () => {
                return reject("File selection cancelled");
            }
            input.onabort = () => {
                return reject("File selection aborted");
            }
            input.onerror = () =>{
                return reject("File selection failed");
            }
            input.click();
        })
    }

    // ---------------- Model editor ----------------

    public async getModelDescriptor(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.getModelDescriptor, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async getModelEditorCatalog(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.getModelEditorCatalog, this.config);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async validateModelDescriptor(descriptor:any, opts?: { strict?: boolean }){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.validateModelDescriptor, this.config, {
                    descriptor,
                    strict: Boolean(opts?.strict),
                });
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
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
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
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
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
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
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
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
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
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
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



    public async getEditorCatalog(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await GetRequest(EndPoints.editorCatalog, this.config).then(r => r.json());
            } catch {
                try {
                    return await Request(EndPoints.getModelEditorCatalog, this.config);
                } catch (e) {
                    return new Error("Request failed:", {cause: e});
                }
            }
        }
    }

    public async getEditorTemplates(){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await GetRequest(EndPoints.editorTemplates, this.config).then(r => r.json());
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async undo(args: {
        viewMode?: "summary" | "detailed" | "hybrid",
        expandedNodes?: string[],
    } = {}){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.editorUndo, this.config, {
                    viewMode: args.viewMode || "summary",
                    expandedNodes: args.expandedNodes || [],
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async redo(args: {
        viewMode?: "summary" | "detailed" | "hybrid",
        expandedNodes?: string[],
    } = {}){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.editorRedo, this.config, {
                    viewMode: args.viewMode || "summary",
                    expandedNodes: args.expandedNodes || [],
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async previewEdit(args:{
        descriptor?: any,
        operation: string,
        payload?: any,
        viewMode?: "summary" | "detailed" | "hybrid",
        expandedNodes?: string[],
    }){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.previewEdit, this.config, {
                    descriptor: args.descriptor,
                    operation: args.operation,
                    payload: args.payload || {},
                    persist: false,
                    viewMode: args.viewMode || "summary",
                    expandedNodes: args.expandedNodes || [],
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

    public async checkEdge(args:{
        source: string,
        target: string,
        sourcePort?: string,
        targetPort?: string,
        descriptor?: any,
    }){
        if(this.config.type === ClientType.LOCAL || this.config.type === ClientType.CLOUD){
            try{
                return await Request(EndPoints.checkEdge, this.config, {
                    source: args.source,
                    target: args.target,
                    sourcePort: args.sourcePort || "output",
                    targetPort: args.targetPort || "input",
                    descriptor: args.descriptor,
                });
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

}
