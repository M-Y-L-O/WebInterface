"use client"
import MenuBar from "@/components/structural/MenuBar";
import WindowManager from "@/components/windows/WindowManager";
import {getSession} from "next-auth/react";
import {useEffect} from "react";
import "./styles.css"
import { useUserSessionStore} from "@/lib/store";

export default function Dashboard() {
    const setSession = useUserSessionStore(state => state.setSession);


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