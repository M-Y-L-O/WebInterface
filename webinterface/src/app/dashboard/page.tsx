"use client"
import MenuBar from "@/components/structural/MenuBar";
import WindowManager from "@/components/windows/WindowManager";
import {useClientStore} from "@/lib/store";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";

export default function Dashboard() {
    const clientConfig:ClientConfig = {
        type: ClientType.LOCAL,
        name: "Local",
        address: "http://127.0.0.1:8080",
        apiKey: "1234567890",
    }

    const setConfig= useClientStore(state => state.setConfig);
    setConfig(clientConfig);
    return(
        <main className={"w-[100vw] h-[100vh]"}>
            <MenuBar />
            <div className={"w-[100vw] h-[100%]"}>
                <WindowManager/>

            </div>
        </main>
    )
}