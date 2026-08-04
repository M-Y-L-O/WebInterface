import {useClientStore, useProjectStore} from "@/lib/store";
import {OpenProject, OpenCloudProject, SaveProjectToCloud} from "@/lib/windows/Actions";
import {useCallback, useEffect, useState, type MouseEvent} from "react";
import {useRouter} from "next/navigation";
import {getSession} from "next-auth/react";
import {ClientConfig} from "@/lib/client/ClientTypes";
import {
    listMyCloudProjects,
    deleteMyCloudProject,
    type CloudProjectSummary,
} from "@/lib/storage/cloudProjects";
import Style from "./page.module.css"


export default function ProjectsPage({activeConfig, clientStatus, onStatusClick, cloudEnabled = true}:{activeConfig:ClientConfig, clientStatus:string, onStatusClick:()=>void, cloudEnabled?: boolean}) {
    const [newProjectForm, setNewProjectForm] = useState<boolean>(false);
    const [newProjectName, setNewProjectName] = useState<string>("");
    const [userName, setUserName] = useState<string>("");

    const [activeProject, setActiveProject] = useState<any | null>(null);
    const [cloudProjects, setCloudProjects] = useState<CloudProjectSummary[]>([]);
    const [overwritePrompt, setOverwritePrompt] = useState<{name: string} | null>(null);
    const [cloudBusy, setCloudBusy] = useState(false);

    const hydrateFromProject = useProjectStore(state => state.hydrateFromProject);
    const router = useRouter();

    const refreshCloudProjects = useCallback(async () => {
        if (!cloudEnabled) {
            setCloudProjects([]);
            return;
        }
        try {
            const rows = await listMyCloudProjects();
            setCloudProjects(rows);
        } catch {
            setCloudProjects([]);
        }
    }, [cloudEnabled]);

    async function loadActiveProject(client:any){
        const project = await client.getProject();
        console.log("Project", project);
        if(project && project.projectData){
            setActiveProject(project);
        } else {
            setActiveProject(null);
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

    async function openCloudProject(projectId: string){
        if (clientStatus !== "Connected") {
            return;
        }
        const client = useClientStore.getState().client;
        if (!client) return;

        setCloudBusy(true);
        try {
            const res = await OpenCloudProject(client, projectId);
            if (res === 200) {
                router.push("/dashboard");
            }
        } finally {
            setCloudBusy(false);
        }
    }

    async function saveActiveToCloud(overwrite = false){
        const client = useClientStore.getState().client;
        const name = activeProject?.projectData?.name;
        if (!client || !name) return;

        // Keep store in sync so SaveProjectToCloud can read the name
        if (!useProjectStore.getState().project) {
            hydrateFromProject(activeProject);
        }

        setCloudBusy(true);
        try {
            const result = await SaveProjectToCloud(client, {name, overwrite});
            if (result === "needs_overwrite") {
                setOverwritePrompt({name});
                return;
            }
            if (result === "saved") {
                setOverwritePrompt(null);
                await refreshCloudProjects();
            }
        } finally {
            setCloudBusy(false);
        }
    }

    async function removeCloudProject(projectId: string, e: MouseEvent){
        e.stopPropagation();
        if (!window.confirm("Delete this cloud project? This cannot be undone.")) return;

        setCloudBusy(true);
        try {
            const res = await deleteMyCloudProject(projectId);
            if (res.ok) await refreshCloudProjects();
        } finally {
            setCloudBusy(false);
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
        await refreshCloudProjects();
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
                <div className={`${Style.list} ml-[1rem]`}>
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
                    activeProject && activeProject.projectData.name ?
                        <div className={`${Style.mainInfo} ml-[1rem]`} onClick={()=>{loadProject(-1)}}>
                            <div className={"flex flex-col items-start mb-[1rem]"}>
                                <h1>{activeProject.projectData.name}</h1>
                                <h2>Model file: {activeProject.projectData.modelFile ? activeProject.projectData.modelFile : "No model"}</h2>
                                <h2>CSV file : {activeProject.projectData.csvFile ? activeProject.projectData.csvFile:"No dataset"}</h2>
                            </div>
                            <div className={"flex justify-start items-center gap-2 flex-col h-full"}>
                                {cloudEnabled && (
                                    <button
                                        className={Style.editButton}
                                        disabled={cloudBusy || clientStatus !== "Connected"}
                                        title="Save to cloud"
                                        onClick={(e)=>{
                                            e.stopPropagation();
                                            saveActiveToCloud(false);
                                        }}
                                    >
                                        <i className={"fa-solid fa-cloud-arrow-up"}/>
                                    </button>
                                )}

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
                {cloudEnabled && (
                    <>
                <h1 className={Style.title}>Cloud Saved:</h1>
                <div className={`${Style.list} ml-[1rem]`}>
                    {cloudProjects.length === 0 ? (
                        <div className={Style.empty}>
                            <div className={"flex items-center gap-[5rem]"}>
                                <h1>No cloud saved</h1>
                                <i className={"fa-solid fa-cloud-slash"}/>
                            </div>
                        </div>
                    ) : (
                        cloudProjects.map((project) => (
                            <div
                                key={project.id}
                                className={`${Style.mainInfo}`}
                                onClick={() => openCloudProject(project.id)}
                                style={{opacity: cloudBusy || clientStatus !== "Connected" ? 0.6 : 1}}
                                title={clientStatus !== "Connected" ? "Connect a client first" : "Open from cloud"}
                            >
                                <div className={"flex flex-col items-start mb-[1rem]"}>
                                    <h1>{project.name}</h1>
                                    <h2>Updated: {new Date(project.updatedAt).toLocaleString()}</h2>
                                    {project.description ? <h2>{project.description}</h2> : null}
                                </div>
                                <div className={"flex justify-start items-center gap-2 flex-col h-full"}>
                                    <button
                                        className={Style.editButton}
                                        disabled={cloudBusy}
                                        title="Delete from cloud"
                                        onClick={(e) => removeCloudProject(project.id, e)}
                                    >
                                        <i className={"fa-solid fa-trash"}/>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                    </>
                )}
            </div>
            {
                newProjectForm &&
                <div className={Style.overlay}>
                    <div className={Style.form}>
                        <h1>Name your new project:</h1>
                        <div className={"flex w-full gap-[1rem] items-center"}>
                            <input className={"w-full"} type={"text"} placeholder={"Project Name"} defaultValue={newProjectName} onChange={(e)=>{setNewProjectName(e.target.value)}} onSubmit={(e)=>{e.preventDefault()
                                router.push(`/dashboard?project=${newProjectName}`);
                                setNewProjectForm(false);
                            }}/>
                            <button className={Style.mainButton} onClick={()=>{
                                router.push(`/dashboard?project=${newProjectName}`);
                                setNewProjectForm(false);
                            }} disabled={newProjectName.length==0}><i className={"fa-solid fa-arrow-right"}/> </button>
                        </div>
                        <button className={Style.closeButton} onClick={()=>{setNewProjectForm(false)}}>Cancel</button>
                    </div>
                </div>
            }
            {
                overwritePrompt &&
                <div className={Style.overlay}>
                    <div className={Style.form}>
                        <h1>Overwrite cloud project?</h1>
                        <p className={"text-[var(--text-light)] mb-4"}>
                            A cloud project named <strong>{overwritePrompt.name}</strong> already exists.
                            Saving will replace it.
                        </p>
                        <div className={"flex w-full gap-[1rem] items-center justify-end"}>
                            <button className={Style.closeButton} onClick={() => setOverwritePrompt(null)}>Cancel</button>
                            <button
                                className={Style.mainButton}
                                disabled={cloudBusy}
                                onClick={() => saveActiveToCloud(true)}
                            >
                                Overwrite
                            </button>
                        </div>
                    </div>
                </div>
            }
        </div>
    )
}
