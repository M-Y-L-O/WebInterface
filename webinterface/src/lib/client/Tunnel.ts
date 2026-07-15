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
    console.log(JSON.stringify(data))
    try{
        const res = await fetch(config.address+target, request);
        if(!res.ok)
            throw new Error(`Request failed: ${res.status}`);
        return await res.json();
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
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer " + await hash(config.apiKey!)
        },
        body: JSON.stringify(data),
        signal: controller.signal
    }
    try{
        const res = await fetch(config.address+target, request);
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
        headers: {
            'Authorization': "Bearer " + await hash(config.apiKey!)
        },
        body: formData
    }
    try{
        const res = await fetch(config.address+target, request);
        if(!res.ok)
            throw new Error(`Request failed: ${res.status}`);
        return res.json();
    } catch (e) {
        console.log(e);
        return new Error("Request failed:", {cause: e})
    }
}

export async function RequestForFile(target: EndPoints, config: ClientConfig, data?:any){
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
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer " + await hash(config.apiKey!)
        },
        body: JSON.stringify(data)
    }
    try{
        const res = await fetch(config.address+target, request);
        return res;
    }
    catch(e){
        return new Error("Request failed:", {cause: e})
    }
}