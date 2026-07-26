"use client"

import React, {useEffect, useRef, useState} from "react";
import {IDockviewPanelProps} from "dockview-core";
import Styles from "./Diagnostics.module.css"
import {useClientStore, useProjectStore} from "@/lib/store";
import Dropdown from "@/components/structural/Dropdown";
import {motion} from "framer-motion";
import type {
    DiagnosticsWarningItem,
    DiagnosticsWarnings,
    ModelDiagnosticsReport,
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

function formatBytes(value: unknown): string {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n))
        return "—";
    if (n < 1024)
        return `${n} B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatShape(shape: unknown): string {
    if (!Array.isArray(shape) || shape.length === 0)
        return "—";
    return `[${shape.join(", ")}]`;
}

function yesNo(value: unknown): string {
    if (value === true) return "yes";
    if (value === false) return "no";
    return "—";
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

function Metric({label, value}: {label: string; value: string}) {
    return (
        <div className={Styles.metricCard}>
            <span className={Styles.metricLabel}>{label}</span>
            <span className={Styles.metricValue}>{value}</span>
        </div>
    );
}

function OverviewSection({report}: {report: ModelDiagnosticsReport}) {
    const overview = report.overview || {};
    const mode = overview.diagnostic_mode || report.request?.mode || "unknown";
    const forwardOk = overview.forward_pass_succeeded;

    return (
        <div className={Styles.section}>
            <h2>Overview</h2>
            <div className={Styles.verdictRow}>
                <span className={Styles.verdictBadge} data-verdict={mode}>
                    {mode}
                </span>
                <span className={Styles.verdictBadge} data-verdict={forwardOk ? "ok" : "failed"}>
                    {forwardOk ? "forward pass ok" : "forward pass failed"}
                </span>
            </div>

            <div className={Styles.metricGrid}>
                <Metric label="Model" value={overview.model_name || "—"} />
                <Metric label="Input shape" value={formatShape(overview.input_shape)} />
                <Metric label="Output shape" value={formatShape(overview.output_shape)} />
                <Metric label="Weights loaded" value={yesNo(overview.weights_loaded)} />
                <Metric label="ONNX exported" value={yesNo(overview.onnx_exported)} />
            </div>
        </div>
    );
}

function ArchitectureSection({report}: {report: ModelDiagnosticsReport}) {
    const arch = report.architecture;
    if (!arch)
        return null;

    const typeCounts = arch.node_type_counts || {};

    return (
        <div className={Styles.section}>
            <h2>Architecture</h2>
            <div className={Styles.metricGrid}>
                <Metric label="Nodes" value={formatNumber(arch.node_count, 0)} />
                <Metric label="Edges" value={formatNumber(arch.edge_count, 0)} />
                <Metric label="Params" value={formatNumber(arch.total_parameters, 0)} />
                <Metric label="Trainable" value={formatNumber(arch.trainable_parameters, 0)} />
                <Metric label="Size" value={formatNumber(arch.parameter_megabytes, 3) + " MB"} />
                <Metric label="Density" value={formatNumber(arch.graph_density, 6)} />
            </div>

            {Object.keys(typeCounts).length > 0 && (
                <div className={Styles.subSection}>
                    <h3>Node types</h3>
                    <div className={Styles.countRow}>
                        {Object.entries(typeCounts).map(([type, count]) => (
                            <span key={type} className={Styles.countChip}>
                                <strong>{count}</strong>{type}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {arch.shape_inference_error && (
                <p className={Styles.emptyHint}>Shape inference: {arch.shape_inference_error}</p>
            )}
        </div>
    );
}

function InferenceSection({report}: {report: ModelDiagnosticsReport}) {
    const inference = report.inference;
    if (!inference)
        return null;

    const compute = inference.compute as Record<string, unknown> | undefined;
    const memory = inference.memory as Record<string, unknown> | undefined;
    const flops = compute?.total_flops ?? compute?.mega_flops;
    const peakMb = memory?.inference_peak_mb_estimate ?? memory?.activation_mb_sum;

    return (
        <div className={Styles.section}>
            <h2>Inference</h2>
            <div className={Styles.metricGrid}>
                <Metric label="Dummy input" value={formatShape(inference.dummy_input_shape)} />
                <Metric label="Succeeded" value={yesNo(inference.succeeded)} />
                <Metric label="Latency (ms)" value={formatNumber(inference.latency_ms, 3)} />
                <Metric label="FLOPs" value={formatNumber(flops, 0)} />
                <Metric
                    label="Peak memory"
                    value={peakMb != null ? `${formatNumber(peakMb, 3)} MB` : "—"}
                />
            </div>
            {inference.error && (
                <p className={Styles.emptyHint}>{inference.error}</p>
            )}
        </div>
    );
}

function WeightsOnnxSection({report}: {report: ModelDiagnosticsReport}) {
    const weights = report.weights;
    const onnx = report.onnx;
    if (!weights && !onnx)
        return null;

    return (
        <div className={Styles.section}>
            <h2>Weights & ONNX</h2>
            <div className={Styles.metricGrid}>
                {weights && (
                    <>
                        <Metric label="Weights loaded" value={yesNo(weights.loaded)} />
                        <Metric label="Matched keys" value={formatNumber(weights.matched_key_count, 0)} />
                        <Metric label="Unmatched src" value={formatNumber(weights.unmatched_source_count, 0)} />
                        <Metric label="Unmatched tgt" value={formatNumber(weights.unmatched_target_count, 0)} />
                    </>
                )}
                {onnx && (
                    <>
                        <Metric label="ONNX exported" value={yesNo(onnx.exported)} />
                        <Metric label="ONNX valid" value={yesNo(onnx.valid)} />
                        <Metric label="ONNX size" value={formatBytes(onnx.size_bytes)} />
                    </>
                )}
            </div>
            {(weights?.error || onnx?.error) && (
                <p className={Styles.emptyHint}>{weights?.error || onnx?.error}</p>
            )}
        </div>
    );
}

function WarningsSection({warnings}: {warnings?: DiagnosticsWarnings | null}) {
    if (!warnings)
        return null;

    const items = warnings.items || [];
    const bySeverity = warnings.by_severity || {};

    return (
        <div className={Styles.section}>
            <h2>Warnings</h2>
            <div className={Styles.countRow}>
                <span className={Styles.countChip}>
                    <strong>{warnings.total ?? items.length}</strong>total
                </span>
                {Object.entries(bySeverity).map(([sev, count]) => (
                    count > 0 ? (
                        <span key={sev} className={Styles.countChip} data-severity={sev}>
                            <strong>{count}</strong>{sev}
                        </span>
                    ) : null
                ))}
            </div>

            {items.length === 0 ? (
                <p className={Styles.emptyHint}>No warnings detected.</p>
            ) : (
                <ul className={Styles.warningList}>
                    {items.map((item: DiagnosticsWarningItem, i) => (
                        <li
                            key={`${item.category}-${item.node_id ?? i}-${i}`}
                            className={Styles.warningItem}
                            data-severity={item.severity || "info"}
                        >
                            <div className={Styles.warningHeader}>
                                <span className={Styles.warningSeverity} style={item.severity == "low" || item.severity == "info" ? {color:"var(--text)"} : (item.severity == "high" ? {color:"var(--error)"} : {color:"var(--warning)"}) }>{item.severity || "info"}</span>
                                <span className={Styles.warningCategory}>
                                    {item.category || "general"}
                                    {item.node_id ? ` · ${item.node_id}` : ""}
                                </span>
                            </div>
                            <div className={Styles.warningMessage}>{item.message || "—"}</div>
                            {item.suggestion && (
                                <div className={Styles.warningSuggestion}>{item.suggestion}</div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function TrainingSection({report}: {report: ModelDiagnosticsReport}) {
    const training = report.training as Record<string, unknown> | undefined;
    const validation = report.validation as Record<string, unknown> | undefined;
    if (!training?.performed && !validation?.available)
        return null;

    const history = Array.isArray(training?.history)
        ? (training.history as Array<Record<string, unknown>>)
        : [];
    const train = history.map((row) => row.train_loss);
    const val = history.map((row) => row.validation_loss);
    const epochs = training?.epochs_completed as number | undefined;

    const final = (validation?.final || {}) as Record<string, unknown>;
    const metrics = (final.metrics || {}) as Record<string, unknown>;

    const w = 320;
    const h = 56;
    const trainPath = sparkPath(train, w, h);
    const valPath = sparkPath(val, w, h);

    return (
        <div className={Styles.section}>
            <h2>Training & validation</h2>
            <div className={Styles.metricGrid}>
                <Metric label="Performed" value={yesNo(training?.performed)} />
                <Metric label="Epochs" value={formatNumber(epochs, 0)} />
                <Metric label="Duration (s)" value={formatNumber(training?.duration_seconds, 2)} />
                {final.loss != null && (
                    <Metric label="Val loss" value={formatNumber(final.loss)} />
                )}
                {metrics.accuracy != null && (
                    <Metric label="Accuracy" value={formatNumber(metrics.accuracy)} />
                )}
                {metrics.r2 != null && (
                    <Metric label="R²" value={formatNumber(metrics.r2)} />
                )}
                {validation?.loss_improvement_percent != null && (
                    <Metric
                        label="Loss Δ%"
                        value={formatNumber(validation.loss_improvement_percent, 2)}
                    />
                )}
            </div>

            {(trainPath || valPath) && (
                <div className={Styles.subSection}>
                    <h3>Loss curves</h3>
                    <div className={Styles.curveWrap}>
                        <div className={Styles.curveBlock}>
                            <div className={Styles.curveLabel}>
                                {epochs != null ? `${epochs} epochs` : "Loss history"}
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
            )}

            {validation?.reason && !validation.available && (
                <p className={Styles.emptyHint}>{String(validation.reason)}</p>
            )}
        </div>
    );
}

export default function Diagnostics(props: IDockviewPanelProps) {
    const client = useClientStore(state => state.client);
    const project = useProjectStore(state => state.project);
    const csv = useProjectStore(state => state.csv);
    const diagnosticsRun = useProjectStore(state => state.diagnosticsRun);
    const beginDiagnosticsRun = useProjectStore(state => state.beginDiagnosticsRun);
    const setDiagnosticsResult = useProjectStore(state => state.setDiagnosticsResult);

    const [mode, setMode] = useState<string>("dummy");
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [targetFeature, setTargetFeature] = useState<string>("");
    const [problemType, setProblemType] = useState<string>("regression");
    const [epochs, setEpochs] = useState<number>(10);
    const [batchSize, setBatchSize] = useState<number>(32);
    const [learningRate, setLearningRate] = useState<number>(0.001);

    const hasSavedResults = !!(
        diagnosticsRun?.result
        || diagnosticsRun?.report
        || diagnosticsRun?.runError
    );

    const [view, setView] = useState<ViewMode>(hasSavedResults ? "results" : "setup");
    const [running, setRunning] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const result = diagnosticsRun?.result ?? null;
    const report = diagnosticsRun?.report ?? null;
    const runError = diagnosticsRun?.runError ?? null;

    const restoredViewRef = useRef(false);
    const panelParams = (props as any).params || {};

    useEffect(() => {
        if (!restoredViewRef.current && hasSavedResults) {
            restoredViewRef.current = true;
            setView("results");
        }
    }, [hasSavedResults]);

    if (!project) {
        return <div>No project loaded</div>;
    }

    const model = panelParams.modelFilepath
        || project.projectData?.uploadedPt2File
        || project.projectData?.modelFile;
    if (model === null || model === "null" || model === "undefined" || model === "") {
        return <div>No model loaded</div>;
    }

    const modelExt = String(model).split(".").pop()?.toLowerCase();
    if (modelExt !== "pt2") {
        return <div>Only PT2 models are supported</div>;
    }

    const featureKeys: string[] = [];
    if (csv?.data?.length) {
        for (const key in csv.data[0]) {
            featureKeys.push(key);
        }
    }

    async function loadReport() {
        if (!client)
            return;
        setReportLoading(true);
        setReportError(null);
        try {
            const data = await client.getModelDiagnosticsReport();
            if (data instanceof Error) {
                setReportError(data.message || "Failed to load diagnostics report");
            } else if (data?.error) {
                setReportError(String(data.error));
            } else {
                setDiagnosticsResult({
                    report: data as ModelDiagnosticsReport,
                });
                // Keep project payload in sync for export/session continuity.
                useProjectStore.setState((state) => ({
                    project: state.project
                        ? {
                            ...state.project,
                            hasDiagnosticsReport: true,
                            diagnosticsReport: data,
                        }
                        : state.project,
                }));
            }
        } catch (e) {
            setReportError(e instanceof Error ? e.message : "Failed to load diagnostics report");
        } finally {
            setReportLoading(false);
        }
    }

    async function startDiagnostics() {
        if (!client || running)
            return;

        setView("results");
        setRunning(true);
        setReportError(null);
        beginDiagnosticsRun();

        try {
            const payload: Record<string, unknown> = {
                mode,
                problemType,
            };

            if (mode === "retrain") {
                payload.inputFeatures = selectedFeatures;
                payload.outputFeatures = targetFeature ? [targetFeature] : [];
                payload.targetFeature = targetFeature;
                payload.epochs = epochs;
                payload.batchSize = batchSize;
                payload.learningRate = learningRate;
            }

            const response = await client.ModelDiagnosticsRequest(payload);

            if (response instanceof Error) {
                setDiagnosticsResult({
                    runError: response.message || "Diagnostics request failed",
                });
            } else if (response?.error) {
                setDiagnosticsResult({
                    runError: String(response.error),
                });
            } else {
                const diagnostics = response as ModelDiagnosticsReport;
                setDiagnosticsResult({
                    result: diagnostics,
                    report: diagnostics,
                    runError: null,
                });
                useProjectStore.setState((state) => ({
                    project: state.project
                        ? {
                            ...state.project,
                            hasDiagnosticsReport: true,
                            diagnosticsReport: diagnostics,
                        }
                        : state.project,
                }));
                await loadReport();
            }
        } catch (e) {
            setDiagnosticsResult({
                runError: e instanceof Error ? e.message : "Diagnostics failed",
            });
        } finally {
            setRunning(false);
        }
    }

    const summarySource = report || result;
    const showCompleted = !running && !!summarySource && !runError;
    const canStart = mode === "dummy"
        || (mode === "retrain" && !!csv && !!targetFeature && selectedFeatures.length > 0);

    if (view === "results") {
        return (
            <div className={Styles.container}>
                <div className={Styles.headerRow}>
                    <h1>Diagnostics results</h1>
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
                    {running && (
                        <div className={Styles.section}>
                            <h2>Status</h2>
                            <p className={Styles.emptyHint}>Running model diagnostics…</p>
                        </div>
                    )}

                    {runError && (
                        <div className={Styles.errorBanner}>{runError}</div>
                    )}

                    {reportLoading && (
                        <p className={Styles.loadingReport}>Loading report from project…</p>
                    )}
                    {reportError && !summarySource && (
                        <p className={Styles.emptyHint}>{reportError}</p>
                    )}

                    {showCompleted && summarySource && (
                        <>
                            <OverviewSection report={summarySource} />
                            <ArchitectureSection report={summarySource} />
                            <InferenceSection report={summarySource} />
                            <WeightsOnnxSection report={summarySource} />
                            <WarningsSection warnings={summarySource.warnings} />
                            <TrainingSection report={summarySource} />
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={Styles.container}>
            <div className={Styles.headerRow}>
                <h1>Model diagnostics</h1>
                <button
                    type="button"
                    className={Styles.backButton}
                    onClick={() => setView("results")}
                    disabled={!hasSavedResults}
                >
                    View Results
                </button>
            </div>

            <div className={Styles.section}>
                <h2>Mode</h2>
                <div className={"flex gap-[1rem]"}>
                    <button
                        type="button"
                        onClick={() => setMode("dummy")}
                        className={Styles.optionButton}
                    >
                        <span className={"relative z-10"} style={mode === "dummy" ? {color: "var(--card-background)"} : {}}>
                            Dummy
                        </span>
                        {mode === "dummy" && (
                            <motion.div
                                layoutId={"diagModePill"}
                                transition={{type: "spring", stiffness: 300, damping: 30, duration: 0.15}}
                                className={Styles.active}
                            />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("retrain")}
                        className={Styles.optionButton}
                    >
                        <span className={"relative z-10"} style={mode === "retrain" ? {color: "var(--card-background)"} : {}}>
                            Retrain
                        </span>
                        {mode === "retrain" && (
                            <motion.div
                                layoutId={"diagModePill"}
                                transition={{type: "spring", stiffness: 300, damping: 30, duration: 0.15}}
                                className={Styles.active}
                            />
                        )}
                    </button>
                </div>
                <p className={Styles.emptyHint}>
                    {mode === "dummy"
                        ? "Structural checks, dummy forward pass, ONNX export — no training data required."
                        : "Retrain on CSV features and collect validation metrics."}
                </p>
            </div>

            {mode === "retrain" && (
                <>
                    {!csv ? (
                        <div className={Styles.section}>
                            <p className={Styles.emptyHint}>Load a CSV to use retrain mode.</p>
                        </div>
                    ) : (
                        <>
                            <div className={Styles.section}>
                                <h2>Feature select</h2>
                                <ul>
                                    {featureKeys.map((key) => (
                                        <li key={key}>
                                            <input
                                                type="checkbox"
                                                disabled={key === targetFeature}
                                                checked={selectedFeatures.includes(key)}
                                                onChange={() => {
                                                    if (selectedFeatures.includes(key)) {
                                                        setSelectedFeatures(selectedFeatures.filter(f => f !== key));
                                                    } else {
                                                        setSelectedFeatures([...selectedFeatures, key]);
                                                    }
                                                }}
                                            />
                                            {key}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className={Styles.section}>
                                <h2>Target Feature</h2>
                                <Dropdown
                                    onChange={(e) => {
                                        setTargetFeature(e);
                                        if (selectedFeatures.includes(e)) {
                                            setSelectedFeatures(selectedFeatures.filter(f => f !== e));
                                        }
                                    }}
                                    options={featureKeys}
                                    defaultValue={"Select a feature"}
                                />
                            </div>

                            <div className={Styles.section}>
                                <h2>Problem type</h2>
                                <div className={"flex gap-[1rem]"}>
                                    <button
                                        type="button"
                                        onClick={() => setProblemType("regression")}
                                        className={Styles.optionButton}
                                    >
                                        <span className={"relative z-10"} style={problemType === "regression" ? {color: "var(--card-background)"} : {}}>
                                            Regression
                                        </span>
                                        {problemType === "regression" && (
                                            <motion.div
                                                layoutId={"diagProblemPill"}
                                                transition={{type: "spring", stiffness: 300, damping: 30, duration: 0.15}}
                                                className={Styles.active}
                                            />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProblemType("classification")}
                                        className={Styles.optionButton}
                                    >
                                        <span className={"relative z-10"} style={problemType === "classification" ? {color: "var(--card-background)"} : {}}>
                                            Classification
                                        </span>
                                        {problemType === "classification" && (
                                            <motion.div
                                                layoutId={"diagProblemPill"}
                                                transition={{type: "spring", stiffness: 300, damping: 30, duration: 0.15}}
                                                className={Styles.active}
                                            />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className={Styles.section}>
                                <div className={"flex gap-[1rem] justify-evenly"}>
                                    <div className={Styles.metricCard}>
                                        <h2>Epochs</h2>
                                        <input
                                            type="number"
                                            defaultValue={10}
                                            onChange={(e) => setEpochs(parseInt(e.target.value) || 10)}
                                        />
                                    </div>
                                    <div className={Styles.metricCard}>
                                        <h2>Batch size</h2>
                                        <input
                                            type="number"
                                            defaultValue={32}
                                            onChange={(e) => setBatchSize(parseInt(e.target.value) || 32)}
                                        />
                                    </div>
                                    <div className={Styles.metricCard}>
                                        <h2>Learning rate</h2>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            defaultValue={0.001}
                                            onChange={(e) => setLearningRate(parseFloat(e.target.value) || 0.001)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            <button
                type="button"
                onClick={startDiagnostics}
                className={Styles.startButton}
                disabled={running || !canStart}
            >
                Run diagnostics
            </button>
        </div>
    );
}
