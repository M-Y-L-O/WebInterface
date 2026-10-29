"use client";

import {useActiveInspectContext} from "@/lib/store";
import {GraphNode, getNodeCategory, getNodeColor} from "@/lib/windows/visualiserHelpers";
import {ReactNode} from "react";
import Styles from "./Properties.module.css"
import {AnimatePresence, motion} from "framer-motion";

const panelVariants = {
    initial: {opacity:0, y:10},
    animate: {opacity:1, y:0},
    exit: {opacity:0, y:-10}
}

function parseNodeTitle(title:string){
    const trimmedTitle = title.trim();
    console.log(trimmedTitle);
    if(trimmedTitle.startsWith('{') || trimmedTitle.startsWith('[')){
        try{
            const parsed = JSON.parse(trimmedTitle);
            console.log(parsed);
            return JSON.parse(trimmedTitle);
        } catch (e) {
            // do nothing and use default parser
        }
    }

    const lines = trimmedTitle.split("\n");
    const parsed: Record<string, string|string[] | Record<string, string|number> | number> = {};
    let currentAttr : Record<string, string|number> | null = null;
    console.log(title);
    

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

function dynamicField(value:any):ReactNode{
    if(value === null || typeof value === 'undefined')
        return null;

    if(typeof value === 'string' || typeof value === 'number'){
        return <span>{value}</span>
    }

    if(Array.isArray(value)){
        return(<ul>
            {value.map((item, i)=>(
                <li key={i} className={"flex"}>
                    {
                        typeof item === 'object' && item !== null ? (
                            dynamicField(item)
                        ) : String(item)
                    }
                </li>
            ))}
        </ul>)
    }

    if(typeof value === 'object'){
        return (
            <div className={"flex-col"}>
                {
                    Object.entries(value).map(([subKey, subValue])=>(
                        <div key={subKey} className={"flex"}>
                            <b>{subKey}</b>: {String(subValue)}
                        </div>
                    ))
                }
            </div>
        )
    }

    return String(value);
}

function NodeInfo({node}:{node:GraphNode|null}){

    const info = node ? parseNodeTitle(node.title!.toString()) : "";
    const color = node ? getNodeColor(node) : "#000000";

    const animationKey = node ? node.id || node.label.toString() : 'default';

    // @ts-ignore
    return (
        <AnimatePresence mode={"popLayout"}>
            {node &&
            <motion.div className={Styles.section}  key={animationKey} transition={{duration:0.2}} variants={panelVariants} initial="initial" animate="animate" exit="exit">
                <motion.div animate={{backgroundColor:color}} className={Styles.nodeTitle}>
                    {node.label.toString()}
                </motion.div>

                <div className={Styles.section}>
                    <h2>
                        <b>Category</b>: {getNodeCategory(node.label)}
                    </h2>
                </div>

                {
                    Object.entries(info).map(([key, value])=>{
                        if(key === 'category') return null;

                        const displayTitle = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, (str) => str.toUpperCase());

                        return (
                            <div key={key} className={Styles.section}>
                                <h2>
                                    <b>{displayTitle}</b>:
                                </h2>
                                {dynamicField(value)}
                            </div>
                        )
                    })
                }
            </motion.div>}
        </AnimatePresence>
    )
}

export default function Properties() {
    const context = useActiveInspectContext();
    const selected = context?.selected ?? null;
    const visRes = context?.visualisation ?? null;

    let parsed: any = null;
    if (visRes != null && visRes !== 'undefined') {
        if (typeof visRes === 'string') {
            try {
                parsed = JSON.parse(visRes);
            } catch {
                parsed = null;
            }
        } else {
            parsed = visRes;
        }
    }

    const activeNode = selected && 'title' in selected ? (selected as GraphNode) : null;

    return (
        <div className={Styles.window}>
            <AnimatePresence mode={"popLayout"}>
                <motion.div className={Styles.container} variants={panelVariants} initial="initial" animate="animate" transition={{duration:0.2}}>
                    {!context && (
                        <div className={Styles.section}>
                            <h2>Select a Visualiser or Model Editor panel to inspect.</h2>
                        </div>
                    )}
                    <NodeInfo node={activeNode}/>

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
                </motion.div>
            </AnimatePresence>
        </div>
    )
}