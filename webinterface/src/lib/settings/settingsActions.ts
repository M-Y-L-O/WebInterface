"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getOrCreateUserSettings, updateUserSettings } from "@/lib/db/userSettings";
import type { UserPrefs } from "@/lib/settings/types";
import { DEFAULT_USER_PREFS } from "@/lib/settings/types";

async function requireUserId(): Promise<string> {
    const session = await getServerSession(authOptions);
    // @ts-ignore — session.user.id from JWT callback
    const userId = session?.user?.id as string | undefined;
    if (!userId) throw new Error("Unauthorized");
    return userId;
}

export async function getUserPrefs(): Promise<UserPrefs | null> {
    const session = await getServerSession(authOptions);
    // @ts-ignore — session.user.id from JWT callback
    const userId = session?.user?.id as string | undefined;
    if (!userId) return null;
    return getOrCreateUserSettings(userId);
}

export async function saveUserPrefs(patch: Partial<UserPrefs>) {
    try {
        const userId = await requireUserId();
        const prefs = await updateUserSettings(userId, patch);
        return { ok: true as const, prefs };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save settings";
        return { ok: false as const, error: message, prefs: DEFAULT_USER_PREFS };
    }
}

export async function getAccountProfile() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return null;
    }
    return {
        // @ts-ignore
        id: session.user.id as string | undefined,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
    };
}
