"use client"

import React, {useState} from "react";
import {IDockviewPanelProps} from "dockview-core";
import Styles from "./Optimization.module.css"
import {useClientStore} from "@/lib/store";
import Dropdown from "@/components/structural/Dropdown";
import {motion} from "framer-motion";

export default function Optimization(props: IDockviewPanelProps) {
    const client = useClientStore(state => state.client);
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [targetFeature, setTargetFeature] = useState<string>("");
    const [problemType, setProblemType] = useState<string>("regression");

    const [strategy, setStrategy] = useState<string>("neuroevolution");
    const [encoding, setEncoding] = useState<string>("none");

    const [trainingEpochs, setTrainingEpochs] = useState<number>(10);
    const [generations, setGenerations] = useState<number>(5);
    const [result, setResult] = useState<any>(null);
    const [updates, setUpdates] = useState<any[]>([]);
    const panelParams = (props as any).params || {};
    const projectStore = sessionStorage.getItem("loadedProject");

    if(projectStore === null || projectStore === "null" || projectStore === "undefined" || projectStore === "{}"){
        return <div>No project loaded</div>
    }

    const project = JSON.parse(projectStore);

    const csvStore = sessionStorage.getItem("csv");

    if(csvStore === null || csvStore === "null" || csvStore === "undefined" || csvStore === "{}"){
        return <div>No data loaded</div>
    }

    const model = panelParams.modelFilepath || project.projectData.uploadedPt2File || project.projectData.modelFile;
    if(model === null || model === "null" || model === "undefined" || model === ""){
        return <div>No model loaded</div>
    }

    if(model.split(".")[1] !== "pt2")
        return <div>Only PT2 models are supported</div>

    const csv = JSON.parse(csvStore);

    let data:Map<string, Array<any>> = new Map();

    for(let i = 0; i < csv.data.length; i++){
        for(let key in csv.data[i]){
            const value = csv.data[i][key];
            data.has(key) ? data.get(key)?.push(value) : data.set(key, [value]);
        }
    }

    async function startOptimization(){
        if(!client)
            return;

        setUpdates([]);

        const endCon = await client.StatusUpdate((event)=>{
            console.log(JSON.parse(event.data));
            setUpdates((prev)=>[...prev, JSON.parse(event.data)]);
        })

        const _result = await client.OptimizationRequest({
            inputFeatures: selectedFeatures,
            targetFeature: targetFeature,
            epochs: trainingEpochs,
            strategy: strategy,
            encoding: encoding,
            generations: generations,
            problemType:problemType
        }, model)

        console.log(_result);

        setResult(_result);

        endCon();
    }

    return (
        <div className={Styles.container}>
            <h1>Optimization</h1>
            <div>
                <div className={Styles.container}>
                    <div className={Styles.section}>
                        <h2>Feature select</h2>
                        <ul>
                            {
                                [...data.keys()].map((key, index) => <li key={index}><input type="checkbox" onChange={()=>{
                                    if(selectedFeatures.includes(key)){
                                        setSelectedFeatures(selectedFeatures.filter(feature => feature !== key));
                                    }else{
                                        setSelectedFeatures([...selectedFeatures, key]);
                                    }
                                }} disabled={key==targetFeature} checked={selectedFeatures.includes(key)}/>{key}</li>)
                            }
                        </ul>
                    </div>
                    <div className={Styles.section}>
                        <h2>Target Feature</h2>
                        <Dropdown onChange={(e)=>{
                            setTargetFeature(e);
                            if(selectedFeatures.includes(e)){
                                setSelectedFeatures(selectedFeatures.filter(feature => feature !== e));
                            }
                        }} options={[...data.keys()]} defaultValue={"Select a feature"}>

                        </Dropdown>
                    </div>
                    <div className={Styles.section}>
                        <h2>Problem type:</h2>
                        <div className={"flex gap-[1rem]"}>
                            <button onClick={()=>{
                                setProblemType("regression");
                            }} className={Styles.optionButton}>
                                <span className={"relative z-10"} style={problemType === "regression" ? {color:"var(--card-background)"}:{}}>Regression</span>
                                {
                                    problemType === 'regression' && (
                                        <motion.div
                                            layoutId={"activePill2"}
                                            transition={{
                                                type:"spring",
                                                stiffness: 300,
                                                damping: 30,
                                                duration: 0.15,
                                            }}
                                            exit={{opacity:0}}
                                            className={Styles.active}>

                                        </motion.div>
                                    )
                                }
                            </button>
                            <button onClick={()=>{
                                setProblemType("classification");
                            }} className={Styles.optionButton}>
                                <span className={"relative z-10"} style={problemType === "classification" ? {color:"var(--card-background)"}:{}}>Classification</span>
                                {
                                    problemType === "classification" && (
                                        <motion.div
                                            layoutId={"activePill2"}
                                            transition={{
                                                type:"spring",
                                                stiffness: 300,
                                                damping: 30,
                                                duration: 0.15,
                                            }}
                                            exit={{opacity:0}}
                                            className={Styles.active}>

                                        </motion.div>
                                    )
                                }
                            </button>

                        </div>
                    </div>
                    <div className={Styles.section}>
                        <h2>Optimization Strategy:</h2>
                        <Dropdown onChange={(e)=>{setStrategy(e)}} options={["neuroevolution", "genetic"]} defaultValue={"neuroevolution"}>

                        </Dropdown>
                    </div>
                    <div className={Styles.section}>
                        <h2>Feature encoding:</h2>
                        <div className={"flex gap-[1rem]"}>
                            <button onClick={()=>{
                                setEncoding("none");
                            }} className={Styles.optionButton}>
                                <span className={"relative z-10"} style={encoding === "none" ? {color:"var(--card-background)"}:{}}>None</span>
                                {
                                    encoding === 'none' && (
                                        <motion.div
                                            layoutId={"activePill"}
                                            transition={{
                                                type:"spring",
                                                stiffness: 300,
                                                damping: 30,
                                                duration: 0.15,
                                            }}
                                            exit={{opacity:0}}
                                            className={Styles.active}>

                                        </motion.div>
                                    )
                                }
                            </button>
                            <button onClick={()=>{
                                setEncoding("label");
                            }} className={Styles.optionButton}>
                                <span className={"relative z-10"} style={encoding === "label" ? {color:"var(--card-background)"}:{}}>Label</span>
                                {
                                    encoding === "label" && (
                                        <motion.div
                                            layoutId={"activePill"}
                                            transition={{
                                                type:"spring",
                                                stiffness: 300,
                                                damping: 30,
                                                duration: 0.15,
                                            }}
                                            exit={{opacity:0}}
                                            className={Styles.active}>

                                        </motion.div>
                                    )
                                }
                            </button>
                            <button onClick={()=>{
                                setEncoding("one-hot");
                            }} className={Styles.optionButton}>
                                <span className={"relative z-10"} style={encoding === "one-hot" ? {color:"var(--card-background)"}:{}}>One-Hot</span>
                                {
                                    encoding === "one-hot" && (
                                        <motion.div
                                            layoutId={"activePill"}
                                            transition={{
                                                type:"spring",
                                                stiffness: 300,
                                                damping: 30,
                                                duration: 0.15,
                                            }}
                                            exit={{opacity:0}}
                                            className={Styles.active}>

                                        </motion.div>
                                    )
                                }
                            </button>
                        </div>
                    </div>

                    <div className={Styles.section}>
                        <h2>Training Epochs</h2>
                        <input type={"number"} defaultValue={10} onChange={(e)=>{setTrainingEpochs(parseInt(e.target.value))}} />
                    </div>
                    {
                        strategy === "neuroevolution" &&
                        <div className={Styles.section}>
                            <h2>Search Generations:</h2>
                            <input type={"number"} defaultValue={5} onChange={(e)=>{setGenerations(parseInt(e.target.value))}} />
                        </div>
                    }
                    <button onClick={startOptimization} className={Styles.startButton}>
                        Optimize
                    </button>
                </div>

                <div>
                    {
                        <ul>
                            {updates.length > 0 && (
                            updates.map((update, index) => (
                                <li key={index}>{update.status}</li>
                            ))
                        )}
                        </ul>
                    }

                    {result && (JSON.stringify(result))}
                </div>
            </div>
        </div>
    )
}