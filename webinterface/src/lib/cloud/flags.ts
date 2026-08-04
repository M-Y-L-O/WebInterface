"use server";

import { isCloudEnabled } from "@/lib/cloud/enabled";

/** Client-safe read of CLOUD_ENABLED for UI gating. */
export async function getCloudEnabled(): Promise<boolean> {
    return isCloudEnabled();
}
