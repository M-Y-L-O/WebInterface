"use client"
import React from 'react';
import {useRouter} from "next/navigation";
import {useClientStore, useDockviewStore} from "@/lib/store";
import {LoadModel, LoadCSV, SaveProject, SaveProjectToCloud, OpenProject} from "@/lib/windows/Actions";
import Style from "./MenuBar.module.css"
import {AnimatePresence, motion} from "framer-motion";


interface ActionButton{
    label:string,
    onClick?:()=>void,
    children?:ActionButton[]
}


export default function MenuBar(){
    const client = useClientStore(state => state.client);

    const router = useRouter();

    const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);


    const api = useDockviewStore(state => state.api);
    function openPanel(component:string, id:string, title:string, params?:Record<string, unknown>){
        if(!api)
            return;

        const existing = api.getPanel(id);
        if(existing){
            existing.api.setActive();
            return;
        }

        api.addPanel({id, component, title, params} as any);
    }

    function addWindow(window:string, title?:string){
        openPanel(window, window, title || window)
    }

    const MenuButtons:ActionButton[] = [
        {
            label:"Project",
            children:[
                {
                    label:"Save Project",
                    onClick:()=>SaveProject(client)
                },
                {
                    label:"Save to Cloud",
                    onClick: async () => {
                        const result = await SaveProjectToCloud(client);
                        if (result === "needs_overwrite") {
                            if (window.confirm("A cloud project with this name already exists. Overwrite it?")) {
                                await SaveProjectToCloud(client, {overwrite: true});
                            }
                        }
                    }
                },
                {
                    label:"Open Project",
                    onClick:()=>OpenProject(client)
                },
                {
                    label:"Load Model",
                    onClick:()=>LoadModel(client)

                },
                {
                    label:"Load CSV",
                    onClick:()=>LoadCSV(client)
                }
            ]
        },
        {
            label:"View",
            children:[
                {
                    label:"Project Manager",
                    onClick:()=>addWindow("FileExplorer", "Project Manager")
                },
                {
                    label:"Dataset Info",
                    onClick:()=>addWindow("DataInfo")
                },
                {
                    label:"Data viewer",
                    onClick:()=>addWindow("DataViewer")
                },
                {
                    label:"Properties",
                    onClick:()=>addWindow("Properties")
                },
            ]
        },
    ]

    const dropdownVariants = {
        hidden: { opacity: 0, y: -10, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -10, scale: 0.95 },
    }

    return (
        <nav className={Style.container}>
            <button className={Style.homeButton} onClick={()=>{router.push("/home")}}>
                <img src={"/logo.svg"}/>
            </button>
                <motion.div className={Style.menuHolder} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}} onMouseEnter={()=>{setHoveredIndex(null)}}>
                {
                    MenuButtons.map((button, index)=>{
                        const hasChildren = !!button.children?.length;
                        const isOpen = hoveredIndex === index;
                        return(
                            <div key={index} onMouseEnter={()=>{setHoveredIndex(index)}} onMouseLeave={()=>{setHoveredIndex(null)}} className={Style.menuItem}>
                                <button onClick={button.onClick} className={"relative"}>
                                    <span className={"relative z-10"} style={{zIndex:10}}>{button.label}</span>
                                    {
                                        isOpen && (
                                            <motion.div
                                                layoutId={"hoverHighlight"}
                                                transition={{
                                                    type:"spring",
                                                    stiffness: 300,
                                                    damping: 30,
                                                    duration: 0.15,
                                                }}
                                                exit={{opacity:0}}
                                            className={Style.pill}>

                                            </motion.div>
                                        )
                                    }
                                </button>
                                <AnimatePresence >
                                    {   hasChildren && isOpen &&
                                        <motion.div className={Style.dropdown} variants={dropdownVariants} initial="hidden" animate="visible" exit="exit">
                                            {
                                                hoveredIndex === index &&
                                                button.children?.map((child, i)=>{
                                                    return(
                                                        <button key={i} onClick={child.onClick}>{child.label}</button>
                                                    )
                                                })
                                            }
                                        </motion.div>
                                    }
                                </AnimatePresence>
                            </div>
                        )
                    })
                }
                </motion.div>
        </nav>
    )
}