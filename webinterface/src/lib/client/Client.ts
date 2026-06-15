"use client"
import {ClientConfig, ClientType, EndPoints, OptimizationTask} from "@/lib/client/ClientTypes";
import {Request} from "@/lib/client/Tunnel";
import {RequestServer} from "@/lib/client/CloudTunnel";

export class Client {

    config: ClientConfig;
    MessageSource: EventSource | null = null;

    public constructor(config:ClientConfig) {
        this.config = config;
    }

    public async TestConnection():Promise<number>{
        if(this.config.type == ClientType.LOCAL)
            try{
                await Request(EndPoints.health, this.config);
                return 200;
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

    public async LoadModel(){
        if(this.config.type === "LOCAL"){
            try {
                return await Request(EndPoints.referenceModel, this.config, this.config.apiKey);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }


    public async LoadCSV(){
        if(this.config.type === "LOCAL"){
            try {
                return await Request(EndPoints.referenceCSV, this.config, this.config.apiKey);
            } catch (e) {
                return new Error("Request failed:", {cause: e})
            }
        }
    }

}