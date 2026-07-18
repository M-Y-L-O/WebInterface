"use client";

import type {
    BarChartData,
    BoxPlotData,
    CorrelationHeatmapData,
    HistogramChartData,
    ScatterPlotData,
} from "@/lib/client/ClientTypes";
import Style from "./Data.module.css";

function corrColor(value: number): string {
    const t = Math.max(-1, Math.min(1, value));
    if (t >= 0) {
        return `rgba(253, 133, 29, ${0.15 + t * 0.85})`;
    }
    return `rgba(90, 140, 220, ${0.15 + Math.abs(t) * 0.85})`;
}

export function HistogramChart({data}: {data: HistogramChartData}) {
    const counts = data.counts;
    if (!counts.length) return <div className={Style.emptyChart}>No histogram data</div>;

    const max = Math.max(...counts, 1);
    const w = 320;
    const h = 120;
    const pad = {top: 8, right: 8, bottom: 22, left: 28};
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;
    const gap = 1;
    const barW = Math.max(2, (innerW - gap * (counts.length - 1)) / counts.length);
    const binMin = data.bins[0];
    const binMax = data.bins[data.bins.length - 1];

    return (
        <div className={Style.chartBlock}>
            <div className={Style.chartTitle}>{data.column_name}</div>
            <svg className={Style.chartSvg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Histogram of ${data.column_name}`}>
                {counts.map((c, i) => {
                    const barH = (c / max) * innerH;
                    const x = pad.left + i * (barW + gap);
                    const y = pad.top + innerH - barH;
                    return (
                        <rect
                            key={i}
                            x={x}
                            y={y}
                            width={barW}
                            height={Math.max(barH, c > 0 ? 1 : 0)}
                            className={Style.barFill}
                        >
                            <title>{`${data.bins[i]?.toFixed?.(2) ?? data.bins[i]} – ${data.bins[i + 1]?.toFixed?.(2) ?? data.bins[i + 1]}: ${c}`}</title>
                        </rect>
                    );
                })}
                <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} className={Style.axisLine} />
                <text x={pad.left} y={h - 4} className={Style.axisLabel}>{Number(binMin).toPrecision(3)}</text>
                <text x={pad.left + innerW} y={h - 4} textAnchor="end" className={Style.axisLabel}>{Number(binMax).toPrecision(3)}</text>
                <text x={4} y={pad.top + 8} className={Style.axisLabel}>{max}</text>
            </svg>
        </div>
    );
}

export function CategoryBarChart({data}: {data: BarChartData}) {
    const values = data.values;
    if (!values.length) return <div className={Style.emptyChart}>No category data</div>;

    const max = Math.max(...values, 1);
    const rowH = 18;
    const labelW = 80;
    const barArea = 200;
    const h = Math.max(60, values.length * rowH + 8);
    const w = labelW + barArea + 40;

    return (
        <div className={Style.chartBlock}>
            <div className={Style.chartTitle}>{data.column_name}</div>
            <svg className={Style.chartSvg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Bar chart of ${data.column_name}`}>
                {values.map((v, i) => {
                    const y = 4 + i * rowH;
                    const barW = (v / max) * barArea;
                    const label = data.categories[i] ?? "";
                    const short = label.length > 12 ? label.slice(0, 11) + "…" : label;
                    return (
                        <g key={i}>
                            <text x={labelW - 6} y={y + 12} textAnchor="end" className={Style.axisLabel}>{short}</text>
                            <rect x={labelW} y={y + 3} width={Math.max(barW, v > 0 ? 2 : 0)} height={12} className={Style.barFill} rx={2}>
                                <title>{`${label}: ${v}`}</title>
                            </rect>
                            <text x={labelW + barW + 4} y={y + 12} className={Style.axisLabel}>{v}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

export function BoxPlotChart({data}: {data: BoxPlotData}) {
    const vals = [data.min, data.q1, data.median, data.q3, data.max, ...data.outliers];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const range = hi - lo || 1;
    const w = 320;
    const h = 64;
    const padX = 24;
    const midY = 28;
    const scale = (v: number) => padX + ((v - lo) / range) * (w - padX * 2);

    const xMin = scale(data.min);
    const xQ1 = scale(data.q1);
    const xMed = scale(data.median);
    const xQ3 = scale(data.q3);
    const xMax = scale(data.max);

    return (
        <div className={Style.chartBlock}>
            <div className={Style.chartTitle}>{data.column_name}</div>
            <svg className={Style.chartSvg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Box plot of ${data.column_name}`}>
                <line x1={xMin} y1={midY} x2={xMax} y2={midY} className={Style.boxWhisker} />
                <line x1={xMin} y1={midY - 8} x2={xMin} y2={midY + 8} className={Style.boxWhisker} />
                <line x1={xMax} y1={midY - 8} x2={xMax} y2={midY + 8} className={Style.boxWhisker} />
                <rect x={xQ1} y={midY - 14} width={Math.max(xQ3 - xQ1, 1)} height={28} className={Style.boxBody} rx={2} />
                <line x1={xMed} y1={midY - 14} x2={xMed} y2={midY + 14} className={Style.boxMedian} />
                {data.outliers.slice(0, 30).map((o, i) => (
                    <circle key={i} cx={scale(o)} cy={midY} r={2.5} className={Style.outlierDot}>
                        <title>{o}</title>
                    </circle>
                ))}
                <text x={padX} y={h - 6} className={Style.axisLabel}>{lo.toPrecision(3)}</text>
                <text x={w - padX} y={h - 6} textAnchor="end" className={Style.axisLabel}>{hi.toPrecision(3)}</text>
            </svg>
            <div className={Style.chartMeta}>
                Q1 {data.q1.toPrecision(4)} · median {data.median.toPrecision(4)} · Q3 {data.q3.toPrecision(4)}
                {data.outliers.length > 0 ? ` · ${data.outliers.length} outliers` : ""}
            </div>
        </div>
    );
}

export function ScatterChart({data}: {data: ScatterPlotData}) {
    const points = data.points;
    if (!points.length) return <div className={Style.emptyChart}>No scatter data</div>;

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const w = 280;
    const h = 180;
    const pad = {top: 10, right: 10, bottom: 28, left: 36};
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;

    return (
        <div className={Style.chartBlock}>
            <div className={Style.chartTitle}>
                {data.x_column} vs {data.y_column}
                <span className={Style.corrBadge} data-strength={Math.abs(data.correlation) >= 0.7 ? "strong" : Math.abs(data.correlation) >= 0.4 ? "moderate" : "weak"}>
                    r={data.correlation.toFixed(2)}
                </span>
            </div>
            <svg className={Style.chartSvg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Scatter ${data.x_column} vs ${data.y_column}`}>
                <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} className={Style.axisLine} />
                <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} className={Style.axisLine} />
                {points.map((p, i) => {
                    const cx = pad.left + ((p.x - xMin) / xRange) * innerW;
                    const cy = pad.top + innerH - ((p.y - yMin) / yRange) * innerH;
                    return <circle key={i} cx={cx} cy={cy} r={2.2} className={Style.scatterDot} />;
                })}
                <text x={pad.left + innerW / 2} y={h - 4} textAnchor="middle" className={Style.axisLabel}>{data.x_column}</text>
                <text
                    x={12}
                    y={pad.top + innerH / 2}
                    textAnchor="middle"
                    className={Style.axisLabel}
                    transform={`rotate(-90 12 ${pad.top + innerH / 2})`}
                >
                    {data.y_column}
                </text>
            </svg>
        </div>
    );
}

export function HeatmapChart({data}: {data: CorrelationHeatmapData}) {
    const cols = data.columns;
    const n = cols.length;
    if (n < 2 || !data.matrix?.length) return <div className={Style.emptyChart}>Not enough numeric columns for heatmap</div>;

    const cell = Math.max(18, Math.min(36, Math.floor(360 / n)));
    const labelW = Math.min(90, Math.max(...cols.map(c => c.length)) * 6 + 8);
    const w = labelW + n * cell + 8;
    const h = labelW + n * cell + 8;

    return (
        <div className={Style.chartBlockWide}>
            <div className={Style.chartTitle}>Correlation heatmap</div>
            <svg className={Style.chartSvg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Correlation heatmap">
                {cols.map((col, i) => (
                    <text
                        key={`yl-${col}`}
                        x={labelW - 4}
                        y={labelW + i * cell + cell * 0.65}
                        textAnchor="end"
                        className={Style.axisLabel}
                    >
                        {col.length > 14 ? col.slice(0, 13) + "…" : col}
                    </text>
                ))}
                {cols.map((col, i) => (
                    <text
                        key={`xl-${col}`}
                        x={labelW + i * cell + cell / 2}
                        y={labelW - 6}
                        textAnchor="start"
                        className={Style.axisLabel}
                        transform={`rotate(-45 ${labelW + i * cell + cell / 2} ${labelW - 6})`}
                    >
                        {col.length > 14 ? col.slice(0, 13) + "…" : col}
                    </text>
                ))}
                {data.matrix.map((row, i) =>
                    row.map((val, j) => {
                        const v = typeof val === "number" && Number.isFinite(val) ? val : 0;
                        return (
                            <rect
                                key={`${i}-${j}`}
                                x={labelW + j * cell}
                                y={labelW + i * cell}
                                width={cell - 1}
                                height={cell - 1}
                                fill={corrColor(v)}
                                rx={2}
                            >
                                <title>{`${cols[i]} × ${cols[j]}: ${v.toFixed(3)}`}</title>
                            </rect>
                        );
                    })
                )}
            </svg>
            <div className={Style.heatmapLegend}>
                <span>−1</span>
                <div className={Style.heatmapGradient} />
                <span>+1</span>
            </div>
        </div>
    );
}
