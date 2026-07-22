import type {
    ClientConfig,
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

export type PersistedClientState = {
    config: ClientConfig | null;
};

export type PersistedProjectState = {
    project: unknown | null;
    csv: unknown | null;
    visualisation: unknown | null;
    optimizationRun: OptimizationRunState | null;
};

export type DockLayoutJson = SerializedDockview;

export type PersistedWorkspaceState = {
    layoutsByProjectId: Record<string, DockLayoutJson>;
};
