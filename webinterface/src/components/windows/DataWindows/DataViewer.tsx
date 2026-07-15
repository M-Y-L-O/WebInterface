import DataTable from "@/components/functional/DataTable";

export default function DataViewer() {
    const stored = sessionStorage.getItem("csv");
    if(stored === null || stored === "null" || stored === "undefined" || stored === "{}")
        return <div>No data loaded</div>;
    const results = JSON.parse(stored);
    return (
        <div className={"w-full h-full overflow-auto"}>
            <DataTable results={results}/>
        </div>
    )
}