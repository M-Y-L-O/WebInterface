"use client"
import {toast} from 'sonner'
import {useClientStore} from "@/lib/store";
import {Client} from "@/lib/client/Client";

export async function LoadModel(client:any, setVis:any){

    const toastId = toast.loading("Processing Model...");
    if(!client){
        toast.error("No client connected", {id: toastId, duration: 5000});
        return;
    }
    try {
        const file = await client.GetFile(".onnx")
        if(file === undefined || !file)
            throw new Error("Failed to load model: No file found")

        const res = await client.LoadModel(file);

        if(!res || res==="undefined" || res === "null" || res===undefined || res.message === "Request failed:")
            throw new Error("Failed to load model: Invalid response" + res)

        setVis(JSON.stringify(res));
        sessionStorage.setItem("visRes", JSON.stringify(res));
        toast.success("Model loaded", {id: toastId, duration: 5000});
    } catch (e) {
        // @ts-ignore
        toast.error("Failed to load model", {id: toastId, duration: 5000, description: e.message});
    }
}

export async function LoadCSV(client:Client){
    const toastId = toast.loading("Processing CSV...")
    if(!client) {
        toast.error("No client connected", {id: toastId, duration: 5000});
        return;
    }
    try {
        const file = await client.GetFile(".csv")
        if(file === undefined || !file)
            throw new Error("Failed to load CSV: No file found")
        const res = await client.LoadCSV(file);

        if(!res || res==="undefined" || res === "null" || res===undefined || res.message === "Request failed:")
            throw new Error("Failed to load CSV: Invalid response")

        sessionStorage.setItem("csv", JSON.stringify(res));
        console.log(res);
        toast.success("CSV loaded", {id: toastId, duration: 5000});
    } catch (e) {
        // @ts-ignore
        toast.error("Failed to load CSV", {id: toastId, duration: 5000, description: e.message});
    }
}

export async function SaveProject(client:Client){
    if(!client)
        return;
    const res = await client.ExportProject();
    console.log(res);
}

export async function OpenProject(client:Client){
    if(!client){
        toast.error("No client connected", {duration: 5000});
        return 400;
    }


    const file = await client.GetFile(".mylo");
    if(!file)
    {
        toast.error("No project found", {duration: 5000});
        return 400;
    }

    const res = await client.loadProject(file);
    if(!res || res.message !== "success"){
        toast.error("Failed to open project", {duration: 5000, description: res.message});
        return 400;
    }

    const activeProject = await client.getProject();

    sessionStorage.removeItem("loadedProject");
    sessionStorage.removeItem("visRes");


    sessionStorage.setItem("loadedProject", JSON.stringify(activeProject));
    if(activeProject.modelData)
        sessionStorage.setItem("visRes", JSON.stringify(activeProject.modelData));

    toast.success("Project opened", {duration: 5000});
    return 200;

}

export async function NewProject(name:string){

}

async function loadClient(){
    const configS = sessionStorage.getItem("activeConfig");
    if(!configS)
    {
        toast.error("No client config found", {duration: 5000});
        return;
    }
    const config = JSON.parse(configS);
    setClient(config);
    let client = useClientStore.getState().client;

    if(!client || typeof client === "undefined"){
        toast.error("There has been a problem constructing the client", {duration: 5000});
        return;
    }

    const res = await client.TestConnection();

    if(res.Status === "Timed out")
    {
        toast.error("Connection timed out", { description:"Client probably offline"});
        return;
    }

    if(res.Status === "True")
        toast.success("Connected", {duration: 5000});
    else
        try{
            await client.Initialize();
        } catch (e) {
            toast.error("Failed to connect", {duration: 5000, description: res.status});
            return;
        }


}

