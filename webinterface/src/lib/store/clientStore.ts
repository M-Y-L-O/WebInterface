"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Client } from "@/lib/client/Client";
import type { ClientConfig } from "@/lib/client/ClientTypes";
import type { ConnectionResult, ConnectionStatus } from "./types";

type ClientStore = {
    config: ClientConfig | null;
    client: Client | null;
    status: ConnectionStatus;

    setConfig: (config: ClientConfig) => void;
    connect: (config?: ClientConfig) => Promise<ConnectionResult>;
    clearClient: () => void;
    setStatus: (status: ConnectionStatus) => void;
};

function buildClient(config: ClientConfig): Client {
    return new Client(config);
}

export const useClientStore = create<ClientStore>()(
    persist(
        (set, get) => ({
            config: null,
            client: null,
            status: "offline",

            setConfig: (config) => {
                set({
                    config,
                    client: buildClient(config),
                    status: "offline",
                });
            },

            setStatus: (status) => set({ status }),

            clearClient: () => {
                set({
                    config: null,
                    client: null,
                    status: "offline",
                });
            },

            connect: async (config) => {
                if (config) {
                    get().setConfig(config);
                }

                const client = get().client;
                if (!client) {
                    set({ status: "offline" });
                    return {
                        ok: false,
                        status: "error",
                        error: "No client configured",
                    };
                }

                set({ status: "connecting" });

                const result = await client.TestConnection();

                if (result.status === "timed_out") {
                    set({ status: "offline" });
                    return result;
                }

                if (result.status === "connected") {
                    set({ status: "connected" });
                    return result;
                }

                if (result.status === "error") {
                    set({ status: "offline" });
                    return result;
                }

                try {
                    await client.Initialize();
                    set({ status: "connected" });
                    return { ok: true, status: "connected", raw: result.raw };
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Failed to initialize client";
                    set({ status: "offline" });
                    return { ok: false, status: "error", error: message, raw: result.raw };
                }
            },
        }),
        {
            name: "mylo-client",
            storage: createJSONStorage(() => sessionStorage),
            // Never persist apiKey — reload from server-owned getConfigs after login.
            partialize: (state) => ({
                config: state.config
                    ? {
                          name: state.config.name,
                          type: state.config.type,
                          address: state.config.address,
                          apiKey: "",
                          dbId: state.config.dbId,
                          sessionId: state.config.sessionId,
                      }
                    : null,
            }),
            onRehydrateStorage: () => (state) => {
                if (!state?.config) return;
                // Client instances are not serializable — rebuild after rehydrate.
                state.client = buildClient(state.config);
                state.status = "offline";
            },
        },
    ),
);
