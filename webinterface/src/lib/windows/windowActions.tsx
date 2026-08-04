import {DockviewApi} from "dockview-core";


function openPanel(api:DockviewApi, component:string, id:string, title:string, params?:Record<string, unknown>){
    if(!api)
        return;

    const existing = api.getPanel(id);
    if(existing){
        existing.api.setActive();
        return;
    }

    api.addPanel({id, component, title, params} as any);
}

export function addWindow(api:DockviewApi|null, window:string, title?:string){
    if(!api)
        return;
    openPanel(api, window, window, title || window)
}