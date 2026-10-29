import { useState } from "react";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import {deleteConfig, updateConfig, createConfig, renameConfig} from "@/lib/db/configs";
import {getSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import Style from "./page.module.css"
import {provisionCloudSession, teardownCloudSession} from "@/lib/cloud/sessionClient";
import Dropdown from "@/components/structural/Dropdown";
import { usePrefsStore } from "@/lib/settings/prefsStore";
import { DEFAULT_LOCAL_ADDRESS, DEFAULT_LOCAL_NAME } from "@/lib/client/localAgent";
import {router} from "next/client";

export default function ConfigsPage({configs, activeConfig, clientStatus, onClientSelect, setConfigs, loadConfigs, cloudEnabled = true}:{configs:ClientConfig[], activeConfig:number|null|undefined, clientStatus:string, onClientSelect:(index:number)=>void, setConfigs: (configs:ClientConfig[]) => void, loadConfigs:()=>void, cloudEnabled?: boolean}) {
    const localAgentAddress = usePrefsStore((s) => s.localAgentAddress);
    const localAgentName = usePrefsStore((s) => s.localAgentName);
    const [address, setAddress] = useState<string>(localAgentAddress || DEFAULT_LOCAL_ADDRESS);
    const [apikey, setAPIKey] = useState<string>("");
    const [name, setName] = useState<string>(localAgentName || DEFAULT_LOCAL_NAME);
    const [type, setType] = useState<string>("local")
    const [showForm, setShowForm] = useState<boolean>(false);
    const [editing, setEditing] = useState<boolean>(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [restartingId, setRestartingId] = useState<string | null>(null);
    const router = useRouter();

    const isCloud = type.toLowerCase() === "cloud";
    const typeOptions =
        !cloudEnabled && isCloud ? ["CLOUD"] :
        cloudEnabled ? ["LOCAL", "CLOUD"] :
        ["LOCAL"];

    async function deleteClient(index:number){
        const config = configs[index];
        if (config.type === ClientType.CLOUD && config.dbId) {
            await teardownCloudSession(config.dbId);
        }
        const newConfigs = configs.filter((c, i)=>i !== index);
        setConfigs(newConfigs);
        await deleteConfig(config.dbId!);
    }

    async function generateApiKey(){
        setAPIKey(crypto.randomUUID());
    }

    async function restartCloud(index: number) {
        const config = configs[index];
        if (!cloudEnabled || config.type !== ClientType.CLOUD || !config.dbId) return;

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
                if (!cloudEnabled) {
                    toast.error("Cloud features are disabled", {duration: 5000});
                    return;
                }
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
            const returnedConfig = await createConfig(config);
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
                <div className={"flex items-center gap-[1.618rem]"}>
                    <div className={`${Style.mainInfo} ml-[1rem]`}>
                        <h1>{activeConfig !== null && configs[activeConfig!] ? configs[activeConfig!].name : "No config loaded"}</h1>
                        <div className={"w-full"}>
                            <div className={"flex gap-[1rem] items-center w-full justify-between"}>
                                <h2>Type:</h2>  {activeConfig !== null && configs[activeConfig!] ? configs[activeConfig!].type.toString() : "-"}
                            </div>
                            <div className={"flex gap-[1rem] items-center w-full justify-between"}>
                                Status:<div className={Style.status} style={{borderColor:clientStatus==="Connected" ? "var(--success)" : "var(--error)"}}>{clientStatus}<div style={{backgroundColor:clientStatus==="Connected" ? "var(--success)" : "var(--error)"}} className={Style.ball}/></div>
                            </div>
                        </div>
                    </div>
                    <button className={Style.squareButton} onClick={()=>{router.push("/docs#local-agents")}}>
                        <i className={"fa-solid fa-book"}/>
                        How to add a local agent
                    </button>
                </div>
            </div>
            <div className={Style.section}>
                <h1 className={Style.title}>Configurations</h1>
                <div className={`${Style.list} ml-[1rem]`}>
                    <button className={Style.createButton} onClick={()=>{
                        setShowForm(true);
                        setEditing(false);
                        setAddress(localAgentAddress || DEFAULT_LOCAL_ADDRESS);
                        generateApiKey();
                        setName(localAgentName || DEFAULT_LOCAL_NAME);
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

                                    <button className={Style.editButton} onClick={(e)=>{
                                        e.stopPropagation();

                                        setEditing(true);
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
                        <Dropdown defaultValue={type.toUpperCase()} onChange={(e)=>{setType(e.toLowerCase())}} options={typeOptions}>
                        </Dropdown>
                        {!isCloud && (
                            <>
                                <input type={"text"} placeholder={"Address"} defaultValue={address}  onChange={(e)=>{setAddress(e.target.value)}}/>
                                <input type={"text"} placeholder={"API Key"} defaultValue={apikey} onChange={(e)=>{setAPIKey(e.target.value)}}/>
                            </>
                        )}
                        {isCloud && (
                            <p style={{opacity: 0.7, fontSize: "0.9rem", margin: 0}}>
                                {!cloudEnabled
                                    ? "Cloud features are disabled. You can rename or delete this config."
                                    : editing
                                    ? "Use the restart button on the card to spin up a fresh container."
                                    : "Creates a Docker agent via the orchestrator."}
                            </p>
                        )}
                        {isCloud && editing && cloudEnabled && (
                            <button
                                className={Style.closeButton}
                                title="Restart cloud session"

                                onClick={(e)=>{
                                    e.stopPropagation();
                                    void restartCloud(editingIndex!);
                                    setShowForm(false);
                                }}
                            >
                               Restart Client <i className={`fa-solid fa-rotate-right`}/>
                            </button>
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
