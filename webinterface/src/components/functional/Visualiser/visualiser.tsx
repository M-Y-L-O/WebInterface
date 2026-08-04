"use client"
import { useEffect, useState } from "react";
import { IDockviewPanelProps } from "dockview-core";
import VisualiserCore from "./VisualiserCore";
import { useInspectablePanel } from "@/lib/windows/useInspectablePanel";

export default function Visualiser(props: IDockviewPanelProps) {
    const { setSelected, setVisualisation } = useInspectablePanel(props.api);

    const panelParams = (props as any).params || {};
    const providedVisualisation = panelParams.visualisation || panelParams.modelData || panelParams.data;
    const modelRevision = panelParams.modelRevision;

    const [paramVisualisation, setParamVisualisation] = useState<any>(providedVisualisation);
    const [paramRevision, setParamRevision] = useState<number | undefined>(modelRevision);

    useEffect(() => {
        setParamVisualisation(providedVisualisation);
        setParamRevision(modelRevision);
    }, [providedVisualisation, modelRevision]);

    useEffect(() => {
        const disposable = props.api.onDidParametersChange((parameters: any) => {
            const next = parameters?.visualisation || parameters?.modelData || parameters?.data;
            if (next !== undefined) setParamVisualisation(next);
            if (parameters?.modelRevision !== undefined) setParamRevision(parameters.modelRevision);
        });
        return () => disposable.dispose();
    }, [props.api]);

    useEffect(() => {
        setVisualisation(paramVisualisation);
    }, [paramVisualisation, setVisualisation]);

    return (
        <VisualiserCore
            visualisation={paramVisualisation}
            modelRevision={paramRevision}
            interactive={true}
            onNodeSelect={(node) => setSelected(node)}
            onEdgeSelect={(edge) => setSelected(edge)}
        />
    );
}