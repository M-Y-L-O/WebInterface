"use client"
import React, {useEffect, useState} from "react";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import {toast} from "sonner";

import "./styles.css"
import {getConfigs} from "@/lib/db/configs";
import {getSession} from "next-auth/react";
import {
    migrateLegacySessionStorage,
    onStoresHydrated,
    resetSessionForHome,
    storesHaveHydrated,
    useClientStore,
} from "@/lib/store";
import ProjectsPage from "@/components/pages/ProjectsPage";
import ConfigsPage from "@/components/pages/ConfigsPage";
import CatalogPage from "@/components/pages/CatalogPage";
import {AnimatePresence, motion} from "framer-motion";
import {provisionCloudSession} from "@/lib/cloud/sessionClient";

export default function Home() {
    const [activeConfig, setActiveConfig] = useState<number|undefined|null>();
    const [configs, setConfigs] = useState<ClientConfig[]>([]);
    const [openPage, setOpenPage] = useState<number>(0);
    const [hydrated, setHydrated] = useState(false);

    const status = useClientStore(state => state.status);
    const connect = useClientStore(state => state.connect);
    const clearClient = useClientStore(state => state.clearClient);

    const configStatus =
        status === "connected" ? "Connected" :
        status === "connecting" ? "Connecting" :
        "Offline";

    async function loadConfigs(){
        migrateLegacySessionStorage();
        resetSessionForHome();

        const session = await getSession();
        if(!session)
            return;
        //@ts-ignore
        const nextConfigs = await getConfigs(session.user.id);
        setConfigs(nextConfigs);

        if(nextConfigs.length === 0){
            clearClient();
            setActiveConfig(null);
            return;
        }

        const preferred = useClientStore.getState().config;
        if(preferred?.dbId){
            const index = nextConfigs.findIndex((c)=>c.dbId === preferred.dbId);
            if(index !== -1){
                await selectClient(index, nextConfigs);
                return;
            }
        }

        clearClient();
        setActiveConfig(null);
    }

    async function selectClient(index: number, list: ClientConfig[] = configs, allowRestart = true){
        const config = list[index];
        if(!config) return;

        setActiveConfig(index);
        const result = await connect(config);

        if(result.status === "timed_out" || !result.ok){
            // Dead / unreachable cloud container → restart once, then reconnect.
            if (allowRestart && config.type === ClientType.CLOUD && config.dbId) {
                const toastId = toast.loading("Cloud agent unreachable — restarting session…");
                const restarted = await provisionCloudSession({
                    configId: config.dbId,
                    name: config.name,
                });
                if (restarted.ok) {
                    const nextList = [...list];
                    nextList[index] = restarted.config;
                    setConfigs(nextList);
                    toast.success("Cloud session restarted", { id: toastId, duration: 4000 });
                    await selectClient(index, nextList, false);
                    return;
                }
                toast.error("Failed to restart cloud session", {
                    id: toastId,
                    duration: 5000,
                    description: restarted.error,
                });
            }

            setActiveConfig(null);
            if (result.status === "timed_out") {
                toast.error("Connection timed out", { description:"Client probably offline"});
            } else {
                toast.error("Failed to connect", {
                    duration: 5000,
                    description: result.error || "Unknown error",
                });
            }
            return;
        }

        toast.success("Connected", {duration: 5000});
    }

    useEffect(() => {
        if (storesHaveHydrated()) {
            setHydrated(true);
        }
        return onStoresHydrated(() => setHydrated(true));
    }, []);

    useEffect(()=>{
        if (!hydrated) return;
        void loadConfigs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrated])

    return (
        <main>
                <div className={"hero"}>
                    <img src={"/Wordmark.svg"}/>
                </div>
            <nav className={"navBar"}>
                <div className={"navBarItems"}>
                    <button onClick={()=>{setOpenPage(0)}}>
                        <span className={"relative z-10"} style={openPage===0 ? {color:"var(--card-background)"}:{}}>Projects</span>
                        {
                            openPage === 0 && (
                                <motion.div
                                    layoutId={"activePill"}
                                    transition={{
                                        type:"spring",
                                        stiffness: 300,
                                        damping: 30,
                                        duration: 0.15,
                                    }}
                                    exit={{opacity:0}}
                                    className={"active"}>

                                </motion.div>
                            )
                        }
                    </button>
                    <button onClick={()=>{setOpenPage(1)}}>
                        <span className={"relative z-10"} style={openPage===1 ? {color:"var(--card-background)"}:{}}>Clients</span>
                        {
                            openPage === 1 && (
                                <motion.div
                                    layoutId={"activePill"}
                                    transition={{
                                        type:"spring",
                                        stiffness: 300,
                                        damping: 30,
                                        duration: 0.15,
                                    }}
                                    exit={{opacity:0}}
                                    className={"active"}>

                                </motion.div>
                            )
                        }
                    </button>
                    <button onClick={()=>{setOpenPage(2)}}>
                        <span className={"relative z-10"} style={openPage===2 ? {color:"var(--card-background)"}:{}}>Catalog</span>
                        {
                            openPage === 2 && (
                                <motion.div
                                    layoutId={"activePill"}
                                    transition={{
                                        type:"spring",
                                        stiffness: 300,
                                        damping: 30,
                                        duration: 0.15,
                                    }}
                                    exit={{opacity:0}}
                                    className={"active"}>

                                </motion.div>
                            )
                        }
                    </button>
                    <button >Docs</button>
                </div>
            </nav>
            <AnimatePresence>
                {
                    openPage === 0 &&
                        <ProjectsPage activeConfig={configs[activeConfig!]} clientStatus={configStatus} onStatusClick={()=>{setOpenPage(1);}}/>
                }
                {
                    openPage === 1 &&
                    <ConfigsPage configs={configs} activeConfig={activeConfig} clientStatus={configStatus} onClientSelect={(i)=>selectClient(i)} setConfigs={setConfigs} loadConfigs={()=>{ void loadConfigs();}}/>
                }
                {
                    openPage === 2 &&
                    <CatalogPage clientStatus={configStatus}/>
                }
            </AnimatePresence>

        </main>
    )
}
