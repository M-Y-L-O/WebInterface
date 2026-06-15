"use client"
import {DockviewReact,  DockviewReadyEvent, DockviewTheme} from "dockview-react";
import {useDockviewStore} from "@/lib/store";
import {components} from "@/lib/windows/windowTypes";
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
    function onReady(event:DockviewReadyEvent){
        event.api.addPanel({id: 'Visualiser', component: 'Visualiser', title: 'Visualiser'})
        event.api.addPanel({id:'Properties', component:'Properties', title:'Properties', position: {
                referencePanel: 'Visualiser',
                direction: 'right',
            }, initialWidth:400})
        console.log("ready")
        setApi(event.api);
    }

    return (
        <DockviewReact
        components={components}
        onReady={onReady}
        theme={Theme}
      />)
}