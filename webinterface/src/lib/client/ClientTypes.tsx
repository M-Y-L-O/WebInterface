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
    progress: number;
    timestamp: number;
}

export enum EndPoints{
    health = "/",
    initialize = "/initialize",
    optimize = "/optimizeModel",
    optimizeStatus = "/optimizationStatus",
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

    // Model editor (descriptor-driven)
    getModelDescriptor = "/getModelDescriptor",
    validateModelDescriptor = "/validateModelDescriptor",
    editModel = "/editModel",
    saveModelDescriptor = "/saveModelDescriptor",
    visualizeModel = "/visualizeModel",
    expandModelNodes = "/expandModelNodes",
    collapseModelNodes = "/collapseModelNodes",
    getModelEditorCatalog = "/getModelEditorCatalog",

}

