import { useState } from "react";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import {deleteConfig, updateConfig, createConfig, renameConfig} from "@/lib/db/configs";
import {getSession} from "next-auth/react";
import {toast} from "sonner";
import Style from "./page.module.css"
import {provisionCloudSession, teardownCloudSession} from "@/lib/cloud/sessionClient";

export default function ConfigsPage({configs, activeConfig, clientStatus, onClientSelect, setConfigs, loadConfigs}:{configs:ClientConfig[], activeConfig:number|null|undefined, clientStatus:string, onClientSelect:(index:number)=>void, setConfigs: (configs:ClientConfig[]) => void, loadConfigs:()=>void}) {
    const [address, setAddress] = useState<string>("http://127.0.0.1:8080");
    const [apikey, setAPIKey] = useState<string>("1234");
    const [name, setName] = useState<string>("New config");
    const [type, setType] = useState<string>("local")
    const [showForm, setShowForm] = useState<boolean>(false);
    const [editing, setediting] = useState<boolean>(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [restartingId, setRestartingId] = useState<string | null>(null);

    const isCloud = type.toLowerCase() === "cloud";

    async function deleteClient(index:number){
        const config = configs[index];
        if (config.type === ClientType.CLOUD && config.dbId) {
            await teardownCloudSession(config.dbId);
        }
        const newConfigs = configs.filter((c, i)=>i !== index);
        setConfigs(newConfigs);
        await deleteConfig(config.dbId!);
    }

    async function restartCloud(index: number) {
        const config = configs[index];
        if (config.type !== ClientType.CLOUD || !config.dbId) return;

        setRestartingId(config.dbId);
        const toastId = toast.loading("Restarting cloud session…");
        try {
            const result = await provisionCloudSession({
                configId: config.dbId,
                name: config.name,
            });
            if (!result.ok) {
                toast.error("Failed to restart cloud session", {
                    id: toastId,
                    description: result.error,
                    duration: 5000,
                });
                return;
            }
            const newConfigs = [...configs];
            newConfigs[index] = result.config;
            setConfigs(newConfigs);
            toast.success("Cloud session restarted", { id: toastId, duration: 5000 });
            await onClientSelect(index);
        } finally {
            setRestartingId(null);
        }
    }

    async function createClient(){
        const session = await getSession();
        if(!session)
            return;

        setBusy(true);
        try {
            if (isCloud) {
                const result = await provisionCloudSession({ name });
                if (!result.ok) {
                    toast.error("Failed to start cloud session", {
                        duration: 5000,
                        description: result.error,
                    });
                    return;
                }
                setConfigs([...configs, result.config]);
                setShowForm(false);
                toast.success("Cloud session ready", {duration: 5000});
                return;
            }

            const config:ClientConfig = {
                name: name,
                address: address,
                apiKey: apikey,
                type: ClientType.LOCAL,
            }
            //@ts-ignore
            const returnedConfig = await createConfig(session.user.id, config);
            if(returnedConfig){
                setConfigs([...configs, returnedConfig]);
                setShowForm(false);
                toast.success("Client created", {duration: 5000});
            } else {
                toast.error("Failed to create client", {duration: 5000});
            }
        } finally {
            setBusy(false);
        }
    }

    async function updateClient(){
        if(editingIndex===null)
            return;
        const existing = configs[editingIndex];

        if (isCloud) {
            if (!existing.dbId) return;
            setBusy(true);
            try {
                await renameConfig(existing.dbId, name);
                const newConfigs = [...configs];
                newConfigs[editingIndex] = { ...existing, name };
                setConfigs(newConfigs);
                setShowForm(false);
                toast.success("Client updated", {duration: 5000});
            } finally {
                setBusy(false);
            }
            return;
        }

        const config:ClientConfig = {
            name: name,
            address: address,
            apiKey: apikey,
            type: ClientType.LOCAL,
            dbId: existing.dbId,
        }

        const newConfigs = [...configs];
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
                            const isRestarting = restartingId === config.dbId;
                            return <div key={config.dbId ?? i} className={`${Style.option} ${activeConfig===i ? Style.active : ""}`} onClick={()=>{
                                onClientSelect(i);
                            }}>
                                <div className={"flex flex-col items-start mb-[1rem]"}>
                                    <h1>{config.name}</h1>
                                    <h2>{config.type.toString()}</h2>
                                </div>
                                <div className={"flex justify-between items-center gap-2 flex-col"}>
                                    {config.type === ClientType.CLOUD && (
                                        <button
                                            className={Style.editButton}
                                            title="Restart cloud session"
                                            disabled={isRestarting}
                                            onClick={(e)=>{
                                                e.stopPropagation();
                                                void restartCloud(i);
                                            }}
                                        >
                                            <i className={`fa-solid fa-rotate-right ${isRestarting ? "fa-spin" : ""}`}/>
                                        </button>
                                    )}
                                    <button className={Style.editButton} onClick={(e)=>{
                                        e.stopPropagation();

                                        setediting(true);
                                        setShowForm(true);
                                        setAddress(config.address);
                                        setAPIKey(config.apiKey);
                                        setName(config.name);
                                        setType(config.type === ClientType.CLOUD ? "cloud" : "local");
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
                <div className={Style.overlay}>
                    <div className={Style.form}>
                        <h1>{editing ? "Edit client connection:" : "Create new client:"}</h1>
                        <input type={"text"} placeholder={"Config Name"} defaultValue={name} onChange={(e)=>{setName(e.target.value)}}/>
                        <select defaultValue={type.toLowerCase()} onChange={(e)=>{setType(e.target.value)}} disabled={editing}>
                            <option value={"local"}>LOCAL</option>
                            <option value={"cloud"}>CLOUD</option>
                        </select>
                        {!isCloud && (
                            <>
                                <input type={"text"} placeholder={"Address"} defaultValue={address}  onChange={(e)=>{setAddress(e.target.value)}}/>
                                <input type={"text"} placeholder={"API Key"} defaultValue={apikey} onChange={(e)=>{setAPIKey(e.target.value)}}/>
                            </>
                        )}
                        {isCloud && (
                            <p style={{opacity: 0.7, fontSize: "0.9rem", margin: 0}}>
                                {editing
                                    ? "Cloud address and API key are managed automatically. Use the restart button on the card to spin up a fresh container."
                                    : "Creates a Docker agent via the orchestrator. No address or API key needed."}
                            </p>
                        )}
                        <button className={Style.mainButton} disabled={busy} onClick={editing ? updateClient : createClient}>
                            {busy ? "Working…" : editing ? "Save" : (isCloud ? "Start cloud session" : "Create")}
                        </button>
                        <button className={Style.closeButton} onClick={()=>{setShowForm(false)}}>Cancel</button>
                    </div>
                </div>
            }
        </div>
    )
}
