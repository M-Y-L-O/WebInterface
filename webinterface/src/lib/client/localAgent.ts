"use client";

import { ClientType, type ClientConfig } from "@/lib/client/ClientTypes";

/** Default loopback agent — product assumes local install. */
export const DEFAULT_LOCAL_ADDRESS = "http://127.0.0.1:8080";
export const DEFAULT_LOCAL_NAME = "Local MYLO Client";

export const MYLO_LAUNCH_SCHEME = "mylo://launch";
export const CLIENT_INSTALL_HREF = "/docs#local-agents";

export function isDefaultLocalConfig(config: ClientConfig | undefined | null): boolean {
    if (!config || config.type !== ClientType.LOCAL) return false;
    try {
        const url = new URL(config.address);
        const host = url.hostname.toLowerCase();
        const port = url.port || (url.protocol === "https:" ? "443" : "80");
        return (host === "127.0.0.1" || host === "localhost") && port === "8080";
    } catch {
        return false;
    }
}

export function findDefaultLocalIndex(configs: ClientConfig[]): number {
    return configs.findIndex(isDefaultLocalConfig);
}

export function buildDefaultLocalConfig(apiKey = ""): ClientConfig {
    return {
        name: DEFAULT_LOCAL_NAME,
        type: ClientType.LOCAL,
        address: DEFAULT_LOCAL_ADDRESS,
        apiKey,
    };
}

/**
 * Invoke the registered protocol handler (Roblox-style).
 * Returns false if the scheme is unlikely to be handled (we still navigate;
 * callers should poll health and fall back to docs/install).
 */
export function invokeLocalAgentLaunch(): void {
    if (typeof window === "undefined") return;
    // Hidden iframe avoids navigating the Studio tab away if the OS handles the scheme.
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = MYLO_LAUNCH_SCHEME;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
        iframe.remove();
    }, 2000);
}

export type AgentChipStatus = "Online" | "Connecting" | "Offline" | "Install";

export function chipFromStoreStatus(
    status: "offline" | "connecting" | "connected",
    hasAttemptedConnect: boolean,
): AgentChipStatus {
    if (status === "connected") return "Online";
    if (status === "connecting") return "Connecting";
    if (!hasAttemptedConnect) return "Offline";
    return "Install";
}
