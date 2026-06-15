"use client";

import {useSelectedStore} from "@/lib/store";
import {GraphNode, getNodeCategory, colorNode, getNodeColor} from "@/lib/windows/visualiserHelpers";
import {ReactNode, useState, useEffect} from "react";
import Styles from "./Properties.module.css"

function parseNodeTitle(title:string){
    const lines = title.trim().split("\n");
    const parsed: Record<string, string|string[] | Record<string, string|number> | number> = {};
    let currentAttr : Record<string, string|number> | null = null;

    for(const line of lines){
        if(line.startsWith('attribute {')){
            currentAttr = {}
            if(!parsed.attributes) parsed.attributes = [];
        } else if (line === '}'){
            if(currentAttr){
                (parsed.attributes as any[]).push(currentAttr);
                currentAttr = null;
            }
        } else {
            const [rawKey, rawVal] = line.split(': ');
            const value = rawVal.replace(/^"|"$/g, '');
            const key = rawKey.replace(/\s+/g, '');

            if(currentAttr){
                if(!isNaN(Number(value))){
                    currentAttr[key] = Number(value);
                } else {
                    currentAttr[key] = value;
                }
            } else {
                if(parsed[key]){
                    if(Array.isArray(parsed[key])){
                        parsed[key].push(value);
                    } else {

                        // @ts-ignore
                        parsed[key] = [parsed[key], value];
                    }
                } else {
                    parsed[key] = value;
                }
            }
        }
    }

    return parsed;
}

function NodeInfo(node:GraphNode): ReactNode{

    const info = parseNodeTitle(node.title!.toString());
    const color = getNodeColor(node);

    // @ts-ignore
    return (
        <div className={Styles.container}>
            <div style={{backgroundColor:color}} className={Styles.nodeTitle}>
                {node.label.toString()}
            </div>

            <div className={Styles.section}>
                <h2>
                    <b>Category</b>: {getNodeCategory(node.label)}
                </h2>
            </div>

            {
                info.input && (
                    <div className={Styles.section}>
                        <h2>Inputs: </h2>
                        <ul>
                            {
                                typeof info.input === 'string' || typeof info.input === 'number' ? (
                                    <li>{info.input}</li>
                                ) : (
                                    // @ts-ignore
                                    info.input?.map((input:string, i:number)=>(
                                        <li key={i}>{input}</li>
                                    ))
                                )
                            }
                        </ul>
                    </div>
                )
            }
            {
                info.output && (
                    <div className={Styles.section}>
                        <h2>Outputs: </h2>
                        <ul>
                            {
                                typeof info.output === 'string' || typeof info.output === 'number' ? (
                                    <li>{info.output}</li>
                                ) : (
                                    // @ts-ignore
                                    info.output?.map((output:string, i:number)=>(
                                        <li key={i}>{output}</li>
                                    ))
                                )
                            }
                        </ul>
                    </div>
                )
            }
            {
                info.attributes && (
                    <div className={Styles.section}>
                        <h2>Attributes: </h2>
                        <ul>
                            {
                                typeof info.attributes === 'string' || typeof info.attributes === 'number' ? (
                                    <li>{info.attributes}</li>
                                ) : (
                                    // @ts-ignore
                                    info.attributes?.map((attribute:any, i:number)=>(
                                        // @ts-ignore
                                        <li key={i}><b>{attribute.name}</b>: {Object.values(attribute)[1]}</li>
                                    ))
                                )
                            }
                        </ul>
                    </div>
                )
            }

        </div>
    )
}

export default function Properties() {
    const selected = useSelectedStore(state => state.selected);
    const [info, setInfo] = useState<ReactNode>(null);



    useEffect(() => {
        console.log(selected);
        if(!selected)
            return;
        if('title' in selected)
            setInfo(NodeInfo(selected as GraphNode));
    }, [selected]);

    return <div>
        {info}
    </div>
}