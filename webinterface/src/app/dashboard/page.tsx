"use client"
import MenuBar from "@/components/structural/MenuBar";
import WindowManager from "@/components/windows/WindowManager";
import {useRouter} from "next/navigation";
import {useSearchParams} from "next/navigation";
import {useEffect} from "react";
import {toast} from "sonner";
import {useClientStore} from "@/lib/store";
import "./styles.css"

export default function Dashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();
    let setClient = useClientStore(state => state.setConfig)

    async function loadClient(){
        const configS = sessionStorage.getItem("activeConfig");
        if(!configS || configS === "undefined" || configS === null)
        {
            toast.error("No client config found", {duration: 5000});
            return;
        }
        const config = JSON.parse(configS);
        setClient(config);
        let client = useClientStore.getState().client;

        if(!client || typeof client === "undefined"){
            toast.error("There has been a problem constructing the client", {duration: 5000});
            return;
        }

        const res = await client.TestConnection();

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
            } catch (e) {
                toast.error("Failed to connect", {duration: 5000, description: res.status});
                return;
            }

        await loadproject(client);
    }

    async function loadproject(client:any){
        if(searchParams.get("project")){
            const res = await client.NewProject(searchParams.get("project")!);
            if(res.message === "Success"){
                toast.success("Project created", {duration: 5000});
                sessionStorage.setItem("loadedProject", JSON.stringify(res.data));
                router.push("/dashboard");
            }

            else
                toast.error("Failed to create project", {duration: 5000, description: res.message});
        }
    }

    useEffect(() => {
        loadClient();
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