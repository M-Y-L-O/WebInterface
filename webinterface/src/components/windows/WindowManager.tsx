"use client"
import {DockviewReact,  DockviewReadyEvent, DockviewTheme} from "dockview-react";
import {getProjectId, useWorkspaceStore} from "@/lib/store";
import {components} from "@/lib/windows/windowTypes";
import {consumePendingPanel} from "@/lib/windows/pendingPanel";
import {useCallback, useEffect, useRef} from "react";
import "dockview-react/dist/styles/dockview.css"
import Styles from "./WindowTheme.module.css"
import type { DockLayoutJson } from "@/lib/store/types";

const Theme:DockviewTheme = {
    name:"MYLO",
    className:Styles.MYLOTheme,
    colorScheme:"dark",
    tabAnimation:"smooth",
}

function applyDefaultLayout(api: DockviewReadyEvent["api"]) {
    api.addPanel({id: 'FileExplorer', component: 'FileExplorer', title: 'Project Explorer'})
    api.addPanel({
        id: 'Properties',
        component: 'Properties',
        title: 'Properties',
        position: {
            referencePanel: 'FileExplorer',
            direction: 'right',
        },
        initialWidth: 400,
    })
}

function tryRestoreLayout(api: DockviewReadyEvent["api"], layout: DockLayoutJson | null): boolean {
    if (!layout) return false;
    try {
        api.fromJSON(layout);
        return true;
    } catch {
        return false;
    }
}

function applyPendingPanel(api: DockviewReadyEvent["api"]) {
    const pending = consumePendingPanel();
    if (!pending) return;

    const existing = api.getPanel(pending.id);
    if (existing) {
        if (pending.params) {
            existing.api.updateParameters(pending.params);
        }
        existing.api.setActive();
        return;
    }

    api.addPanel({
        id: pending.id,
        component: pending.component,
        title: pending.title,
        params: pending.params,
    } as any);
}

export default function WindowManager(){
    const setApi = useWorkspaceStore(state => state.setApi);
    const setLayout = useWorkspaceStore(state => state.setLayout);
    const layoutDisposableRef = useRef<{ dispose: () => void } | null>(null);

    useEffect(() => {
        return () => {
            layoutDisposableRef.current?.dispose();
            layoutDisposableRef.current = null;
            useWorkspaceStore.getState().clearApi();
        };
    }, []);

    const onReady = useCallback((event:DockviewReadyEvent) => {
        layoutDisposableRef.current?.dispose();

        const projectId = getProjectId();
        const saved = useWorkspaceStore.getState().getLayout(projectId);
        const restored = tryRestoreLayout(event.api, saved);
        if (!restored) {
            applyDefaultLayout(event.api);
        }

        applyPendingPanel(event.api);

        layoutDisposableRef.current = event.api.onDidLayoutChange(()=>{
            setLayout(event.api.toJSON(), projectId);
        })

        setApi(event.api);
    }, [setApi, setLayout]);

    return (
        <DockviewReact
        components={components}
        onReady={onReady}
        theme={Theme}
        hideBorders={false}
      />)
}
