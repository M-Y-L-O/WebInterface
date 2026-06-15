"use client"
import MenuBar from "@/components/structural/MenuBar";
import WindowManager from "@/components/windows/WindowManager";
import {getSession} from "next-auth/react";
import {useEffect} from "react";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import "./styles.css"
import {useClientStore, useUserSessionStore} from "@/lib/store";

export default function Dashboard() {
    const setSession = useUserSessionStore(state => state.setSession);
    const setClient = useClientStore(state=> state.setConfig)
    const clientConfig:ClientConfig = {
        type: ClientType.LOCAL,
        name: "Local",
        address: "http://127.0.0.1:8080",
        apiKey: "1234567890",
    }
    setClient(clientConfig);

    async function getSessionData(){
        const session = await getSession();
        setSession(session);
    }

    useEffect(() => {
        getSessionData();
    }, []);

    return(
        <main className={"dashCont"}>
            <MenuBar />
            <div className={"w-[100vw] h-[100%]"}>
                <WindowManager/>

            </div>
        </main>
    )
}