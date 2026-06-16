"use client"

import {EndPoints, ClientConfig} from "./ClientTypes"
import crypto from 'crypto'

export async function hash(thing: string) {
    return crypto.createHash('sha256').update(thing).digest('hex');
}

export async function Request(target: EndPoints, config:ClientConfig, data?:any ):Promise<any>{
    const request = {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer " + await hash(config.apiKey!)
        },
        body: JSON.stringify(data)
    }
    try{
        const res = await fetch(config.address+target, request);
        console.log(res);
        if(!res.ok)
            throw new Error(`Request failed: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.log(e);
        return new Error("Request failed:", {cause: e})
    }
}
