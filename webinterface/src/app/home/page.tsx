"use client"
import {useEffect, useState} from "react";
import {useClientStore} from "@/lib/store";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import {useRouter} from "next/navigation";
import {toast} from "sonner";

import "./styles.css"
import {createConfig, deleteConfig, getConfigs, updateConfig} from "@/lib/db/configs";
import {getSession} from "next-auth/react";
import {OpenProject} from "@/lib/windows/Actions";

export default function Home() {
    const [activeConfig, setActiveConfig] = useState<number>();
    const [address, setAddress] = useState<string>("http://127.0.0.1:8080");
    const [apikey, setAPIKey] = useState<string>("1234");
    const [name, setName] = useState<string>("New config");
    const [type, setType] = useState<string>("local")
    const [showForm, setShowForm] = useState<boolean>(false);
    const [editing, setediting] = useState<boolean>(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [newProjectForm, setNewProjectForm] = useState<boolean>(false);
    const [newProjectName, setNewProjectName] = useState<string>("");

    const [activeProject, setActiveProject] = useState<any | null>(null);

    const setClient = useClientStore(state => state.setConfig);

    const [configs, setConfigs] = useState<ClientConfig[]>([]);

    const router = useRouter();

    async function loadConfigs(){
        sessionStorage.removeItem("activeProject");
        sessionStorage.removeItem("visRes");
        sessionStorage.removeItem("loadedProject");
        const session = await getSession();
        if(!session)
            return;
        //@ts-ignore
        const configs = await getConfigs(session.user.id);
        setConfigs(configs);

        if(configs.length > 0){
            const activeConfig = sessionStorage.getItem("activeConfig");
            if(activeConfig && activeConfig!="undefined"){
                const parsed = JSON.parse(activeConfig);
                const index = configs.findIndex((c)=>c.dbId === parsed.dbId);
                if(index !== -1){
                    setClient(configs[index]);
                    sessionStorage.setItem("activeConfig", JSON.stringify(configs[index]));
                    setActiveConfig(index);

                    await loadClient(index, false, useClientStore.getState().client);
                    console.log(index);
                }
            }
        }
    }

    async function createClient(){
        const config:ClientConfig = {
            name: name,
            address: address,
            apiKey: apikey,
            type: type.toLowerCase()=="local"? ClientType.LOCAL : ClientType.CLOUD,
        }
        const session = await getSession();
        console.log(session);
        if(!session)
            return;
        //@ts-ignore
        const returnedConfig = await createConfig(session.user.id, config);
        if(returnedConfig){
            setConfigs([...configs, returnedConfig]);
            setShowForm(false);
            toast.success("Client created", {duration: 5000});
        } else {
            toast.error("Failed to create client", {duration: 5000});
        }

    }

    async function deleteClient(index:number){
        const config = configs[index];
        const newConfigs = configs.filter((c, i)=>i !== index);
        setConfigs(newConfigs);
        await deleteConfig(config.dbId!);
    }

    async function updateClient(){
        if(editingIndex===null)
            return;
        const config:ClientConfig = {
            name: name,
            address: address,
            apiKey: apikey,
            type: type.toLowerCase()=="local"? ClientType.LOCAL : ClientType.CLOUD,
            dbId: configs[editingIndex].dbId,
        }

        const newConfigs = configs;
        newConfigs[editingIndex] = config;
        setConfigs(newConfigs);

        await updateConfig(config.dbId!, config)
        await loadConfigs();
        setShowForm(false);
        if(activeConfig === editingIndex)
            await loadClient(editingIndex);
        toast.success("Client updated", {duration: 5000});
    }

    async function loadClient(index: number, setMemory?:boolean, _client?:any){
        if(setMemory===true) {
            sessionStorage.setItem("activeConfig", JSON.stringify(configs[index]));
            console.log(configs[index]);
        }

        let client = useClientStore.getState().client;
        if(_client)
            client = _client;
        console.log(client);
        if(client){
            const res = await client.TestConnection();
            console.log(res);
            if(res.Status === "Timed out")
            {
                setActiveConfig(null);
                toast.error("Connection timed out", { description:"Client probably offline"});
                return;
            }
            if(res.Status === true)
                toast.success("Connected", {duration: 5000});
            else
                try{
                    await client.Initialize();
                } catch (e) {
                    setActiveConfig(null);
                    toast.error("Failed to connect", {duration: 5000, description: res.status});
                }
            loadActiveProject(client);
        }
    }

    async function loadActiveProject(client:any){
        const project = await client.getProject();
        if(project && project.projectData){
            setActiveProject(project);
            if(project.projectData.id) {
                sessionStorage.setItem("activeProject", JSON.stringify(project));
            }
        }
    }

    async function loadProject(index:number){
        if(index!=-1)
            pass;
        else {
            sessionStorage.setItem("loadedProject", JSON.stringify(activeProject));
            if(activeProject.modelData)
                sessionStorage.setItem("visRes", JSON.stringify(activeProject.modelData));

            router.push("/dashboard");
        }

    }

    async function uploadProject(){
        const client = useClientStore.getState().client;
        if(!client)
            return;

        const res = await OpenProject(client);
        if(res===200){
            router.push("/dashboard");
        }
    }

    useEffect(()=>{
        loadConfigs();
    }, [])

    // @ts-ignore
    return (
        <main>
            <nav>
                <div>
                    <img src={"/Wordmark.svg"}/>
                </div>
            </nav>
            <div className={"section"}>
                <div className={"list"}>
                    <button className={"createButton"} onClick={uploadProject}>
                            <h1><i className={"fa-solid fa-file"}/> </h1>
                            <h2>Open from computer</h2>
                    </button>
                    <button className={"createButton"} onClick={()=>{
                        setNewProjectForm(true);
                        setNewProjectName("");
                    }}>
                        <i className={"fa-solid fa-plus-square"}/>
                        <h2>Create new</h2>
                    </button>

                </div>
                <h1 className={"title"}>Loaded Project:</h1>
                {
                    activeProject ?
                    <div className={"option ml-[1rem]"} onClick={()=>{loadProject(-1)}}>

                        <div className={"flex flex-col items-start mb-[1rem]"}>
                            <h1>{activeProject.projectData.name}</h1>
                            <h2>{activeProject.projectData.id}</h2>
                        </div>
                    </div> :
                        <div className={"option"}>
                            <h1>No project loaded</h1>
                            <i className={"fa-solid fa-folder-blank"}/>
                        </div>
                }
                <h1 className={"title"}>Cloud Saved:</h1>
                <div className={"list"}>
                    <div>
                        <h1>No cloud saved</h1>
                        <i className={"fa-solid fa-folder-blank"}/>
                    </div>
                </div>
            </div>
            <div className={"section"}>
                <h1>Clients</h1>
                <div className={"list"}>
                    <button className={"createButton"} onClick={()=>{
                        setShowForm(true);
                        setediting(false);
                        setAddress("http://127.0.0.1:8080");
                        setAPIKey("1234");
                        setName("New config");
                        setType("local");
                    }}>
                        <i className={"fa-solid fa-plus-square"}/>
                    </button>
                    {
                        configs.map((config, i)=>{
                            return <div key={i} className={`option ${activeConfig===i ? "active" : ""}`} onClick={()=>{
                                setActiveConfig(i);
                                setClient(configs[i]);
                                loadClient(i, true);
                            }}>
                                <div className={"flex flex-col items-start mb-[1rem]"}>
                                    <h1>{config.name}</h1>
                                    <h2>{config.type.toString()}</h2>
                                </div>
                                <div className={"flex justify-between items-center gap-2 flex-col"}>
                                    <button className={"editButton"} onClick={(e)=>{
                                        e.stopPropagation();

                                        setediting(true);
                                        setShowForm(true);
                                        setAddress(config.address);
                                        setAPIKey(config.apiKey);
                                        setName(config.name);
                                        setType(config.type.toString());
                                        setEditingIndex(i);
                                    }}><i className={"fa-solid fa-pen"}/></button>
                                    <button className={"deleteButton"} onClick={(e)=>{
                                        e.stopPropagation();
                                        deleteClient(i)}}>
                                        <i className={"fa-solid fa-trash-can"}/>
                                    </button>
                                </div>
                            </div>
                        })
                    }
                </div>
            </div>
            { showForm &&
                <div className={"overlay"}>
                    <div className={"form"}>
                        <button className={"closeButton"} onClick={()=>{setShowForm(false)}}><i className={"fa-solid fa-close"}/> </button>
                        <h1>{editing ? "Edit client connection:" : "Create new client:"}</h1>
                        <input type={"text"} placeholder={"Config Name"} defaultValue={name} onChange={(e)=>{setName(e.target.value)}}/>
                        <select defaultValue={type.toLowerCase()} onChange={(e)=>{setType(e.target.value)}}>
                            <option value={"local"}>LOCAL</option>
                            <option value={"cloud"}>CLOUD</option>
                        </select>
                        <input type={"text"} placeholder={"Address"} defaultValue={address}  onChange={(e)=>{setAddress(e.target.value)}}/>
                        <input type={"text"} placeholder={"API Key"} defaultValue={apikey} onChange={(e)=>{setAPIKey(e.target.value)}}/>
                        <button className={"mainButton"} onClick={editing ? updateClient : createClient}>{editing ? "Save" : "Create"}</button>
                    </div>
                </div>
            }
            {
                //@ts-ignore
                newProjectForm &&
                <div className={"overlay"}>
                    <div className={"form"}>
                        <h1>Name your new project:</h1>
                        <input type={"text"} placeholder={"Project Name"} defaultValue={newProjectName} onChange={(e)=>{setNewProjectName(e.target.value)}}/>
                        <button className={"mainButton"} onClick={()=>{
                            router.push(`/dashboard?project=${newProjectName}`);
                            setNewProjectForm(false);
                        }}>Create</button>
                        <button className={"mainButton"} onClick={()=>{setNewProjectForm(false)}}>Cancel</button>
                    </div>
                </div>
            }
        </main>
    )
}