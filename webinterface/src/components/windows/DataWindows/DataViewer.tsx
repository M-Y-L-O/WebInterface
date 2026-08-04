"use client";

import DataTable from "@/components/functional/DataTable";
import {useProjectStore} from "@/lib/store";

export default function DataViewer() {
    const results = useProjectStore(state => state.csv);
    if (!results) {
        return <div>No data loaded</div>;
    }
    return (
        <div className={"w-full h-full overflow-auto p-[1rem]"}>
            <DataTable results={results}/>
        </div>
    )
}
