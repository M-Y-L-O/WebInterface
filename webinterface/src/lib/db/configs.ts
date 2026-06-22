'use server'

import {clientConfigs} from "@/db/schemas/userData";
import {db} from "@/db/db";
import {eq} from "drizzle-orm";
import {ClientConfig, ClientType} from "@/lib/client/ClientTypes";

export type ClientConfigDB = typeof clientConfigs.$inferSelect;

function DBToType(config:ClientConfigDB){
    const type:ClientType = config.type.trim()==="LOCAL" ? ClientType.LOCAL:ClientType.CLOUD;
    console.log(type);

    const newConfig:ClientConfig = {
        name:config.name,
        // @ts-ignore
        type:  config.type,
        address:config.address,
        apiKey:config.apiKey,
        dbId: config.id
    }

    return newConfig;
}

export async function createConfig(userId:string, config?:ClientConfig){
    let data = config;
    if(!data){
        data = {
            name:"New config",
            type:ClientType.LOCAL,
            address:"127.0.0.1:8080",
            apiKey:"",
        }
    }

    const newClient = await db.insert(clientConfigs).values({
        userId:userId,
        name: data.name,
        type: data.type,
        address: data.address!,
        apiKey: data.apiKey!,
    }).returning();

    return DBToType(newClient[0]);
}

export async function getConfigs(userId:string){
    let configs = await db.select().from(clientConfigs).where(eq(clientConfigs.userId, userId));
    const converted:ClientConfig[] = [];
    for(let config of configs){
        converted.push(DBToType(config));
    }
    return converted;
}

export async function deleteConfig(dbId:string){
    await db.delete(clientConfigs).where(eq(clientConfigs.id, dbId));
}

export async function updateConfig(dbId:string, config:ClientConfig){
    await db.update(clientConfigs).set({
        name:config.name,
        type:config.type,
        address:config.address,
        apiKey:config.apiKey,
    }).where(eq(clientConfigs.id, dbId));
}