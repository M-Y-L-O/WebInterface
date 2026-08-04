import "server-only";

/**
 * Ensure cloud-proxy targets can only hit loopback agent addresses issued by the orchestrator.
 */
export function assertSafeProxyTarget(address: string, agentPath: string): URL {
    let base: URL;
    try {
        base = new URL(address);
    } catch {
        throw new Error("Invalid cloud agent address");
    }

    if (base.protocol !== "http:" && base.protocol !== "https:") {
        throw new Error("Cloud agent address must be http or https");
    }

    const host = base.hostname.toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost") {
        throw new Error("Cloud agent address host is not allowed");
    }

    // Block link-local / metadata style paths even if somehow present in path
    const normalizedPath = agentPath.startsWith("/") ? agentPath : `/${agentPath}`;
    if (normalizedPath.includes("://") || normalizedPath.includes("\\")) {
        throw new Error("Invalid proxy path");
    }

    const target = new URL(normalizedPath, base);
    if (target.origin !== base.origin) {
        throw new Error("Proxy path escapes agent origin");
    }

    return target;
}
