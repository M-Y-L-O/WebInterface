"use client"

import {EndPoints, ClientConfig, ClientType, CLOUD_CONFIG_HEADER} from "./ClientTypes"
import crypto from 'crypto'

export async function hash(thing: string) {
    return crypto.createHash('sha256').update(thing).digest('hex');
}

function buildUrl(config: ClientConfig, target: EndPoints | string) {
    return config.address + target;
}

async function authHeaders(config: ClientConfig, extra?: HeadersInit): Promise<HeadersInit> {
    const headers: Record<string, string> = {};
    if (extra) {
        const h = new Headers(extra);
        h.forEach((value, key) => {
            headers[key] = value;
        });
    }

    if (config.type === ClientType.CLOUD) {
        if (config.dbId) {
            headers[CLOUD_CONFIG_HEADER] = config.dbId;
        }
        // Proxy injects the real Bearer token from DB.
        return headers;
    }

    headers["Authorization"] = "Bearer " + await hash(config.apiKey!);
    return headers;
}

export async function Request(target: EndPoints, config:ClientConfig, data?:any ):Promise<any>{
    const request = {
        method: "POST",
        headers: await authHeaders(config, { "Content-Type": "application/json" }),
        body: JSON.stringify(data)
    }
    try{
        const res = await fetch(buildUrl(config, target), request);
        // Parse body even on error status — model edit (and similar) APIs return
        const body = await res.json().catch(() => null);
        if (!res.ok) {
            if (body !== null) return body;
            return new Error(`Request failed: ${res.status}`);
        }
        return body;
    } catch (e) {
        console.log(e);
        return new Error("Request failed:", {cause: e})
    }
}

export async function timedRequest(target: EndPoints, config:ClientConfig, timeout:number, data?:any):Promise<any>{
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const request = {
        method: "POST",
        headers: await authHeaders(config, { "Content-Type": "application/json" }),
        body: JSON.stringify(data ?? {}),
        signal: controller.signal
    }
    try{
        const res = await fetch(buildUrl(config, target), request);
        const data = await res.json();
        return data;
    } catch (e) {
        // @ts-ignore
        if(e.name === "AbortError")
            return {Status: "Timed out"};
        return new Error("Request failed:", {cause: e})
    } finally {
        clearTimeout(id);
    }
}

export async function FileRequest(target: EndPoints, config:ClientConfig, file:File,  extraData?:any):Promise<any>{
    const formData = new FormData();
    formData.append('file', file);

    if(extraData){
        for(const key in extraData)
            formData.append(key, extraData[key]);
    }

    const request = {
        method: "POST",
        headers: await authHeaders(config),
        body: formData
    }
    try{
        const res = await fetch(buildUrl(config, target), request);
        if(!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Request failed: ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`);
        }
        return res.json();
    } catch (e) {
        console.log(e);
        return e instanceof Error ? e : new Error("Request failed:", {cause: e});
    }
}

export async function RequestForFile(target: EndPoints, config: ClientConfig, data?:any){
    const request = {
        method: "POST",
        headers: await authHeaders(config, { "Content-Type": "application/json" }),
        body: JSON.stringify(data)
    }
    try{
        const res = await fetch(buildUrl(config, target), request);
        if(!res.ok)
            throw new Error(`Request failed: ${res.status}`);
        return await res.blob();
    } catch (e) {
        console.log(e);
        return new Error("Request failed:", {cause: e})
    }
}
export async function GetRequest(target: EndPoints, config:ClientConfig, data?:any ):Promise<any>{
    const request = {
        method: "GET",
        headers: await authHeaders(config, { "Content-Type": "application/json" }),
    }
    try{
        const res = await fetch(buildUrl(config, target), request);
        return res;
    }
    catch(e){
        return new Error("Request failed:", {cause: e})
    }
}

export function sseUrl(config: ClientConfig, target: EndPoints): string {
    const base = buildUrl(config, target);
    if (config.type === ClientType.CLOUD && config.dbId) {
        const join = base.includes("?") ? "&" : "?";
        return `${base}${join}configId=${encodeURIComponent(config.dbId)}`;
    }
    return base;
}
