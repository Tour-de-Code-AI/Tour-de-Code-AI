// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { CodeTour, CodeTourStep } from "../store";
import { BatchTourGenerator } from "./batch-generator";
import { RepomixService } from "../repomix";

export interface TourGenerationOptions {
    workspaceRoot: vscode.Uri;
    tourTitle?: string;
    tourDescription?: string;
    focusAreas?: string[];
    maxSteps?: number;
}

export interface GeneratedTourStep {
    title: string;
    file: string;
    line?: number;
    description: string;
    selection?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
}

export class TourGenerator {
    constructor(extensionPath: string) {
        // No TreeSitter needed anymore! Repomix handles everything.
    }

    async generateTour(options: TourGenerationOptions): Promise<CodeTour> {
        console.log("🚀 Starting tour generation...");

        // Show progress
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "AI Tour Generation",
                cancellable: true
            },
            async (progress, token) => {
                try {
                    // Step 1: Generate Repomix summary (in-memory only!)
                    progress.report({ message: "📦 Analyzing codebase with Repomix (1/4)...", increment: 0 });
                    console.log("🚀 Step 1: Generating Repomix codebase summary (NO TreeSitter needed!)...");
                    const repomixService = new RepomixService(options.workspaceRoot.fsPath);
                    const repomixResult = await repomixService.generateSummary((msg, prog) => {
                        progress.report({ message: `📦 Repomix: ${msg}`, increment: prog ? prog / 20 : undefined });
                    });

                    if (!repomixResult.success) {
                        throw new Error(`Repomix analysis failed: ${repomixResult.error}`);
                    }

                    console.log("✓ Repomix analysis complete (NO LLM used for this step!)");
                    console.log(`   Files analyzed: ${repomixResult.output.totalFiles}`);
                    console.log(`   Total lines: ${repomixResult.output.totalLines}`);
                    console.log(`   XML kept in memory (not saved to disk)`);

                    if (token.isCancellationRequested) {
                        throw new Error("Tour generation cancelled");
                    }

                    // Step 2: Build context for LLM
                    progress.report({ message: "🔍 Building context for LLM (2/4)...", increment: 25 });
                    console.log("Step 2: Building project context...");
                    const projectContext = this.buildProjectContext(options, repomixResult);
                    console.log("✓ Context built with Repomix data");

                    if (token.isCancellationRequested) {
                        throw new Error("Tour generation cancelled");
                    }

                    // Step 3: Generate tour with LLM (using Repomix data)
                    progress.report({ message: "🤖 Generating tour with LLM (3/4)...", increment: 40 });
                    console.log("Step 3: Sending Repomix data to LLM for tour generation...");
                    const batchGenerator = new BatchTourGenerator();
                    const tourSteps = await batchGenerator.generateTourInBatches(
                        repomixResult,
                        projectContext,
                        progress
                    );
                    console.log(`✓ Generated ${tourSteps.length} steps with actual line numbers`);

                    if (token.isCancellationRequested) {
                        throw new Error("Tour generation cancelled");
                    }

                    // Step 4: Create and save tour
                    progress.report({ message: "💾 Creating tour file (4/4)...", increment: 85 });
                    console.log("Step 4: Creating tour...");
                    const validatedSteps = this.validateSteps(tourSteps, repomixResult);
                    const tour = this.createTour(validatedSteps, options);
                    console.log(`✓ Tour created: ${tour.title} with ${validatedSteps.length} steps`);

                    progress.report({ message: "🎉 Complete!", increment: 100 });
                    console.log("🎉 Tour generation complete!");
                    console.log(`   Total steps: ${validatedSteps.length}`);
                    console.log(`   Generation method: Repomix → LLM (NO TreeSitter!)`);
                    return tour;

                } catch (error: any) {
                    console.error("❌ Tour generation failed:", error);
                    vscode.window.showErrorMessage(`Failed to generate tour: ${error.message}`);
                    throw error;
                }
            }
        );
    }

    private buildProjectContext(options: TourGenerationOptions, repomixResult: any): string {
        const workspaceName = vscode.workspace.name || "Unknown Project";

        let context = `Project: ${workspaceName}\n`;
        context += `Goal: Create a comprehensive, narrative-driven tour that helps developers deeply understand this codebase.\n\n`;

        if (options.tourTitle) {
            context += `Tour Title: ${options.tourTitle}\n`;
        }
        if (options.tourDescription) {
            context += `Tour Description: ${options.tourDescription}\n`;
        }
        if (options.focusAreas && options.focusAreas.length > 0) {
            context += `Focus Areas: ${options.focusAreas.join(", ")}\n`;
        }

        context += `\n📦 REPOMIX ANALYSIS COMPLETE:\n`;
        context += `Files analyzed: ${repomixResult.output.totalFiles}\n`;
        context += `Total lines: ${repomixResult.output.totalLines}\n`;
        context += `Languages: ${Array.from(new Set(repomixResult.output.files.map((f: any) => f.language))).join(", ")}\n\n`;

        context += `🎯 CRITICAL INSTRUCTIONS:\n`;
        context += `1. The Repomix XML contains ALL code with ACTUAL line numbers (format: "   123|code here")\n`;
        context += `2. Parse the code yourself - classes, functions, imports are all visible\n`;
        context += `3. Use EXACT line numbers from the XML when creating tour steps\n`;
        context += `4. Show how files interconnect as a cohesive system\n`;
        context += `5. NO TreeSitter AST is provided - you have the raw code with line numbers instead!\n`;

        return context;
    }

    private validateSteps(
        steps: GeneratedTourStep[],
        repomixResult: any
    ): CodeTourStep[] {
        const validatedSteps: CodeTourStep[] = [];
        const repomixFiles = new Set(repomixResult.output.files.map((f: any) => f.path));

        for (const step of steps) {
            try {
                // Check if file exists in Repomix output
                if (!repomixFiles.has(step.file)) {
                    console.warn(`⚠️ File not in Repomix output: ${step.file}, skipping step`);
                    continue;
                }

                // Basic validation
                if (!step.title || !step.description) {
                    console.warn(`⚠️ Invalid step (missing title/description), skipping`);
                    continue;
                }

                // Convert to CodeTourStep format
                const tourStep: CodeTourStep = {
                    title: step.title,
                    file: step.file,
                    description: step.description
                };

                if (step.line && step.line > 0) {
                    tourStep.line = step.line;
                }

                if (step.selection) {
                    tourStep.selection = step.selection;
                }

                validatedSteps.push(tourStep);
            } catch (error) {
                console.error(`Error validating step:`, error);
            }
        }

        console.log(`✓ Validated ${validatedSteps.length} steps (from ${steps.length} generated)`);
        return validatedSteps;
    }

    private createTour(steps: CodeTourStep[], options: TourGenerationOptions): CodeTour {
        const tourTitle = options.tourTitle || `AI Generated Tour - ${new Date().toLocaleString()}`;
        const tourDescription = options.tourDescription || "This tour was automatically generated using AI and TreeSitter AST analysis.";

        // Get the workspace folder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(options.workspaceRoot);
        const tourDirectory = workspaceFolder
            ? vscode.Uri.joinPath(workspaceFolder.uri, ".tours")
            : options.workspaceRoot;

        const fileName = tourTitle
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]/g, "");

        const tourUri = vscode.Uri.joinPath(tourDirectory, `${fileName}.tour`);

        return {
            id: tourUri.toString(),
            title: tourTitle,
            description: tourDescription,
            steps: steps
        };
    }
}

