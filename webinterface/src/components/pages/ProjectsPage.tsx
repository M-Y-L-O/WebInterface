import {useClientStore, useProjectStore} from "@/lib/store";
import {OpenProject} from "@/lib/windows/Actions";
import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {getSession} from "next-auth/react";
import {ClientConfig} from "@/lib/client/ClientTypes";
import Style from "./page.module.css"


export default function ProjectsPage({activeConfig, clientStatus, onStatusClick}:{activeConfig:ClientConfig, clientStatus:string, onStatusClick:()=>void}) {
    const [newProjectForm, setNewProjectForm] = useState<boolean>(false);
    const [newProjectName, setNewProjectName] = useState<string>("");
    const [userName, setUserName] = useState<string>("");

    const [activeProject, setActiveProject] = useState<any | null>(null);
    const hydrateFromProject = useProjectStore(state => state.hydrateFromProject);
    const router = useRouter();

    async function loadActiveProject(client:any){
        const project = await client.getProject();
        if(project && project.projectData){
            setActiveProject(project);
        }
    }

    async function loadProject(index:number){
        if(index!=-1)
            return;
        else {
            hydrateFromProject(activeProject);
            router.push("/dashboard");
        }

    }

    async function uploadProject(){
        const client = useClientStore.getState().client;
        if(!client)
            return;

        const res = await OpenProject(client);
        if(res===200){
            router.push("/dashboard");
        }
    }

    async function onLoad(){
        const session = await getSession();
        if(session){
            const name = session.user?.name;
            if(name)
                setUserName(name);
        }

        const client = useClientStore.getState().client;
        if(client){
            loadActiveProject(client);
        }
    }

    useEffect(() => {
        onLoad();
    }, []);

    useEffect(() => {
        const client = useClientStore.getState().client;
        if(client){
            loadActiveProject(client);
        }
    }, [activeConfig, clientStatus]);

    return (
        <div className={Style.container}>
            <h1 className={Style.title}>Welcome back, {userName}!</h1>
            <div className={Style.section}>
                <div className={Style.list}>
                    <button className={Style.createButton} onClick={uploadProject}>
                        <h1><i className={"fa-solid fa-file"}/> </h1>
                        <h2>Open from computer</h2>
                    </button>
                    <button className={Style.createButton} onClick={()=>{
                        setNewProjectForm(true);
                        setNewProjectName("");
                    }}>
                        <i className={"fa-solid fa-plus-square"}/>
                        <h2>Create new</h2>
                    </button>
                    <div className={Style.infoCard} onClick={onStatusClick}>
                        <h1>Current Client:</h1>
                        <div>
                            <h2>Name: {activeConfig ? activeConfig.name : "No config loaded"}</h2>
                            <h2>Type: {activeConfig ? activeConfig.type : "-"}</h2>
                        </div>
                        <div className={"flex gap-[4rem]"}>
                            Status:
                            <div className={Style.status} style={{borderColor:clientStatus==="Connected" ? "var(--success)" : "var(--error)"}}>{clientStatus}<div style={{backgroundColor:clientStatus==="Connected" ? "var(--success)" : "var(--error)"}} className={Style.ball}/></div>
                        </div>
                    </div>
                </div>
                <h1 className={Style.title}>Loaded Project:</h1>
                {
                    activeProject ?
                        <div className={`${Style.mainInfo} ml-[1rem]`} onClick={()=>{loadProject(-1)}}>
                            <div className={"flex flex-col items-start mb-[1rem]"}>
                                <h1>{activeProject.projectData.name}</h1>
                                <h2>Model file: {activeProject.projectData.modelFile ? activeProject.projectData.modelFile : "No model"}</h2>
                                <h2>CSV file : {activeProject.projectData.csvFile ? activeProject.projectData.csvFile:"No dataset"}</h2>
                            </div>
                            <div className={"flex justify-start items-center gap-2 flex-col h-full"}>
                                <button className={Style.editButton} onClick={(e)=>{
                                    e.stopPropagation();

                                }}><i className={"fa-solid fa-cloud-arrow-up"}/></button>

                            </div>
                        </div> :
                        <div className={Style.empty}>
                            <div className={"flex items-center gap-[5rem]"}>
                                <h1>No project loaded</h1>
                                <i className={"fa-solid fa-box-open"}/>
                            </div>
                            <button onClick={()=>{
                                setNewProjectForm(true);
                                setNewProjectName("");
                            }}>Create a new project <i className={"fa-solid fa-plus"}/> </button>
                        </div>
                }
                <h1 className={Style.title}>Cloud Saved:</h1>
                <div className={Style.list}>
                    <div className={Style.empty}>
                        <div className={"flex items-center gap-[5rem]"}>
                            <h1>No cloud saved</h1>
                            <i className={"fa-solid fa-cloud-slash"}/>
                        </div>
                    </div>
                </div>
            </div>
            {
                //@ts-ignore
                newProjectForm &&
                <div className={Style.overlay}>
                    <div className={Style.form}>
                        <h1>Name your new project:</h1>
                        <input type={"text"} placeholder={"Project Name"} defaultValue={newProjectName} onChange={(e)=>{setNewProjectName(e.target.value)}}/>
                        <button className={"mainButton"} onClick={()=>{
                            router.push(`/dashboard?project=${newProjectName}`);
                            setNewProjectForm(false);
                        }}>Create</button>
                        <button className={"mainButton"} onClick={()=>{setNewProjectForm(false)}}>Cancel</button>
                    </div>
                </div>
            }
        </div>
    )
}
