import {pgTable, text, timestamp, boolean, uniqueIndex, integer, doublePrecision, jsonb, index} from "drizzle-orm/pg-core";
import {users} from "@/db/schemas/nextAuth";

export const userSettings = pgTable("usersettings", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(()=> users.id, { onDelete: "cascade" }),
    theme: text("theme").notNull().default("dark"),
    language: text("language").notNull().default("en"),
    defaultModel: text("defaultModel").notNull().default("gemini-2.5-flash"),
    aiMaxTurns: integer("aiMaxTurns").notNull().default(12),
    aiMaxToolCalls: integer("aiMaxToolCalls").notNull().default(32),
    aiTemperature: doublePrecision("aiTemperature").notNull().default(0.4),
    aiThinking: boolean("aiThinking").notNull().default(false),
    optEpochs: integer("optEpochs").notNull().default(10),
    optGenerations: integer("optGenerations").notNull().default(5),
    localAgentAddress: text("localAgentAddress").notNull().default("http://127.0.0.1:8080"),
    localAgentName: text("localAgentName").notNull().default("Local MYLO Client"),
    lastUsed: timestamp("lastUsed", {mode: "date"}).notNull().defaultNow(),
}, (t) => [
    uniqueIndex("usersettings_user_uidx").on(t.userId),
])

/** Persisted AI assistant threads, keyed by user + project. */
export const aiChats = pgTable("ai_chats", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectKey: text("projectKey").notNull(),
    title: text("title").notNull().default("Chat"),
    messages: jsonb("messages").notNull().$type<unknown[]>().default([]),
    geminiContents: jsonb("geminiContents").notNull().$type<unknown[]>().default([]),
    model: text("model"),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (t) => [
    index("ai_chats_user_project_idx").on(t.userId, t.projectKey),
])

/**
 * Bring-your-own LLM key (encrypted at rest via envelope encryption).
 * Never select ciphertext columns in list/metadata queries exposed to the client.
 */
export const userLlmKeys = pgTable("userllmkeys", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** gemini | … */
    provider: text("provider").notNull().default("gemini"),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("authTag").notNull(),
    wrappedDek: text("wrappedDek").notNull(),
    /** local | kms */
    kekProvider: text("kekProvider").notNull(),
    keyFingerprint: text("keyFingerprint").notNull(),
    /** active | invalid */
    status: text("status").notNull().default("active"),
    verifiedAt: timestamp("verifiedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (t) => [
    uniqueIndex("userllmkeys_user_provider_uidx").on(t.userId, t.provider),
])

export const clientConfigs = pgTable("clientconfigs", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(()=> users.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    apiKey: text("apiKey").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    /** Orchestrator session id for CLOUD configs (used to stop the container). */
    sessionId: text("sessionId"),
})

export const cloudProjects = pgTable("cloudprojects", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(()=> users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("createdAt", {mode: "date"}).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", {mode: "date"}).notNull().defaultNow(),
    cloudSaved: boolean("cloudSaved").notNull().default(false),
    cloudPath: text("cloudPath"),
})

/** Shared catalog: full projects (.mylo) or standalone models (.pt2 / .onnx). */
export const catalogItems = pgTable("catalogitems", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** project | pt2 | onnx */
    kind: text("kind").notNull(),
    fileName: text("fileName").notNull(),
    cloudPath: text("cloudPath").notNull(),
    createdAt: timestamp("createdAt", {mode: "date"}).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", {mode: "date"}).notNull().defaultNow(),
})
