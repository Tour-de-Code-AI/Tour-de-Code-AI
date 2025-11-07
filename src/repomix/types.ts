// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Repomix integration types for CodeTour

export interface RepomixConfig {
    workspaceRoot: string;
    maxFileSize: number;
    includePatterns: string[];
    ignorePatterns: string[];
    removeComments: boolean;
    showLineNumbers: boolean;
    enableSecurityCheck: boolean;
}

export interface RepomixFileInfo {
    path: string;
    content: string;
    language: string;
    lineCount: number;
    size: number;
    tokens?: number;
}

export interface RepomixOutput {
    summary: string;
    directoryStructure: string;
    files: RepomixFileInfo[];
    totalFiles: number;
    totalCharacters: number;
    totalLines: number;
    totalTokens?: number;
}

export interface RepomixResult {
    output: RepomixOutput;
    outputContent: string; // Full XML/Markdown content
    success: boolean;
    error?: string;
}

export type RepomixProgressCallback = (message: string, progress?: number) => void;

