"use client"
import {useState} from "react";
import {useClientStore} from "@/lib/store";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";
import {useRouter} from "next/navigation";

export default function Home() {
    const setClient = useClientStore(state=> state.setConfig)
    const client = useClientStore(state => state.client);
    const [config, setConfig] = useState<ClientConfig>();
    const [address, setAddress] = useState<string>("http://127.0.0.1:8080");
    const [apikey, setAPIKey] = useState<string>("1234");
    const router = useRouter();

    function saveConfig(){
        setConfig({
            ...config!,
            apiKey: apikey,
            address: address,
            type: ClientType.LOCAL
        })

        setClient(config!);
    }

    async function connect(){
        if(!client)
            return;

        console.log(await client.Initialize());
    }

    return (
        <main>
            <nav>

            </nav>
            <div>
                <h1>Clients:</h1>
                <div>
                    <div>
                        <h2>Local</h2>
                        <input type="text" placeholder="Local Address" defaultValue={"http://127.0.0.1:8080"} onChange={(e)=>setAddress(e.target.value)}/>
                        <input type="text" placeholder="API Key" onChange={(e)=>setAPIKey(e.target.value)}/>
                        <button onClick={saveConfig}>Save</button>
                        <button onClick={connect}>Connect</button>
                    </div>
                </div>
            </div>
            <div>
                <h1>Cloud-Saved Projects:</h1>
            </div>
            <div>
                <h1>Recent Local Projects:</h1>
            </div>
            <button onClick={()=>{router.push("/dashboard")}}>
                Dashboard
            </button>
        </main>
    )
}