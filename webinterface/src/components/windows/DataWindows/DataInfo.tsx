"use client";

import React, {useEffect, useMemo, useState} from "react";
import {useClientStore, useProjectStore} from "@/lib/store";
import type {
    AdvancedAnalysisResponse,
    ChartDataResponse,
    CorrelationAnalysisResponse,
    CorrelationPair,
    TargetAnalysisResponse,
} from "@/lib/client/ClientTypes";
import {
    CategoryBarChart,
    BoxPlotChart,
    HeatmapChart,
    HistogramChart,
    ScatterChart,
} from "./Charts";
import Style from "./Data.module.css";
import {motion, AnimatePresence} from "framer-motion";
import Dropdown from "@/components/structural/Dropdown";

type TabId = "summary" | "charts" | "correlation" | "quality" | "target";

function strengthTone(strength?: string) {
    if (strength === "strong") return "var(--error)";
    if (strength === "moderate") return "var(--warning)";
    return "var(--text-light)";
}

function CorrelationList({pairs, valueKey}: {pairs: CorrelationPair[]; valueKey: "correlation" | "association"}) {
    if (!pairs.length) return <div className={Style.emptyChart}>No pairs above threshold</div>;
    return (
        <div className={Style.corrList}>
            {pairs.map((p, i) => {
                const value = p[valueKey];
                return (
                    <div key={i} className={Style.corrRow}>
                        <span className={Style.corrPair}>{p.column1} × {p.column2}</span>
                        <span className={Style.corrValue}>{typeof value === "number" ? value.toFixed(3) : "—"}</span>
                        <span className={Style.corrStrength} style={{color: strengthTone(p.strength)}}>{p.strength}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function DataInfo() {
    const client = useClientStore(state => state.client);
    const results = useProjectStore(state => state.csv);
    const currentProject = useProjectStore(state => state.project);

    const [tab, setTab] = useState<TabId>("summary");
    const [chartData, setChartData] = useState<ChartDataResponse | null>(null);
    const [advanced, setAdvanced] = useState<AdvancedAnalysisResponse | null>(null);
    const [correlation, setCorrelation] = useState<CorrelationAnalysisResponse | null>(null);
    const [target, setTarget] = useState<TargetAnalysisResponse | null>(null);
    const [targetColumn, setTargetColumn] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [histCol, setHistCol] = useState("");
    const [barCol, setBarCol] = useState("");
    const [boxCol, setBoxCol] = useState("");

    const allColumns = useMemo(() => {
        if (!results?.results) return [] as string[];
        return [
            ...(results.results.numerical_columns || []),
            ...(results.results.categorical_columns || []),
        ];
    }, [results]);

    useEffect(() => {
        if (!client || !results) return;

        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const [charts, adv, corr] = await Promise.all([
                    client.getChartData(),
                    client.getAdvancedAnalysis(),
                    client.getCorrelationAnalysis(),
                ]);
                if (cancelled) return;

                if (charts instanceof Error) {
                    setError(charts.message);
                } else if (charts && typeof charts === "object" && "error" in charts && charts.error) {
                    setError(String(charts.error));
                } else if (charts) {
                    setChartData(charts as ChartDataResponse);
                    const histKeys = Object.keys(charts.histograms || {});
                    const barKeys = Object.keys(charts.bar_charts || {});
                    const boxKeys = Object.keys(charts.box_plots || {});
                    if (histKeys[0]) setHistCol(histKeys[0]);
                    if (barKeys[0]) setBarCol(barKeys[0]);
                    if (boxKeys[0]) setBoxCol(boxKeys[0]);
                }

                if (!(adv instanceof Error) && adv && !(typeof adv === "object" && "error" in adv && adv.error)) {
                    setAdvanced(adv as AdvancedAnalysisResponse);
                }
                if (!(corr instanceof Error) && corr && !(typeof corr === "object" && "error" in corr && corr.error)) {
                    setCorrelation(corr as CorrelationAnalysisResponse);
                }
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analysis");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [client, results]);

    useEffect(() => {
        if (allColumns.length && !targetColumn) setTargetColumn(allColumns[0]);
    }, [allColumns, targetColumn]);

    async function runTargetAnalysis() {
        if (!client || !targetColumn) return;
        setLoading(true);
        setError(null);
        try {
            const res = await client.getTargetAnalysis(targetColumn);
            if (res instanceof Error) {
                setError(res.message);
                setTarget(null);
            } else {
                setTarget(res as TargetAnalysisResponse);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Target analysis failed");
        } finally {
            setLoading(false);
        }
    }

    if (!results) return <div className={Style.container}>No data loaded</div>;

    const encoding = results.results?.encoding_check;
    const histKeys = Object.keys(chartData?.histograms || {});
    const barKeys = Object.keys(chartData?.bar_charts || {});
    const boxKeys = Object.keys(chartData?.box_plots || {});
    const quality = advanced?.data_quality_checks;
    const numStats = advanced?.descriptive_statistics?.numerical_statistics || {};
    const catStats = advanced?.descriptive_statistics?.categorical_statistics || {};

    return (
        <div className={Style.container}>
            <div className={Style.tabs}>
                {([
                    ["summary", "Summary"],
                    ["charts", "Charts"],
                    ["correlation", "Correlation"],
                    ["quality", "Quality"],
                    ["target", "Target"],
                ] as const).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        className={Style.tab}
                        onClick={() => setTab(id)}
                    >
                        <span className={"z-10 relative"} style={tab===id ? {color:"var(--card-background)"}:{}}>{label}</span>
                        {
                            tab === id &&
                            <motion.div
                                layoutId={"active Pill"}
                                transition={{
                                    type:"spring",
                                    stiffness: 300,
                                    damping: 30,
                                    duration: 0.15,
                                }}
                                className={Style.tabActive}>

                            </motion.div>
                        }
                    </button>
                ))}
            </div>

            {loading && <div className={Style.statusLine}>Loading analysis…</div>}
            {error && <div className={Style.errorLine}>{error}</div>}

            {tab === "summary" && (
                <div className={Style.summaryStack}>
                    <div className={"w-full"}>
                        <h1>Summary</h1>
                        <div className={Style.summaryLayout}>
                            <div className={`${Style.card} ${Style.metaCard}`}>
                                <div className={Style.metaRow}>
                                    <span className={Style.metaLabel}>File</span>
                                    <span className={Style.metaValue}>{currentProject?.projectData.csvFile ?? "—"}</span>
                                </div>
                                <div className={Style.metaRow}>
                                    <span className={Style.metaLabel}>Columns</span>
                                    <span className={Style.metaValue}>{results.summary?.columns}</span>
                                </div>
                                <div className={Style.metaRow}>
                                    <span className={Style.metaLabel}>Rows</span>
                                    <span className={Style.metaValue}>{results.summary?.rows}</span>
                                </div>
                            </div>

                            <div className={Style.columnsPanel}>
                                <h2 className={Style.sectionTitle}>Columns</h2>
                                <div className={Style.cardGrid}>
                                    <div className={`${Style.card} ${Style.spanAll}`}>
                                        <h2>Numerical</h2>
                                        <div className={Style.listPlain}>
                                            {results.results?.numerical_columns?.length > 0
                                                ? results.results.numerical_columns.map((column: string, index: number) => (
                                                    <div key={index}>{column}</div>
                                                ))
                                                : <div>No numerical columns</div>}
                                        </div>
                                    </div>
                                    <div className={`${Style.card} ${Style.spanAll}`}>
                                        <h2>Categorical</h2>
                                        <div className={Style.listPlain}>
                                            {results.results?.categorical_columns?.length > 0
                                                ? results.results.categorical_columns.map((column: string, index: number) => (
                                                    <div key={index}>{column}</div>
                                                ))
                                                : <div>No categorical columns</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {encoding && (
                                <div className={Style.encodingPanel}>
                                    <h2 className={Style.sectionTitle}>Encoding</h2>
                                    <div className={Style.cardGrid}>
                                        <div className={`${Style.card} ${Style.spanAll}`}>
                                            <span>
                                                OneHot encoding:{" "}
                                                <span style={{
                                                    color: encoding.overall_recommendation === "Safe"
                                                        ? "var(--success)"
                                                        : encoding.overall_recommendation?.includes("caution") || encoding.overall_recommendation === "Caution"
                                                            ? "var(--warning)"
                                                            : "var(--error)",
                                                }}>
                                                    {encoding.overall_recommendation}
                                                </span>
                                            </span>
                                            <span>
                                                Memory estimation: {encoding.memory_estimate?.estimated_memory_mb}mb
                                                (initial: {encoding.memory_estimate?.current_memory_mb}mb, increase of{" "}
                                                {encoding.memory_estimate?.memoryIncreaseFactor}x)
                                            </span>
                                            <span>Estimated new columns: {encoding.columns_estimate?.new_columns_added}</span>
                                        </div>
                                        <div className={Style.card}>
                                            <h2 style={{color: "var(--warning)"}}>Warnings</h2>
                                            <div className={Style.listPlain}>
                                                {encoding.warnings?.length > 0
                                                    ? encoding.warnings.map((warning: string, index: number) => (
                                                        <div key={index}>{warning}</div>
                                                    ))
                                                    : <div>No warnings</div>}
                                            </div>
                                        </div>
                                        <div className={Style.card}>
                                            <h2 style={{color: "var(--success)"}}>Recommendations</h2>
                                            <div className={Style.listPlain}>
                                                {encoding.recommendations?.length > 0
                                                    ? encoding.recommendations.map((recommendation: string, index: number) => (
                                                        <div key={index}>{recommendation}</div>
                                                    ))
                                                    : <div>No recommendations</div>}
                                            </div>
                                        </div>
                                        <div className={`${Style.card} ${Style.spanAll}`}>
                                            <h2>High cardinality</h2>
                                            <div className={Style.listPlain}>
                                                {encoding.high_cardinality_columns?.length > 0
                                                    ? encoding.high_cardinality_columns.map((column: {column?: string; unique_count?: number; severity?: string} | string, index: number) => (
                                                        <div key={index}>
                                                            {typeof column === "string"
                                                                ? column
                                                                : `${column.column} (${column.unique_count} unique · ${column.severity})`}
                                                        </div>
                                                    ))
                                                    : <div>No high cardinality columns</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {Object.keys(numStats).length > 0 && (
                        <div>
                            <h2 className={Style.sectionTitle}>Descriptive statistics</h2>
                            <div className={Style.statsGrid}>
                                {Object.entries(numStats).slice(0, 8).map(([col, stats]) => (
                                    <div key={col} className={Style.card}>
                                        <h2>{col}</h2>
                                        <div className={Style.statGrid}>
                                            {(["mean", "median", "std", "min", "max", "skewness"] as const).map(k => (
                                                <div key={k} className={Style.statItem}>
                                                    <span className={Style.statLabel}>{k}</span>
                                                    <span>{typeof stats[k] === "number" ? (stats[k] as number).toPrecision(4) : "—"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "charts" && (
                <div className={Style.tabContainer}>
                    <h1>Distributions</h1>
                    {!chartData && !loading && <div className={Style.emptyChart}>Chart data unavailable — ensure a CSV is loaded on the agent.</div>}

                    {histKeys.length > 0 && (
                        <div className={Style.chartSection}>
                            <div className={Style.chartHeader}>
                                <h2 className={"w-full"}>Histograms</h2>
                                <Dropdown defaultValue={histKeys[0]} onChange={e => setHistCol(e)} options={histKeys}>
                                </Dropdown>
                            </div>
                            {chartData?.histograms[histCol] && <HistogramChart data={chartData.histograms[histCol]} />}
                        </div>
                    )}

                    {barKeys.length > 0 && (
                        <div className={Style.chartSection}>
                            <div className={Style.chartHeader}>
                                <h2 className={"w-full"}>Category frequencies</h2>
                                <Dropdown  defaultValue={barCol[0]} onChange={e => setBarCol(e)} options={barKeys}>

                                </Dropdown>
                            </div>
                            {chartData?.bar_charts[barCol] && <CategoryBarChart data={chartData.bar_charts[barCol]} />}
                        </div>
                    )}

                    {boxKeys.length > 0 && (
                        <div className={Style.chartSection}>
                            <div className={Style.chartHeader}>
                                <h2 className={"w-full"}>Box plots</h2>
                                <Dropdown defaultValue={boxCol} onChange={e => setBoxCol(e)} options={boxKeys}>
                                </Dropdown>
                            </div>
                            {chartData?.box_plots[boxCol] && <BoxPlotChart data={chartData.box_plots[boxCol]} />}
                        </div>
                    )}

                    {(chartData?.scatter_plots?.length ?? 0) > 0 && (
                        <div className={Style.chartSection}>
                            <h2 className={"w-full"}>Top correlated pairs</h2>
                            <div className={Style.chartGrid}>
                                {chartData!.scatter_plots.map((s, i) => (
                                    <ScatterChart key={i} data={s} />
                                ))}
                            </div>
                        </div>
                    )}

                    {chartData?.correlation_heatmap && (
                        <div className={Style.chartSection}>
                            <HeatmapChart data={chartData.correlation_heatmap} />
                        </div>
                    )}
                </div>
            )}

            {tab === "correlation" && (
                <div className={Style.tabContainer}>
                    <h1>Correlation analysis</h1>
                    <div className={Style.section}>
                        <div className={Style.cardWide}>
                            <h2>Numerical (Pearson)</h2>
                            <CorrelationList
                                pairs={correlation?.numerical_correlations?.correlations
                                    ?? advanced?.correlation_analysis?.numerical_correlations?.correlations
                                    ?? []}
                                valueKey="correlation"
                            />
                        </div>
                        <div className={Style.cardWide}>
                            <h2>Categorical (Cramér&apos;s V)</h2>
                            <CorrelationList
                                pairs={correlation?.categorical_associations?.associations
                                    ?? advanced?.correlation_analysis?.categorical_associations?.associations
                                    ?? []}
                                valueKey="association"
                            />
                        </div>
                    </div>
                    {chartData?.correlation_heatmap && (
                        <div className={Style.chartSection}>
                            <HeatmapChart data={chartData.correlation_heatmap} />
                        </div>
                    )}
                </div>
            )}

            {tab === "quality" && (
                <div className={Style.tabContainer}>
                    <h1>Data quality</h1>
                    <div className={Style.section}>
                        <div className={Style.card}>
                            <span>Duplicate rows: {quality?.duplicate_rows ?? "—"}</span>
                            <span>
                                Constant columns:{" "}
                                {quality?.constant_columns?.length
                                    ? quality.constant_columns.join(", ")
                                    : "none"}
                            </span>
                        </div>
                    </div>

                    <div className={Style.section}>
                        <div className={Style.cardWide}>
                            <h2>Issues</h2>
                            <div className={Style.listPlain}>
                                {quality?.issues?.length
                                    ? quality.issues.map((issue, i) => (
                                        <div key={i} className={Style.issueRow} data-severity={issue.severity}>
                                            <span className={Style.issueType}>{issue.type}</span>
                                            <span>{issue.message}</span>
                                            {issue.column && <span className={Style.issueCol}>{issue.column}</span>}
                                        </div>
                                    ))
                                    : <div>No issues detected</div>}
                            </div>
                        </div>
                    </div>

                    {quality?.outlier_summary && Object.keys(quality.outlier_summary).length > 0 && (
                        <>
                            <h1>Outliers</h1>
                            <div className={Style.statsGrid}>
                                {Object.entries(quality.outlier_summary).map(([col, info]) => (
                                    <div key={col} className={Style.card}>
                                        <h2>{col}</h2>
                                        <span>{info.count} outliers ({info.percentage}%)</span>
                                        <span className={Style.chartMeta}>
                                            bounds [{info.lower_bound.toPrecision(4)}, {info.upper_bound.toPrecision(4)}]
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {Object.keys(catStats).length > 0 && (
                        <>
                            <h1>Categorical overview</h1>
                            <div className={Style.statsGrid}>
                                {Object.entries(catStats).slice(0, 8).map(([col, stats]) => (
                                    <div key={col} className={Style.card}>
                                        <h2>{col}</h2>
                                        <span>Unique: {String(stats.unique ?? "—")}</span>
                                        <span>Most frequent: {String(stats.most_frequent ?? "—")} ({String(stats.most_frequent_count ?? "—")})</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {tab === "target" && (
                <div className={Style.tabContainer}>
                    <h1>Target analysis</h1>
                    <div className={Style.targetRow}>
                        <Dropdown
                            defaultValue={allColumns[0]}
                            onChange={e => setTargetColumn(e)}
                            options={allColumns}
                        >
                        </Dropdown>
                        <button type="button" className={Style.actionButton} onClick={runTargetAnalysis} disabled={!targetColumn || loading}>
                            Analyze target
                        </button>
                    </div>

                    {target?.error && <div className={Style.errorLine}>{target.error}</div>}

                    {target && !target.error && (
                        <div className={Style.section}>
                            <div className={Style.card}>
                                <span>Column: {target.column_name}</span>
                                <span>Type: {target.type}</span>
                                <span>Missing: {target.missing_count} ({target.missing_percentage}%)</span>
                                {target.outlier_percentage != null && (
                                    <span>Outliers: {target.outlier_percentage}%</span>
                                )}
                            </div>

                            {target.statistics && (
                                <div className={Style.card}>
                                    <h2>Statistics</h2>
                                    <div className={Style.statGrid}>
                                        {Object.entries(target.statistics).map(([k, v]) => (
                                            <div key={k} className={Style.statItem}>
                                                <span className={Style.statLabel}>{k}</span>
                                                <span>{typeof v === "number" ? v.toPrecision(4) : String(v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {target.distribution?.histogram && (
                                <HistogramChart
                                    data={{
                                        bins: target.distribution.histogram.bin_edges,
                                        counts: target.distribution.histogram.counts,
                                        column_name: target.column_name || targetColumn,
                                    }}
                                />
                            )}

                            {target.class_distribution && (
                                <CategoryBarChart
                                    data={{
                                        categories: target.class_distribution.classes,
                                        values: target.class_distribution.counts,
                                        column_name: target.column_name || targetColumn,
                                    }}
                                />
                            )}

                            {target.imbalance_analysis && (
                                <div className={Style.card}>
                                    <h2>Class imbalance</h2>
                                    <span>Classes: {target.imbalance_analysis.num_classes}</span>
                                    <span>Ratio: {target.imbalance_analysis.imbalance_ratio}</span>
                                    <span style={{color: target.imbalance_analysis.is_imbalanced ? "var(--warning)" : "var(--success)"}}>
                                        {target.imbalance_analysis.is_imbalanced ? "Imbalanced" : "Balanced"}
                                    </span>
                                </div>
                            )}

                            {(target.preprocessing_suggestions?.length ?? 0) > 0 && (
                                <div className={Style.card}>
                                    <h2 style={{color: "var(--success)"}}>Suggestions</h2>
                                    <div className={Style.listPlain}>
                                        {target.preprocessing_suggestions!.map((s, i) => (
                                            <div key={i}>{s}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
