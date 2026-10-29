"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Client } from "@/lib/client/Client";
import { ClientType, type ClientConfig } from "@/lib/client/ClientTypes";
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

                if (result.status === "error") {
                    set({ status: "offline" });
                    return result;
                }

                try {
                    // Agent may already be initialized with a different key (e.g. after
                    // apiKey was stripped from sessionStorage). Reset + re-init if needed.
                    if (result.status === "connected") {
                        const authed = await client.VerifyAuth();
                        if (!authed) {
                            await client.Disconnect();
                            const init = await client.Initialize();
                            if (init?.error) {
                                set({ status: "offline" });
                                return {
                                    ok: false,
                                    status: "error",
                                    error: String(init.error),
                                    raw: init,
                                };
                            }
                        }
                        set({ status: "connected" });
                        return { ok: true, status: "connected", raw: result.raw };
                    }

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
            // LOCAL needs the plaintext key in-session: the agent bearer is sha256(apiKey).
            // CLOUD never keeps a browser-side key (proxy injects it).
            partialize: (state) => ({
                config: state.config
                    ? {
                          name: state.config.name,
                          type: state.config.type,
                          address: state.config.address,
                          apiKey:
                              state.config.type === ClientType.LOCAL
                                  ? state.config.apiKey || ""
                                  : "",
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
