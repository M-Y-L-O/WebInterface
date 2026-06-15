'use client';

export enum ClientType {
    LOCAL = 'LOCAL',
    CLOUD = 'CLOUD'
}

export interface ClientConfig {
    type: ClientType;
    localId?: number;
    name: string;
    address?: string;
    port?: number;
    workPath?: string;
    cloudEndpoint?: string; // For cloud, provide the managed API endpoint
    apiKey: string;
}

export interface OptimizationTask {
    modelPath: string;
    csvPath: string;
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
    optimize = "/optimize",
    optimizeStatus = "/optimize-status",
    downloadOptimized = "/download-optimized",
    uploadModel = "/Loadmodel",
    uploadCSV = "/upload-csv",
    referenceModel = "/loadModel",
    referenceCSV = "/loadCSV",

}

