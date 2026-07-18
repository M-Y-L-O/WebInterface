'use client';

export enum ClientType {
    LOCAL = 'LOCAL',
    CLOUD = 'CLOUD'
}

export interface ClientConfig {
    type: ClientType;
    name: string;
    address: string;
    cloudEndpoint?: string; // For cloud, provide the managed API endpoint
    apiKey: string;
    dbId?:string;
}

export interface OptimizationRequest {
    inputFeatures: string[];
    targetFeature: string;
    problemType:string;
    epochs: number;
    strategy: string | 'neat' | 'genetic' | 'brute-force'|'neuroevolution';
    encoding: string | 'none'| 'label' | 'onehot';
    generations?: number;
}

export interface OptimizationTask {
    inputFeatures: string[];
    targetFeature: string;
    maxEpochs: number;
    strategy: 'neat' | 'genetic' | 'brute-force';
    encoding: 'label' | 'onehot';
    status: 'idle' | 'uploading' | 'optimizing' | 'downloading' | 'completed' | 'error';
    progress: number;
    currentMessage: string;
    error?: string;
    results?: {
        modelBase64?: string;
        modelUrl?: string;
        metadata?: Record<string, unknown>;
    };
    startTime?: number;
    endTime?: number;
}

export interface ProgressUpdate {
    status: string;
    progress?: number;
    timestamp?: number;
    type?: string;
    phase?: string;
    generation?: number;
    error?: boolean;
    [key: string]: unknown;
}

export interface OptimizationImprovement {
    val_loss_before?: number | null;
    val_loss_after?: number | null;
    val_loss_change_pct?: number | null;
    param_count_before?: number | null;
    param_count_after?: number | null;
    param_count_change_pct?: number | null;
    size_mb_before?: number | null;
    size_mb_after?: number | null;
    latency_ms_per_sample_before?: number | null;
    latency_ms_per_sample_after?: number | null;
    latency_change_pct?: number | null;
    accuracy_before?: number | null;
    accuracy_after?: number | null;
    accuracy_change_pp?: number | null;
    r2_before?: number | null;
    r2_after?: number | null;
    verdict?: "improved" | "regressed" | "unchanged" | "unknown" | string;
}

export interface ArchitectureDiffCounts {
    nodes_added?: number;
    nodes_removed?: number;
    nodes_changed?: number;
    edges_added?: number;
    edges_removed?: number;
}

export interface ArchitectureDiff {
    nodes_added?: Array<{ id?: string; type?: string; params?: Record<string, unknown> }>;
    nodes_removed?: Array<{ id?: string; type?: string; params?: Record<string, unknown> }>;
    nodes_changed?: Array<{
        id?: string;
        before?: { type?: string; params?: Record<string, unknown> };
        after?: { type?: string; params?: Record<string, unknown> };
    }>;
    edges_added?: Array<{ source?: string; target?: string }>;
    edges_removed?: Array<{ source?: string; target?: string }>;
    counts?: ArchitectureDiffCounts;
}

export interface ChampionLineageEntry {
    individual_id?: number;
    generation?: number;
    mutations?: string[];
}

export interface TrainingHistory {
    train_loss_history?: Array<number | string | null>;
    val_loss_history?: Array<number | string | null>;
    epochs_trained?: number;
    early_stopped?: boolean;
}

export interface MutationEvent {
    op?: string;
    node?: string;
    node_type?: string;
    detail?: string;
    generation?: number;
    individual_id?: number;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
}

export interface OptimizationSummary {
    strategy_used?: string;
    requested_strategy?: string;
    input_features?: string[];
    output_features?: string | string[];
    generations?: number;
    population_size?: number;
    best_train_loss?: number | null;
    best_val_loss?: number | null;
    best_score?: number | null;
    val_loss_change_pct?: number | null;
    verdict?: string;
    total_mutation_successes?: number;
    overall_mutation_success_rate?: string;
    stagnation_events?: number;
    elapsed_seconds?: number | null;
    [key: string]: unknown;
}

export interface OptimizationReport {
    status?: string;
    error?: string;
    model_path?: string;
    model_onnx_path?: string | null;
    onnx_exported?: boolean;
    summary?: OptimizationSummary;
    improvement?: OptimizationImprovement;
    baseline?: Record<string, unknown>;
    champion?: Record<string, unknown>;
    architecture_diff?: ArchitectureDiff;
    champion_lineage?: ChampionLineageEntry[];
    training_history?: TrainingHistory | null;
    mutation_timeline?: MutationEvent[];
    optimization_diagnostics?: Record<string, unknown>;
    [key: string]: unknown;
}

export enum EndPoints{
    health = "/",
    initialize = "/initialize",
    optimize = "/optimizeModel",
    optimizeStatus = "/optimizationStatus",
    optimizationReport = "/optimizationReport",
    projectFiles = "/projectFiles",
    visualizeProjectFile = "/visualizeProjectFile",
    downloadOptimized = "/download-optimized",
    newProject = "/newProject",
    exportProject="/exportProject",
    getProject = "/getProject",
    loadProject = "/loadProject",
    uploadModel = "/Loadmodel",
    uploadCSV = "/upload-csv",
    referenceModel = "/loadModel",
    referenceCSV = "/loadCSV",

    // CSV analysis
    advancedAnalysis = "/advancedAnalysis",
    correlationAnalysis = "/correlationAnalysis",
    chartData = "/chartData",
    targetAnalysis = "/targetAnalysis",

    // Model editor (descriptor-driven)
    getModelDescriptor = "/getModelDescriptor",
    validateModelDescriptor = "/validateModelDescriptor",
    editModel = "/editModel",
    previewEdit = "/previewEdit",
    saveModelDescriptor = "/saveModelDescriptor",
    visualizeModel = "/visualizeModel",
    expandModelNodes = "/expandModelNodes",
    collapseModelNodes = "/collapseModelNodes",
    checkEdge = "/checkEdge",

    // New editor endpoints (switched to /editor/ prefix in the API)
    getModelEditorCatalog = "/getModelEditorCatalog",   // legacy fallback
    editorCatalog = "/editor/catalog",
    editorTemplates = "/editor/templates",
    editorUndo = "/editor/undo",
    editorRedo = "/editor/redo",

}

export interface HistogramChartData {
    bins: number[];
    counts: number[];
    column_name: string;
}

export interface BarChartData {
    categories: string[];
    values: number[];
    column_name: string;
}

export interface BoxPlotData {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    outliers: number[];
    column_name: string;
}

export interface ScatterPlotData {
    x_column: string;
    y_column: string;
    correlation: number;
    points: Array<{ x: number; y: number }>;
}

export interface CorrelationHeatmapData {
    columns: string[];
    matrix: number[][];
}

export interface ChartDataResponse {
    histograms: Record<string, HistogramChartData>;
    bar_charts: Record<string, BarChartData>;
    box_plots: Record<string, BoxPlotData>;
    scatter_plots: ScatterPlotData[];
    correlation_heatmap: CorrelationHeatmapData | null;
}

export interface CorrelationPair {
    column1: string;
    column2: string;
    correlation?: number;
    association?: number;
    strength: string;
}

export interface CorrelationAnalysisResponse {
    numerical_correlations?: {
        type: string;
        matrix: Record<string, Record<string, number>>;
        correlations: CorrelationPair[];
    };
    categorical_associations?: {
        type: string;
        associations: CorrelationPair[];
    };
}

export interface DataQualityIssue {
    type: string;
    severity: string;
    count?: number;
    percentage?: number;
    column?: string;
    message: string;
}

export interface AdvancedAnalysisResponse {
    descriptive_statistics?: {
        numerical_statistics?: Record<string, Record<string, unknown>>;
        categorical_statistics?: Record<string, Record<string, unknown>>;
    };
    correlation_analysis?: CorrelationAnalysisResponse;
    distribution_analysis?: Record<string, unknown>;
    data_quality_checks?: {
        issues?: DataQualityIssue[];
        warnings?: unknown[];
        info?: unknown[];
        outlier_summary?: Record<string, { count: number; percentage: number; lower_bound: number; upper_bound: number }>;
        duplicate_rows?: number;
        constant_columns?: string[];
    };
}

export interface TargetAnalysisResponse {
    column_name?: string;
    type?: "numerical" | "categorical";
    missing_count?: number;
    missing_percentage?: number;
    statistics?: Record<string, number>;
    distribution?: { histogram?: { counts: number[]; bin_edges: number[] } };
    outlier_percentage?: number;
    class_distribution?: { classes: string[]; counts: number[]; percentages: number[] };
    imbalance_analysis?: {
        num_classes: number;
        minority_class_size: number;
        majority_class_size: number;
        imbalance_ratio: number;
        is_imbalanced: boolean;
    };
    preprocessing_suggestions?: string[];
    error?: string;
}

