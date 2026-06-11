"use client"
import {DockviewReact,  DockviewReadyEvent} from "dockview-react";
import {useDockviewStore} from "@/lib/store";
import {components} from "@/lib/windows/windowTypes";
import "dockview-react/dist/styles/dockview.css"



export default function WindowManager(){
    const setApi = useDockviewStore(state => state.setApi);
    function onReady(event:DockviewReadyEvent){
        event.api.addPanel({id: 'Visualiser', component: 'Visualiser', title: 'Visualiser'})
        console.log("ready")
        setApi(event.api);
    }

    return (
        <DockviewReact
        components={components}
        onReady={onReady}
        className={"dockview-theme-abyss"}
      />)
}