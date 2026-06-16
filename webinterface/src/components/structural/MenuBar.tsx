"use client"
import React from 'react';
import {useDockviewStore, useVisualisationStore} from "@/lib/store";
import {useClientStore} from "@/lib/store";
import Style from "./MenuBar.module.css"

interface ActionButton{
    label:string,
    onClick?:()=>void,
    children?:ActionButton[]
}


export default function MenuBar(){
    const client = useClientStore(state => state.client);
    const setVis =         useVisualisationStore(state => state.setVisualisation)
    const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

    async function LoadModel(){
        if(!client)
            return;
        console.log("Loading model");
        const res = await client.LoadModel();
        setVis(JSON.stringify(res));
        sessionStorage.setItem("model", JSON.stringify(res));
    }

    async function LoadCSV(){
        if(!client)
            return;
        const res = await client.LoadCSV();
        console.log(res);
    }

    const api = useDockviewStore.getState().api;
    function addWindow(window:string){
        if(api){

            const existing = api.getPanel(window);
            if(existing){
                existing.api.setActive();
                return;
            }

            api.addPanel({id: window, component: window, title: window})
        }
    }

    const MenuButtons:ActionButton[] = [
        {
            label:"File",
            children:[
                {
                    label:"Import Model",
                    onClick:()=>LoadModel()
                },
                {
                    label:"Import CSV",
                    onClick:()=>LoadCSV()
                }
            ]
        },
        {
            label:"Visualizer",
            onClick:()=>addWindow("Visualiser")
        },
        {
            label:"Properties",
            onClick:()=>addWindow("Properties")
        },
        {
            label:"Settings",
            onClick:()=>addWindow("Settings")
        },
    ]

    return (
        <nav className={Style.container}>
            <button className={Style.homeButton}>
                <img src={"/logo.svg"}/>
            </button>
            <div className={Style.menuHolder}>
            {
                MenuButtons.map((button, index)=>{
                    const hasChildren = !!button.children?.length;
                    return(
                        <div key={index} onMouseEnter={()=>{setHoveredIndex(index)}} onMouseLeave={()=>{setHoveredIndex(null)}} className={Style.menuItem}>
                            <button onClick={button.onClick} >{button.label}</button>
                            {   hasChildren &&
                                <div className={Style.dropdown}>
                                    {
                                        hoveredIndex === index &&
                                        button.children?.map((child, i)=>{
                                            return(
                                                <button key={i} onClick={child.onClick}>{child.label}</button>
                                            )
                                        })
                                    }
                                </div>
                            }
                        </div>
                    )
                })
            }
            </div>
        </nav>
    )
}