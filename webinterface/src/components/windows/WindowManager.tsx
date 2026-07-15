"use client"
import {DockviewReact,  DockviewReadyEvent, DockviewTheme} from "dockview-react";
import {useDockviewLayoutStore, useDockviewStore} from "@/lib/store";
import {components} from "@/lib/windows/windowTypes";
import {useCallback, useEffect, useRef} from "react";
import "dockview-react/dist/styles/dockview.css"
import Styles from "./WindowTheme.module.css"

const Theme:DockviewTheme = {
    name:"MYLO",
    className:Styles.MYLOTheme,
    colorScheme:"dark",
    tabAnimation:"smooth",
}

export default function WindowManager(){
    const setApi = useDockviewStore(state => state.setApi);
    const setLayout = useDockviewLayoutStore(state=> state.setLayout);
    const layoutDisposableRef = useRef<{ dispose: () => void } | null>(null);

    useEffect(() => {
        return () => {
            layoutDisposableRef.current?.dispose();
            layoutDisposableRef.current = null;
        };
    }, []);

    const onReady = useCallback((event:DockviewReadyEvent) => {
        layoutDisposableRef.current?.dispose();
        layoutDisposableRef.current = event.api.onDidLayoutChange(()=>{
            setLayout(JSON.stringify(event.api.toJSON()))
        })

        event.api.addPanel({id: 'FileExplorer', component: 'FileExplorer', title: 'File Explorer'})
        event.api.addPanel({id:'Properties', component:'Properties', title:'Properties', position: {
                referencePanel: 'FileExplorer',
                direction: 'right',
            }, initialWidth:400})


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