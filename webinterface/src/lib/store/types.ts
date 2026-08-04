import type {
    ClientConfig,
    ModelDiagnosticsReport,
    OptimizationReport,
    ProgressUpdate,
} from "@/lib/client/ClientTypes";
import type { SerializedDockview } from "dockview-core";

export type ConnectionStatus = "offline" | "connecting" | "connected";

export type ConnectionResultStatus =
    | "connected"
    | "needs_init"
    | "timed_out"
    | "error";

export type ConnectionResult = {
    ok: boolean;
    status: ConnectionResultStatus;
    error?: string;
    raw?: unknown;
};

export type OptimizationRunState = {
    result: OptimizationReport | null;
    report: OptimizationReport | null;
    updates: ProgressUpdate[];
    runError: string | null;
    completedAt: number | null;
};

export type DiagnosticsRunState = {
    result: ModelDiagnosticsReport | null;
    report: ModelDiagnosticsReport | null;
    runError: string | null;
    completedAt: number | null;
};

export type PersistedClientState = {
    config: ClientConfig | null;
};

/** Keys for per-model-slot visualisation cache in the project store. */
export type VisualisationSlotKey =
    | "uploadedPt2"
    | "uploadedOnnx"
    | "optimizedPt2"
    | "optimizedOnnx";

export type ProjectVisualisations = Record<VisualisationSlotKey, unknown | null>;

export type PersistedProjectState = {
    project: unknown | null;
    csv: unknown | null;
    visualisations: ProjectVisualisations;
    optimizationRun: OptimizationRunState | null;
    diagnosticsRun: DiagnosticsRunState | null;
};

export type DockLayoutJson = SerializedDockview;

export type PersistedWorkspaceState = {
    layoutsByProjectId: Record<string, DockLayoutJson>;
};
