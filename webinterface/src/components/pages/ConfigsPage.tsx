import { useState } from "react";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import {deleteConfig, updateConfig, createConfig} from "@/lib/db/configs";
import {getSession} from "next-auth/react";
import {toast} from "sonner";
import Style from "./page.module.css"

export default function ConfigsPage({configs, activeConfig, clientStatus, onClientSelect, setConfigs, loadConfigs}:{configs:ClientConfig[], activeConfig:number|null|undefined, clientStatus:string, onClientSelect:(index:number)=>void, setConfigs: (configs:ClientConfig[]) => void, loadConfigs:()=>void}) {
    const [address, setAddress] = useState<string>("http://127.0.0.1:8080");
    const [apikey, setAPIKey] = useState<string>("1234");
    const [name, setName] = useState<string>("New config");
    const [type, setType] = useState<string>("local")
    const [showForm, setShowForm] = useState<boolean>(false);
    const [editing, setediting] = useState<boolean>(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    async function deleteClient(index:number){
        const config = configs[index];
        const newConfigs = configs.filter((c, i)=>i !== index);
        setConfigs(newConfigs);
        await deleteConfig(config.dbId!);
    }

    async function createClient(){
        const config:ClientConfig = {
            name: name,
            address: address,
            apiKey: apikey,
            type: type.toLowerCase()=="local"? ClientType.LOCAL : ClientType.CLOUD,
        }
        const session = await getSession();
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
            await onClientSelect(editingIndex);
        toast.success("Client updated", {duration: 5000});
    }

    return (
        <div className={Style.container}>
            <div className={Style.section}>
                <h1 className={Style.title}>Active client:</h1>
                <div className={Style.mainInfo}>
                    <div className={"flex flex-col items-start"}>
                        <h1>{activeConfig !== null && configs[activeConfig!] ? configs[activeConfig!].name : "No config loaded"}</h1>
                        <h2>{activeConfig !== null && configs[activeConfig!] ? configs[activeConfig!].type.toString() : "-"}</h2>
                    </div>
                    <div className={Style.status} style={{borderColor:clientStatus==="Connected" ? "var(--success)" : "var(--error)"}}>{clientStatus}<div style={{backgroundColor:clientStatus==="Connected" ? "var(--success)" : "var(--error)"}} className={Style.ball}/></div>
                </div>
            </div>
            <div className={Style.section}>
                <h1 className={Style.title}>Configurations</h1>
                <div className={Style.list}>
                    <button className={Style.createButton} onClick={()=>{
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
                            return <div key={i} className={`${Style.option} ${activeConfig===i ? Style.active : ""}`} onClick={()=>{
                                onClientSelect(i);
                            }}>
                                <div className={"flex flex-col items-start mb-[1rem]"}>
                                    <h1>{config.name}</h1>
                                    <h2>{config.type.toString()}</h2>
                                </div>
                                <div className={"flex justify-between items-center gap-2 flex-col"}>
                                    <button className={Style.editButton} onClick={(e)=>{
                                        e.stopPropagation();

                                        setediting(true);
                                        setShowForm(true);
                                        setAddress(config.address);
                                        setAPIKey(config.apiKey);
                                        setName(config.name);
                                        setType(config.type.toString());
                                        setEditingIndex(i);
                                    }}><i className={"fa-solid fa-pen"}/></button>
                                    <button className={Style.deleteButton} onClick={(e)=>{
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
        </div>
    )
}