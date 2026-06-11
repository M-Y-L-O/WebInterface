"use server"

import {EndPoints, ClientConfig} from "./ClientTypes"
import crypto from 'crypto'

export async function hash(thing: string) {
    return crypto.createHash('sha256').update(thing).digest('hex');
}

export async function RequestServer(target: EndPoints, config:ClientConfig, data?:any ):Promise<any>{
    const request = {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': await hash(process.env.TWONTWOD_API_KEY!)
        },
        body: JSON.stringify(data)
    }
    try{
        return await fetch(config.address+target, request);
    } catch (e) {
        return new Error("Request failed:", {cause: e})
    }
}
