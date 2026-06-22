import {pgTable, text, timestamp, boolean} from "drizzle-orm/pg-core";
import {users} from "@/db/schemas/nextAuth";

export const userSettings = pgTable("usersettings", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(()=> users.id, { onDelete: "cascade" }),
    theme: text("theme").notNull().default("dark"),
    language: text("language").notNull().default("en"),
    lastUsed: timestamp("lastUsed", {mode: "date"}).notNull().defaultNow(),
})

export const clientConfigs = pgTable("clientconfigs", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(()=> users.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    apiKey: text("apiKey").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
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