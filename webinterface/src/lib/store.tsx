import { create } from "zustand";
import type { DockviewApi } from "dockview-core";
import {ClientConfig} from "@/lib/client/ClientTypes";
import {Client} from "@/lib/client/Client";

type DockviewState = {
    api: DockviewApi | null;
    setApi: (api: DockviewApi) => void;
};

export const useDockviewStore = create<DockviewState>((set) => ({
    api: null,

    setApi: (api) => set({ api }),
}));

interface ClientStore{
    config:ClientConfig|null;
    client:Client|null;

    setConfig:(config:ClientConfig)=>void;
    clearClient:()=>void;
}

export const useClientStore = create<ClientStore>((set)=>({
    config:null,
    client:null,

    setConfig:(config)=>set({
        config,
        client: new Client(config),
    }),

    clearClient: ()=>set({
        config:null,
        client:null,
    })
}))

interface VisualisationResultStore{
    visualisation:string|null;
    setVisualisation:(visualisation:string)=>void;
}

export const useVisualisationStore = create<VisualisationResultStore>((set)=>({
    visualisation:null,
    setVisualisation:(visualisation)=>set({visualisation})
}))