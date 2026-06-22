"use client";

import {useSelectedStore, useVisualisationStore} from "@/lib/store";
import {GraphNode, getNodeCategory, getNodeColor} from "@/lib/windows/visualiserHelpers";
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
        <div>
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
    const visRes = useVisualisationStore(state => state.visualisation);
    let parsed = (visRes === null || typeof visRes === 'undefined' || visRes === 'undefined')
        ? null
        : JSON.parse(visRes);


    useEffect(() => {
        if(!selected)
            return;
        if('title' in selected)
            setInfo(NodeInfo(selected as GraphNode));
    }, [selected]);

    return <div className={Styles.container}>
            {info}

            {
                visRes && parsed!=undefined && parsed!=null && parsed.summary && (
                    <div className={Styles.section}>
                        <h1 className={Styles.nodeTitle} style={{backgroundColor:"var(--background)"}}>Loaded Model:</h1>
                        <div className={"flex gap-[1rem] align-middle items-center"}>
                            <h2>File:</h2>{parsed.summary.filename}
                        </div>
                        <div className={"flex gap-[1rem] align-middle items-center"}>
                            <h2>Producer:</h2>{parsed.summary.producer}
                        </div>
                        <h2>Inputs:</h2>
                        <ul>
                            {parsed.summary.inputs.map((input:{a:string, name:string}, i:number)=>(
                                <li key={i}>{input.name}</li>
                            ))}
                        </ul>
                        <h2>Outputs:</h2>
                        <ul>
                            {parsed.summary.outputs.map((output:{a:string,name:string}, i:number)=>(
                                <li key={i}>{output.name}</li>
                            ))}
                        </ul>
                        <div className={"flex gap-[1rem] align-middle items-center"}>
                        <h2>Node count:</h2> {parsed.summary.node_count}
                        </div>
                    </div>
                )
            }

    </div>
}