"use client"
import MenuBar from "@/components/structural/MenuBar";
import WindowManager from "@/components/windows/WindowManager";
import {useRouter} from "next/navigation";
import {useSearchParams} from "next/navigation";
import {Suspense, useEffect, useRef} from "react";
import {toast} from "sonner";
import {useClientStore, useDockviewStore, useSelectedStore, useVisualisationStore} from "@/lib/store";
import "./styles.css"

function DashboardInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const setClient = useClientStore(state => state.setConfig)
    const clearClient = useClientStore(state => state.clearClient);
    const clearApi = useDockviewStore(state => state.clearApi);
    const clearSelected = useSelectedStore(state => state.clearSelected);
    const clearVisualisation = useVisualisationStore(state => state.clearVisualisation);
    const bootstrapStartedRef = useRef(false);
    const projectName = searchParams.get("project");

    useEffect(() => {
        if(bootstrapStartedRef.current)
            return;

        bootstrapStartedRef.current = true;
        let cancelled = false;

        void (async () => {
            const configS = sessionStorage.getItem("activeConfig");
            if(!configS || configS === "undefined" || configS === null)
            {
                toast.error("No client config found", {duration: 5000});
                return;
            }

            const config = JSON.parse(configS);
            setClient(config);
            const client = useClientStore.getState().client;

            if(!client || typeof client === "undefined"){
                toast.error("There has been a problem constructing the client", {duration: 5000});
                return;
            }

            const res = await client.TestConnection();

            if(cancelled)
                return;

            if(res.Status === "Timed out")
            {
                toast.error("Connection timed out", { description:"Client probably offline"});
                return;
            }

            if(res.Status === true)
                toast.success("Connected", {duration: 5000});
            else
                try{
                    await client.Initialize();
                } catch {
                    toast.error("Failed to connect", {duration: 5000, description: res.status});
                    return;
                }

            if(projectName){
                const res = await client.NewProject(projectName);
                if(cancelled)
                    return;

                if(res.message === "Success"){
                    toast.success("Project created", {duration: 5000});
                    sessionStorage.setItem("loadedProject", JSON.stringify(res.data));
                    sessionStorage.setItem("activeProject", JSON.stringify(res.data));
                    useSelectedStore.getState().clearSelected();
                    router.replace("/dashboard");
                }

                else
                    toast.error("Failed to create project", {duration: 5000, description: res.message});
            }
        })();

        return () => {
            cancelled = true;
            bootstrapStartedRef.current = false;
        };
    }, [clearApi, clearClient, clearSelected, clearVisualisation, projectName, router, setClient]);

    useEffect(() => {
        return () => {
            clearClient();
            clearApi();
            clearSelected();
            clearVisualisation();
        };
    }, [clearApi, clearClient, clearSelected, clearVisualisation]);

    return(
        <main className={"dashCont"}>
            <MenuBar />
            <div className={"w-[100vw] h-[100%]"}>
                <WindowManager/>

            </div>
        </main>
    )
}

export default function Dashboard() {
    return (
        <Suspense fallback={<main className={"dashCont"} />}>
            <DashboardInner />
        </Suspense>
    );
}