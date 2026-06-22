"use client"
import React from 'react';
import {useRouter} from "next/navigation";
import {useClientStore, useDockviewStore, useVisualisationStore} from "@/lib/store";
import {LoadModel, LoadCSV, SaveProject, OpenProject} from "@/lib/windows/Actions";
import Style from "./MenuBar.module.css"


interface ActionButton{
    label:string,
    onClick?:()=>void,
    children?:ActionButton[]
}


export default function MenuBar(){
    const client = useClientStore(state => state.client);
    const setVis = useVisualisationStore(state => state.setVisualisation)

    const router = useRouter();

    const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);


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
                    onClick:()=>LoadModel(client, setVis)
                },
                {
                    label:"Import CSV",
                    onClick:()=>LoadCSV(client)
                },
                {
                    label:"Save Project",
                    onClick:()=>SaveProject(client)
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
            <button className={Style.homeButton} onClick={()=>{router.push("/home")}}>
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