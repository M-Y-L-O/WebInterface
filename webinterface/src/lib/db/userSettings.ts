import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { userSettings } from "@/db/schemas/userData";
import {
    DEFAULT_USER_PREFS,
    type ThemePreference,
    type UserPrefs,
} from "@/lib/settings/types";

type SettingsRow = typeof userSettings.$inferSelect;

function normalizeTheme(value: string | null | undefined): ThemePreference {
    if (value === "light" || value === "system" || value === "dark") return value;
    return DEFAULT_USER_PREFS.theme;
}

function rowToPrefs(row: SettingsRow): UserPrefs {
    return {
        theme: normalizeTheme(row.theme),
        language: row.language || DEFAULT_USER_PREFS.language,
        defaultModel: row.defaultModel || DEFAULT_USER_PREFS.defaultModel,
        optEpochs: row.optEpochs ?? DEFAULT_USER_PREFS.optEpochs,
        optGenerations: row.optGenerations ?? DEFAULT_USER_PREFS.optGenerations,
        localAgentAddress: row.localAgentAddress || DEFAULT_USER_PREFS.localAgentAddress,
        localAgentName: row.localAgentName || DEFAULT_USER_PREFS.localAgentName,
    };
}

export async function getOrCreateUserSettings(userId: string): Promise<UserPrefs> {
    const existing = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

    if (existing[0]) {
        return rowToPrefs(existing[0]);
    }

    const inserted = await db
        .insert(userSettings)
        .values({ userId })
        .returning();

    return rowToPrefs(inserted[0]);
}

export async function updateUserSettings(
    userId: string,
    patch: Partial<UserPrefs>,
): Promise<UserPrefs> {
    await getOrCreateUserSettings(userId);

    const update: Partial<typeof userSettings.$inferInsert> = {
        lastUsed: new Date(),
    };

    if (patch.theme !== undefined) update.theme = normalizeTheme(patch.theme);
    if (patch.language !== undefined) update.language = patch.language.trim() || "en";
    if (patch.defaultModel !== undefined) {
        update.defaultModel = patch.defaultModel.trim() || DEFAULT_USER_PREFS.defaultModel;
    }
    if (patch.optEpochs !== undefined) {
        update.optEpochs = Math.max(1, Math.min(10_000, Math.floor(patch.optEpochs)));
    }
    if (patch.optGenerations !== undefined) {
        update.optGenerations = Math.max(1, Math.min(10_000, Math.floor(patch.optGenerations)));
    }
    if (patch.localAgentAddress !== undefined) {
        update.localAgentAddress =
            patch.localAgentAddress.trim() || DEFAULT_USER_PREFS.localAgentAddress;
    }
    if (patch.localAgentName !== undefined) {
        update.localAgentName =
            patch.localAgentName.trim() || DEFAULT_USER_PREFS.localAgentName;
    }

    const rows = await db
        .update(userSettings)
        .set(update)
        .where(eq(userSettings.userId, userId))
        .returning();

    return rowToPrefs(rows[0]);
}
