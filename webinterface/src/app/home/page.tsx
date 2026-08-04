"use client"
import React, {useLayoutEffect, useEffect, useState} from "react";
import Link from "next/link";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import {toast} from "sonner";

import "./styles.css"
import {getConfigs} from "@/lib/db/configs";
import {getSession, signOut} from "next-auth/react";
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
import {getCloudEnabled} from "@/lib/cloud/flags";
import {Session} from "next-auth";
import Dropdown from "@/components/structural/Dropdown";

export default function Home() {
    const [activeConfig, setActiveConfig] = useState<number|undefined|null>();
    const [configs, setConfigs] = useState<ClientConfig[]>([]);
    const [openPage, setOpenPage] = useState<number>(0);
    const [hydrated, setHydrated] = useState(false);
    const [session, setSession] = useState<Session|null>(null);
    const [profileDropdown, setProfileDropdown] = useState<boolean>(false);
    const [cloudEnabled, setCloudEnabled] = useState(true);

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
        setSession(session);
        const [nextConfigs, enabled] = await Promise.all([getConfigs(), getCloudEnabled()]);
        setCloudEnabled(enabled);
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
            if (cloudEnabled && allowRestart && config.type === ClientType.CLOUD && config.dbId) {
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

    useLayoutEffect(() => {
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
                    <img src={"/wordmark.svg"}/>
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
                    <Link href="/docs">Docs</Link>
                </div>
                <div className={"profile"}>
                    <button onClick={()=>{setProfileDropdown(!profileDropdown)}} className={ profileDropdown ? "profileButton border border-2 border-[var(--primary)] rounded-full" : "profileButton"}>
                        {
                            session?.user?.image ? <img src={session.user.image}/> : (<i className={"fa-solid fa-circle-user"} style={{fontSize:"3rem"}}></i>)
                        }
                    </button>
                    <AnimatePresence>
                    {
                        profileDropdown &&
                        <motion.div className={"dropdown"} initial={{height:0, opacity:0}} animate={{height:80, opacity:1}} exit={{height:0, opacity:0}} transition={{duration:0.2}}>
                            <button onClick={()=>{signOut()}}>Sign out <i className={"fa-solid fa-arrow-right-from-bracket"}></i></button>
                        </motion.div>
                    }
                    </AnimatePresence>
                </div>
            </nav>
            <AnimatePresence>
                {
                    openPage === 0 &&
                        <ProjectsPage activeConfig={configs[activeConfig!]} clientStatus={configStatus} onStatusClick={()=>{setOpenPage(1);}} cloudEnabled={cloudEnabled}/>
                }
                {
                    openPage === 1 &&
                    <ConfigsPage configs={configs} activeConfig={activeConfig} clientStatus={configStatus} onClientSelect={(i)=>selectClient(i)} setConfigs={setConfigs} loadConfigs={()=>{ void loadConfigs();}} cloudEnabled={cloudEnabled}/>
                }
                {
                    openPage === 2 &&
                    <CatalogPage clientStatus={configStatus}/>
                }
            </AnimatePresence>

        </main>
    )
}
