"use client"
import MenuBar from "@/components/structural/MenuBar";
import WindowManager from "@/components/windows/WindowManager";
import {useRouter} from "next/navigation";
import {useSearchParams} from "next/navigation";
import {Suspense, useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {
    migrateLegacySessionStorage,
    onStoresHydrated,
    storesHaveHydrated,
    useClientStore,
    useProjectStore,
    useWorkspaceStore,
} from "@/lib/store";
import { ClientType } from "@/lib/client/ClientTypes";
import { provisionCloudSession } from "@/lib/cloud/sessionClient";
import "./styles.css"

function DashboardInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const connect = useClientStore(state => state.connect);
    const hydrateFromProject = useProjectStore(state => state.hydrateFromProject);
    const clearSelected = useWorkspaceStore(state => state.clearSelected);
    const resetChrome = useWorkspaceStore(state => state.resetChrome);
    const bootstrapStartedRef = useRef(false);
    const projectName = searchParams.get("project");
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (storesHaveHydrated()) {
            setHydrated(true);
        }
        return onStoresHydrated(() => setHydrated(true));
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        if (bootstrapStartedRef.current) return;

        bootstrapStartedRef.current = true;
        let cancelled = false;

        void (async () => {
            migrateLegacySessionStorage();

            const config = useClientStore.getState().config;
            if (!config) {
                toast.error("No client config found", {duration: 5000});
                return;
            }

            let result = await connect();

            if (cancelled) return;

            // Cloud agent may have died (Docker/orchestrator restart) — spin a fresh one once.
            if (!result.ok && config.type === ClientType.CLOUD && config.dbId) {
                const toastId = toast.loading("Cloud agent unreachable — restarting session…");
                const restarted = await provisionCloudSession({
                    configId: config.dbId,
                    name: config.name,
                });
                if (cancelled) return;
                if (restarted.ok) {
                    useClientStore.getState().setConfig(restarted.config);
                    toast.success("Cloud session restarted", { id: toastId, duration: 4000 });
                    result = await connect(restarted.config);
                    if (cancelled) return;
                } else {
                    toast.error("Failed to restart cloud session", {
                        id: toastId,
                        duration: 5000,
                        description: restarted.error,
                    });
                    return;
                }
            }

            if (result.status === "timed_out") {
                toast.error("Connection timed out", { description:"Client probably offline"});
                return;
            }

            if (result.ok) {
                toast.success("Connected", {duration: 5000});
            } else {
                toast.error("Failed to connect", {
                    duration: 5000,
                    description: result.error || "Unknown error",
                });
                return;
            }

            if (projectName) {
                const client = useClientStore.getState().client;
                if (!client) return;

                const created = await client.NewProject(projectName);
                if (cancelled) return;

                if (created?.message === "Success") {
                    // /newProject returns a flat payload; store expects /getProject shape.
                    const full = await client.getProject();
                    if (cancelled) return;
                    if (full && !(full instanceof Error) && full.projectData) {
                        toast.success("Project created", {duration: 5000});
                        hydrateFromProject(full);
                        clearSelected();
                        router.replace("/dashboard");
                    } else {
                        toast.error("Project created but failed to load", {
                            duration: 5000,
                            description: full instanceof Error ? full.message : "Invalid project payload",
                        });
                    }
                } else {
                    toast.error("Failed to create project", {
                        duration: 5000,
                        description: created?.message || created?.error || "Unknown error",
                    });
                }
            }
        })();

        return () => {
            cancelled = true;
            bootstrapStartedRef.current = false;
        };
    }, [clearSelected, connect, hydrateFromProject, hydrated, projectName, router]);

    useEffect(() => {
        return () => {
            resetChrome();
        };
    }, [resetChrome]);

    return(
        <main className={"dashCont"}>
            <MenuBar />
            <div className={"w-[100vw] h-[100%]"}>
                {hydrated ? <WindowManager/> : null}
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
