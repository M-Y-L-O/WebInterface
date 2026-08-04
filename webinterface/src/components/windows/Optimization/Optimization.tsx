"use client"

import React, {useEffect, useRef, useState} from "react";
import {IDockviewPanelProps} from "dockview-core";
import Styles from "./Optimization.module.css"
import {useClientStore, useProjectStore} from "@/lib/store";
import Dropdown from "@/components/structural/Dropdown";
import {motion} from "framer-motion";
import type {
    ArchitectureDiff,
    ChampionLineageEntry,
    MutationEvent,
    OptimizationImprovement,
    OptimizationReport,
    OptimizationSummary,
    ProgressUpdate,
    TrainingHistory,
} from "@/lib/client/ClientTypes";

type ViewMode = "setup" | "results";

function formatNumber(value: unknown, digits = 4): string {
    if (value === null || value === undefined || value === "")
        return "—";
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n))
        return String(value);
    if (Math.abs(n) >= 1000)
        return n.toLocaleString(undefined, {maximumFractionDigits: 2});
    return n.toLocaleString(undefined, {maximumFractionDigits: digits});
}

function formatPct(value: unknown): string {
    if (value === null || value === undefined)
        return "—";
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n))
        return "—";
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
}

function deltaTone(changePct: unknown): "good" | "bad" | "neutral" {
    if (changePct === null || changePct === undefined)
        return "neutral";
    const n = typeof changePct === "number" ? changePct : Number(changePct);
    if (!Number.isFinite(n) || Math.abs(n) < 0.01)
        return "neutral";
    // Loss/params/latency use reduction %; accuracy uses increase pp — positive is improvement either way.
    return n > 0 ? "good" : "bad";
}

function sparkPath(values: Array<number | string | null | undefined>, width: number, height: number): string {
    const nums = values
        .map(v => (typeof v === "number" ? v : Number(v)))
        .filter(v => Number.isFinite(v)) as number[];
    if (nums.length < 2)
        return "";
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    return nums.map((v, i) => {
        const x = (i / (nums.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
}

function Metric({label, value, delta, reversed = false}: {
    label: string;
    value: string;
    delta?: unknown;
    reversed?: boolean;
}) {
    return (
        <div className={Styles.metricCard}>
            <span className={Styles.metricLabel}>{label}</span>
            <span className={Styles.metricValue}>{value}</span>
            {delta !== undefined && delta !== null && (
                <span className={Styles.metricDelta} data-tone={deltaTone(reversed ? -delta : delta)}>
                    {formatPct(delta)}
                </span>
            )}
        </div>
    );
}

function SummarySection({
    summary,
    improvement,
    onnxExported,
}: {
    summary?: OptimizationSummary | null;
    improvement?: OptimizationImprovement | null;
    onnxExported?: boolean;
}) {
    const verdict = improvement?.verdict || summary?.verdict || "unknown";

    return (
        <div className={Styles.section}>
            <h2>Summary</h2>
            <div className={Styles.verdictRow}>
                <span className={Styles.verdictBadge} data-verdict={verdict}>
                    {verdict}
                </span>
                {summary?.strategy_used && (
                    <span className={Styles.emptyHint}>
                        Strategy: {summary.strategy_used}
                    </span>
                )}
            </div>

            <div className={Styles.metricGrid}>
                <Metric
                    label="Val loss"
                    value={formatNumber(improvement?.val_loss_after ?? summary?.best_val_loss)}
                    delta={improvement?.val_loss_change_pct}
                />
                <Metric
                    label="Params"
                    value={formatNumber(improvement?.param_count_after, 0)}
                    delta={improvement?.param_count_change_pct}
                />
                <Metric
                    label="Latency (ms)"
                    value={formatNumber(improvement?.latency_ms_per_sample_after, 3)}
                    delta={improvement?.latency_change_pct}
                    reversed={true}
                />
                {improvement?.accuracy_after != null && (
                    <Metric
                        label="Accuracy"
                        value={formatNumber(improvement.accuracy_after, 4)}
                        delta={improvement.accuracy_change_pp}
                    />
                )}
                {improvement?.r2_after != null && (
                    <Metric
                        label="R²"
                        value={formatNumber(improvement.r2_after, 4)}
                    />
                )}
                {improvement?.size_mb_after != null && (
                    <Metric
                        label="Size (MB)"
                        value={formatNumber(improvement.size_mb_after, 3)}
                    />
                )}
            </div>

            <div className={Styles.metaList}>
                {summary?.generations != null && (
                    <span>Generations: <strong>{summary.generations}</strong></span>
                )}
                {summary?.population_size != null && (
                    <span>Population: <strong>{summary.population_size}</strong></span>
                )}
                {summary?.elapsed_seconds != null && (
                    <span>Elapsed: <strong>{formatNumber(summary.elapsed_seconds, 1)}s</strong></span>
                )}
                {summary?.overall_mutation_success_rate != null && (
                    <span>Mutation success: <strong>{summary.overall_mutation_success_rate}</strong></span>
                )}
                {onnxExported != null && (
                    <span>ONNX: <strong>{onnxExported ? "exported" : "not exported"}</strong></span>
                )}
            </div>
        </div>
    );
}

function ArchitectureSection({diff}: {diff?: ArchitectureDiff | null}) {
    if (!diff)
        return null;

    const counts = diff.counts || {};
    const hasChanges = Object.values(counts).some(v => typeof v === "number" && v > 0)
        || (diff.nodes_added?.length ?? 0) > 0
        || (diff.nodes_removed?.length ?? 0) > 0
        || (diff.nodes_changed?.length ?? 0) > 0;

    if (!hasChanges)
        return (
            <div className={Styles.subSection}>
                <h3>Architecture changes</h3>
                <p className={Styles.emptyHint}>No architecture differences recorded.</p>
            </div>
        );

    return (
        <div className={Styles.subSection}>
            <h3>Architecture changes</h3>
            <div className={Styles.countRow}>
                {counts.nodes_added != null && (
                    <span className={Styles.countChip}><strong>{counts.nodes_added}</strong> added</span>
                )}
                {counts.nodes_removed != null && (
                    <span className={Styles.countChip}><strong>{counts.nodes_removed}</strong> removed</span>
                )}
                {counts.nodes_changed != null && (
                    <span className={Styles.countChip}><strong>{counts.nodes_changed}</strong> changed</span>
                )}
                {counts.edges_added != null && (
                    <span className={Styles.countChip}><strong>{counts.edges_added}</strong> edges +</span>
                )}
                {counts.edges_removed != null && (
                    <span className={Styles.countChip}><strong>{counts.edges_removed}</strong> edges −</span>
                )}
            </div>

            <ul className={Styles.diffList}>
                {(diff.nodes_added || []).map((n, i) => (
                    <li key={`add-${n.id ?? i}`} className={Styles.diffItem}>
                        <span className={Styles.diffTag}>added</span>
                        {n.type || "node"}{n.id ? ` · ${n.id}` : ""}
                    </li>
                ))}
                {(diff.nodes_removed || []).map((n, i) => (
                    <li key={`rm-${n.id ?? i}`} className={Styles.diffItem}>
                        <span className={Styles.diffTag}>removed</span>
                        {n.type || "node"}{n.id ? ` · ${n.id}` : ""}
                    </li>
                ))}
                {(diff.nodes_changed || []).map((n, i) => (
                    <li key={`ch-${n.id ?? i}`} className={Styles.diffItem}>
                        <span className={Styles.diffTag}>changed</span>
                        {n.id || "node"}
                        {n.before?.type && n.after?.type && n.before.type !== n.after.type
                            ? ` · ${n.before.type} → ${n.after.type}`
                            : ""}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function LineageSection({lineage}: {lineage?: ChampionLineageEntry[] | null}) {
    if (!lineage || lineage.length === 0)
        return null;

    return (
        <div className={Styles.subSection}>
            <h3>Champion lineage</h3>
            <ol className={Styles.lineageList}>
                {lineage.map((entry, i) => (
                    <li key={`${entry.individual_id ?? i}-${i}`} className={Styles.lineageItem}>
                        <div className={Styles.lineageTitle}>
                            Gen {entry.generation ?? "—"}
                            {entry.individual_id != null ? ` · #${entry.individual_id}` : ""}
                        </div>
                        {entry.mutations && entry.mutations.length > 0 && (
                            <div className={Styles.lineageMutations}>
                                {entry.mutations.join(" · ")}
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}

function TrainingSection({history}: {history?: TrainingHistory | null}) {
    if (!history)
        return null;

    const train = history.train_loss_history || [];
    const val = history.val_loss_history || [];
    if (train.length < 2 && val.length < 2)
        return null;

    const w = 320;
    const h = 56;
    const trainPath = sparkPath(train, w, h);
    const valPath = sparkPath(val, w, h);

    return (
        <div className={Styles.subSection}>
            <h3>Training curves</h3>
            <div className={Styles.curveWrap}>
                <div className={Styles.curveBlock}>
                    <div className={Styles.curveLabel}>
                        {history.epochs_trained != null
                            ? `${history.epochs_trained} epochs`
                            : "Loss history"}
                        {history.early_stopped ? " · early stopped" : ""}
                    </div>
                    <svg className={Styles.sparkline} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                        {trainPath && <path className={Styles.primary} d={trainPath} />}
                        {valPath && <path className={Styles.sparklineSecondary} d={valPath} />}
                    </svg>
                    <div className={Styles.curveLegend}>
                        {trainPath && (
                            <span><span className={`${Styles.legendDot} ${Styles.train}`} />Train</span>
                        )}
                        {valPath && (
                            <span><span className={`${Styles.legendDot} ${Styles.val}`} />Val</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MutationTimelineSection({events}: {events?: MutationEvent[] | null}) {
    if (!events || events.length === 0)
        return null;

    const shown = events.slice(-80).reverse();

    return (
        <div className={Styles.subSection}>
            <h3>Mutation timeline</h3>
            <ul className={Styles.timelineList}>
                {shown.map((e, i) => (
                    <li key={i} className={Styles.timelineItem}>
                        <span className={Styles.timelineOp}>{e.op || "mutation"}</span>
                        <span className={Styles.timelineDetail}>
                            {e.detail || e.node || "—"}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function Optimization(props: IDockviewPanelProps) {
    const client = useClientStore(state => state.client);
    const project = useProjectStore(state => state.project);
    const csv = useProjectStore(state => state.csv);
    const optimizationRun = useProjectStore(state => state.optimizationRun);
    const beginOptimizationRun = useProjectStore(state => state.beginOptimizationRun);
    const appendOptimizationUpdate = useProjectStore(state => state.appendOptimizationUpdate);
    const setOptimizationResult = useProjectStore(state => state.setOptimizationResult);

    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [targetFeature, setTargetFeature] = useState<string>("");
    const [problemType, setProblemType] = useState<string>("regression");
    const [strategy, setStrategy] = useState<string>("neuroevolution");
    const [encoding, setEncoding] = useState<string>("none");
    const [trainingEpochs, setTrainingEpochs] = useState<number>(10);
    const [generations, setGenerations] = useState<number>(5);

    const hasSavedResults = !!(
        optimizationRun?.result
        || optimizationRun?.report
        || optimizationRun?.runError
        || (optimizationRun?.updates.length ?? 0) > 0
    );

    const [view, setView] = useState<ViewMode>(hasSavedResults ? "results" : "setup");
    const [running, setRunning] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const updates = optimizationRun?.updates ?? [];
    const result = optimizationRun?.result ?? null;
    const report = optimizationRun?.report ?? null;
    const runError = optimizationRun?.runError ?? null;

    const historyEndRef = useRef<HTMLLIElement | null>(null);
    const restoredViewRef = useRef(false);
    const panelParams = (props as any).params || {};

    useEffect(() => {
        historyEndRef.current?.scrollIntoView({behavior: "smooth", block: "nearest"});
    }, [updates.length]);

    useEffect(() => {
        if (!restoredViewRef.current && hasSavedResults) {
            restoredViewRef.current = true;
            setView("results");
        }
    }, [hasSavedResults]);

    if(!project){
        return <div>No project loaded</div>
    }

    if(!csv){
        return <div>No data loaded</div>
    }

    const model = panelParams.modelFilepath || project.projectData.uploadedPt2File || project.projectData.modelFile;
    if(model === null || model === "null" || model === "undefined" || model === ""){
        return <div>No model loaded</div>
    }

    if(model.split(".")[1] !== "pt2")
        return <div>Only PT2 models are supported</div>

    const data: Map<string, Array<any>> = new Map();

    for(let i = 0; i < csv.data.length; i++){
        for(let key in csv.data[i]){
            const value = csv.data[i][key];
            data.has(key) ? data.get(key)?.push(value) : data.set(key, [value]);
        }
    }

    const latestProgress = [...updates].reverse().find(u => typeof u.progress === "number")?.progress ?? 0;
    const latestStatus = updates.length > 0
        ? updates[updates.length - 1].status
        : (running ? "Starting optimization…" : "Waiting");

    async function loadReport(){
        if(!client)
            return;
        setReportLoading(true);
        setReportError(null);
        try{
            const data = await client.getOptimizationReport();
            if(data instanceof Error){
                setReportError(data.message || "Failed to load optimization report");
            } else if(data?.error){
                setReportError(String(data.error));
            } else {
                setOptimizationResult({
                    report: data as OptimizationReport,
                });
            }
        } catch (e) {
            setReportError(e instanceof Error ? e.message : "Failed to load optimization report");
        } finally {
            setReportLoading(false);
        }
    }

    async function startOptimization(){
        if(!client || running)
            return;

        setView("results");
        setRunning(true);
        setReportError(null);
        beginOptimizationRun();

        const endCon = await client.StatusUpdate((event)=>{
            try{
                const parsed = JSON.parse(event.data) as ProgressUpdate;
                appendOptimizationUpdate(parsed);
            } catch {
                // ignore malformed SSE payloads
            }
        });

        try{
            const response = await client.OptimizationRequest({
                inputFeatures: selectedFeatures,
                targetFeature: targetFeature,
                epochs: trainingEpochs,
                strategy: strategy,
                encoding: encoding,
                generations: generations,
                problemType: problemType,
            }, model);

            if(response instanceof Error){
                setOptimizationResult({
                    runError: response.message || "Optimization request failed",
                });
            } else {
                const payload = response?.result ?? response;
                if(payload?.error){
                    setOptimizationResult({
                        runError: String(payload.error),
                    });
                } else {
                    setOptimizationResult({
                        result: payload as OptimizationReport,
                        runError: null,
                    });
                    // Optimized artifacts changed — drop stale cached graphs.
                    useProjectStore.getState().clearVisualisation("optimized_pt2");
                    useProjectStore.getState().clearVisualisation("optimized_onnx");
                    await loadReport();
                }
            }
        } catch (e) {
            setOptimizationResult({
                runError: e instanceof Error ? e.message : "Optimization failed",
            });
        } finally {
            endCon();
            setRunning(false);
        }
    }

    const summarySource = report || result;
    const showCompleted = !running && !!summarySource && !runError;

    if(view === "results"){
        return (
            <div className={Styles.container}>
                <div className={Styles.headerRow}>
                    <h1>Optimization results</h1>
                    <button
                        type="button"
                        className={Styles.backButton}
                        onClick={() => setView("setup")}
                        disabled={running}
                    >
                        {running ? "Running…" : "New run"}
                    </button>
                </div>

                <div className={Styles.results}>
                    <div className={Styles.section}>
                        <h2>Progress</h2>
                        <div className={Styles.statusMeta}>
                            <span>{latestStatus}</span>
                            <span>{Math.round(Number(showCompleted ? 100 : latestProgress) || 0)}%</span>
                        </div>
                        <div className={Styles.progressTrack}>
                            <div
                                className={Styles.progressFill}
                                style={{width: `${Math.min(100, Math.max(0, Number(showCompleted ? 100 : latestProgress) || 0))}%`}}
                            />
                        </div>

                        {updates.length === 0 ? (
                            <p className={Styles.emptyHint}>
                                {running ? "Waiting for status updates…" : "No status messages yet."}
                            </p>
                        ) : (
                            <ul className={Styles.historyList}>
                                {updates.map((update, index) => (
                                    <li
                                        key={index}
                                        className={Styles.historyItem}
                                        data-type={update.type || (update.error ? "error" : "status")}
                                        ref={index === updates.length - 1 ? historyEndRef : undefined}
                                    >
                                        <span className={Styles.historyIndex}>{index + 1}</span>
                                        <span className={Styles.historyText}>{update.status}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {runError && (
                        <div className={Styles.errorBanner}>{runError}</div>
                    )}

                    {showCompleted && (
                        <>
                            <SummarySection
                                summary={summarySource?.summary}
                                improvement={summarySource?.improvement}
                                onnxExported={summarySource?.onnx_exported}
                            />

                            <div className={Styles.section}>
                                <h2>Detailed report</h2>
                                {reportLoading && (
                                    <p className={Styles.loadingReport}>Loading report from /optimizationReport…</p>
                                )}
                                {reportError && !report && (
                                    <p className={Styles.emptyHint}>{reportError}</p>
                                )}
                                {report && (
                                    <>
                                        <ArchitectureSection diff={report.architecture_diff} />
                                        <LineageSection lineage={report.champion_lineage} />
                                        <TrainingSection history={report.training_history} />
                                        <MutationTimelineSection events={report.mutation_timeline} />
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={Styles.container}>
            <div className={Styles.headerRow}>
                <h1>Optimization</h1>
                <button
                    type="button"
                    className={Styles.backButton}
                    onClick={() => setView("results")}
                    disabled={!hasSavedResults}
                >
                   View Results
                </button>
            </div>
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

                <div className={"flex gap-[1rem] justify-evenly"}>
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
                </div>
                <button
                    onClick={startOptimization}
                    className={Styles.startButton}
                    disabled={running || !targetFeature || selectedFeatures.length === 0}
                >
                    Optimize
                </button>
            </div>
        </div>
    )
}
