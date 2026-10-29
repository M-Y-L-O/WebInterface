"use client";

import DataTable from "@/components/functional/DataTable";
import {useProjectStore} from "@/lib/store";
import Style from "./Data.module.css"

export default function DataViewer() {
    const results = useProjectStore(state => state.csv);
    console.log(results);
    if (!results || Object.keys(results).length === 0) {
        return <div className={Style.errorLine}>No data loaded</div>;
    }
    return (
        <div className={"w-full h-full overflow-auto"}>
            <DataTable results={results}/>
        </div>
    )
}
