import {useState} from "react";
import Style from "./DataTable.module.css"

export default function DataTable(results:any){
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(18);
    results = results.results;
    console.log(results);

    if(results === null || Object.keys(results).length === 0)
        return <div>
            <h1>No results</h1>
        </div>

    let src = results.data;
    let data:Map<string, Array<any>> = new Map();

    for(let i = 0; i < src.length; i++){
        for(let key in src[i]){
            const value = src[i][key];
            data.has(key) ? data.get(key)?.push(value) : data.set(key, [value]);
        }
    }

    const maxRows = Math.max(...[...data.values()].map(arr => arr.length));

    const totalpages = Math.ceil(maxRows / rowsPerPage);

    const currentRows = [...Array(rowsPerPage)].map((_, rowIndex) => rowIndex + (currentPage - 1) * rowsPerPage < maxRows ? rowIndex + (currentPage - 1) * rowsPerPage : -1);

    const isNumeric = (key: string) => {
        const dtype = results.summary.dtypes[key];
        return dtype?.includes("float") || dtype?.includes("int");
    };

    return (<div>
        <div className={Style.controlsContainer}>
            <div className={Style.controls}>
                <button onClick={()=>{
                    setCurrentPage(1)
                }}
                disabled={currentPage === 1}>
                    <i className={"fa-solid fa-left-to-line"}/>
                </button>
                <button onClick={()=>{
                    setCurrentPage((prev)=> Math.max(prev-1, 1))
                }} disabled={currentPage === 1}>
                    <i className={"fa-solid fa-left"}/>
                </button>
                <span className={"text-[var(--light-highlight)]"}>
                    Page {currentPage} of {totalpages}
                </span>
                <button onClick={()=>{
                    setCurrentPage((prev)=> Math.min(prev+1, totalpages))
                }} disabled={currentPage === totalpages}>
                    <i className={"fa-solid fa-right"}/>
                </button>
                <button onClick={()=>{setCurrentPage(totalpages)}}
                disabled={currentPage === totalpages}>
                    <i className={"fa-solid fa-right-to-line"}/>
                </button>
            </div>
            <div className={Style.controls}>
                <span className={"text-[var(--light-highlight)]"}>Rows/page:</span>
                <input type={"number"} value={rowsPerPage} onChange={(e)=>{
                    if(e.target.value === "") return;
                    setRowsPerPage(Math.max(1,parseInt(e.target.value)))}}
                />
            </div>
        </div>
        <table className={Style.table}>
            <thead className={Style.headerRow}>
            <tr>
                {[...data.keys()].map((key, index) => (
                    <th key={index} className={isNumeric(key) ? Style.numeric : undefined}>
                        <span className={Style.headerLabel}>{key}</span>
                        <span className={"text-[var(--light-highlight)] text-xs"}>({results.summary.dtypes[key]})</span>
                    </th>
                ))}
            </tr>
            </thead>
            <tbody>
            {
                currentRows.map((rowIndex, rowIndexInPage) => {
                    if(rowIndex === -1) return null;
                    return (
                        <tr key={rowIndexInPage}>
                            {[...data.entries()].map(([key, arr], index) => (
                                <td key={index} className={isNumeric(key) ? Style.numeric : ""}>
                                    {arr[rowIndex] ?? '-'}
                                </td>
                            ))}
                        </tr>
                    )
                })
            }
            </tbody>
        </table>
    </div>)
}