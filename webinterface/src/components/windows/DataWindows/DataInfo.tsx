import DataTable from "@/components/functional/DataTable";
import Style from "./Data.module.css"

export default function DataInfo() {
    const stored = sessionStorage.getItem("csv")!;
    if(!stored || stored === "{}" || stored === "null" || stored === "undefined")
        return <div>No data loaded</div>;

    const results = JSON.parse(stored);
    const currentProject  = JSON.parse(sessionStorage.getItem("loadedProject")!);
    console.log(currentProject);
    return (
        <div className={Style.container}>
            <h1>Summary:</h1>
            <div className={Style.section}>
                <div className={Style.card}>
                        <span>File: {currentProject.csvFile}</span>
                        <span>Columns: {results.summary.columns}</span>
                        <span>Rows: {results.summary.rows}</span>
                </div>
                <div className={Style.section}>
                    <div className={Style.card}>
                        <h2>Numerical Columns:</h2>
                        <div className={Style.list}>
                            {results.results.numerical_columns.length > 0 ? results.results.numerical_columns.map((column:string, index:number)=><div key={index}>{column}</div>) : <div>No numerical columns</div>}
                        </div>
                    </div>
                    <div className={Style.card}>
                        <h2>Categorical Columns:</h2>
                        <div className={Style.list}>
                            {results.results.categorical_columns.length > 0 ? results.results.categorical_columns.map((column:string, index:number)=><div key={index}>{column}</div>) : <div>No categorical columns</div>}
                        </div>
                    </div>
                </div>
            </div>
            <h1>Encoding:</h1>
            <div className={Style.section}>
                <div className={Style.card}>
                    <span>OneHot encoding: <span style={{color: results.results.encoding_check.overall_recommendation==="Safe" ? "var(--success)" :  results.results.encoding_check.overall_recommendation==="Caution" ? "var(--warning)" : "var(--error)"}}>{results.results.encoding_check.overall_recommendation}</span></span>
                    <span>Memory estimation: {results.results.encoding_check.memory_estimate.estimated_memory_mb}mb (initial: {results.results.encoding_check.memory_estimate.current_memory_mb}mb, increase of {results.results.encoding_check.memory_estimate.memoryIncreaseFactor}x)</span>
                    <span>Estimated new columns: {results.results.encoding_check.columns_estimate.new_columns_added}</span>
                </div>
                    <div className={Style.card}>
                        <h2 style={{color:"var(--warning)"}}>Warnings:</h2>
                        <div className={Style.list}>
                            {results.results.encoding_check.warnings.length > 0 ? results.results.encoding_check.warnings.map((warning:string, index:number)=><div key={index}>{warning}</div>) : <div>No warnings</div>}
                        </div>
                    </div>
                    <div className={Style.card}>
                        <h2 style={{color: "var(--success)"}}>Recommendations:</h2>
                        <div className={Style.list}>
                            {results.results.encoding_check.recommendations.length > 0 ? results.results.encoding_check.recommendations.map((recommendation:string, index:number)=><div key={index}>{recommendation}</div>) : <div>No recommendations</div>}
                        </div>
                    </div>
                    <div className={Style.card}>
                        <h2>High cardinality columns:</h2>
                        <div className={Style.list}>
                            {results.results.encoding_check.high_cardinality_columns.length > 0 ? results.results.encoding_check.high_cardinality_columns.map((column:string, index:number)=><div key={index}>{column}</div>) : <div>No high cardinality columns</div>}
                        </div>
                    </div>
            </div>

        </div>)
}