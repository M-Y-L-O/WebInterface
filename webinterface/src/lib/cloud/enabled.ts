/**
 * Cloud agents (orchestrator) and cloud project upload.
 * Catalog storage is independent and stays available when this is off.
 *
 * Set CLOUD_ENABLED=0 to disable. Unset / empty defaults to enabled.
 */
export function isCloudEnabled(): boolean {
    const raw = process.env.CLOUD_ENABLED;
    if (raw === undefined || raw.trim() === "") return true;
    const v = raw.trim().toLowerCase();
    return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

export const CLOUD_DISABLED_ERROR = "Cloud features are disabled";
