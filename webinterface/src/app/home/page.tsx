"use client"
import React, {useEffect, useState} from "react";
import {useClientStore} from "@/lib/store";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import {useRouter} from "next/navigation";
import {toast} from "sonner";

import "./styles.css"
import {createConfig, deleteConfig, getConfigs, updateConfig} from "@/lib/db/configs";
import {getSession} from "next-auth/react";
import {OpenProject} from "@/lib/windows/Actions";
import {useDockviewStore, useSelectedStore, useVisualisationStore} from "@/lib/store";
import ProjectsPage from "@/components/pages/ProjectsPage";
import ConfigsPage from "@/components/pages/ConfigsPage";
import {AnimatePresence, motion} from "framer-motion";
import Style from "@/components/structural/MenuBar.module.css";

export default function Home() {
    const [activeConfig, setActiveConfig] = useState<number|undefined|null>();
    const [configStatus, setConfigStatus] = useState<string>("Offline")
    const [configs, setConfigs] = useState<ClientConfig[]>([]);

    const [openPage, setOpenPage] = useState<number>(0);



    const setClient = useClientStore(state => state.setConfig);
    const clearClient = useClientStore(state => state.clearClient);
    const clearApi = useDockviewStore(state => state.clearApi);
    const clearSelected = useSelectedStore(state => state.clearSelected);
    const clearVisualisation = useVisualisationStore(state => state.clearVisualisation);


    async function loadConfigs(){
        sessionStorage.removeItem("activeProject");
        sessionStorage.removeItem("visRes");
        sessionStorage.removeItem("loadedProject");
        clearClient();
        clearApi();
        clearSelected();
        clearVisualisation();
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



    async function loadClient(index: number, setMemory?:boolean, _client?:any){
        setConfigStatus("Connecting");
        if(setMemory==null || setMemory===true) {
            sessionStorage.setItem("activeConfig", JSON.stringify(configs[index]));
            console.log(configs[index]);
        }
        setActiveConfig(index);

        let client = useClientStore.getState().client;
        if(_client)
            client = _client;
        if(!client){
            useClientStore.getState().setConfig(configs[index]);
        }
        client = useClientStore.getState().client;
        console.log(client);
        if(client){
            const res = await client.TestConnection();
            console.log(res);
            if(res.Status === "Timed out")
            {
                setConfigStatus("Offline");
                setActiveConfig(null);
                toast.error("Connection timed out", { description:"Client probably offline"});
                return;
            }
            if(res.Status === true){
                setConfigStatus("Connected");
                toast.success("Connected", {duration: 5000});
            }
            else
                try{
                    await client.Initialize();
                    setConfigStatus("Connected");
                    toast.success("Connected", {duration: 5000});
                } catch (e) {
                    setActiveConfig(null);
                    setConfigStatus("Offline");
                    toast.error("Failed to connect", {duration: 5000, description: res.status});
                }
        }
    }



    useEffect(()=>{
        loadConfigs();
    }, [])

    // @ts-ignore
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
                    <ConfigsPage configs={configs} activeConfig={activeConfig} clientStatus={configStatus} onClientSelect={loadClient} setConfigs={setConfigs} loadConfigs={()=>{ loadConfigs();}}/>
                }
            </AnimatePresence>

        </main>
    )
}