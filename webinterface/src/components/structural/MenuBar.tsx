"use client"
import React from 'react';
import {useDockviewStore} from "@/lib/store";
import {useClientStore} from "@/lib/store";

export default function MenuBar(){
    const client = useClientStore(state => state.client);
    async function LoadModel(){
        if(!client)
            return;
        console.log(client);
        console.log(await client.LoadModel());
    }

    function addWindow(window:string){
        let api = useDockviewStore.getState().api;
        if(api){

            const existing = api.getPanel(window);
            if(existing){
                existing.api.setActive();
                return;
            }

            api.addPanel({id: window, component: window, title: window})
        }
    }
    return (
        <nav className={"flex gap-[2rem]"}>
            <div>
                <h1>MYLO</h1>
            </div>
            <button onClick={()=>addWindow("Visualiser")}>
                Visualiser
            </button>
            <button onClick={()=>addWindow("Settings")}>
                Settings
            </button>
            <button onClick={()=>{
                LoadModel();
            }}>
                Load Model
            </button>
        </nav>
    )
}