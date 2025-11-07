// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { LLMService } from "./llm-service";
import { GeneratedTourStep } from "./tour-generator";

export class BatchTourGenerator {
    private llmService: LLMService;
    private readonly TARGET_STEPS = 15; // 15-20 total checkpoints (narrative tour style)
    private readonly FILES_PER_CHUNK = 5; // Process 5 files at a time to stay under token limits
    private readonly LINES_PER_FILE = 25; // Show first 25 lines of each file (balanced context)
    private readonly PARALLEL_CHUNKS = 10; // Process 3 chunks in parallel for speed

    constructor() {
        this.llmService = new LLMService();
    }

    async generateTourInBatches(
        repomixResult: any,
        projectContext: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<GeneratedTourStep[]> {
        console.log("🚀 Starting SIMPLIFIED tour generation (Repomix → LLM)");
        console.log("📦 Repomix files:", repomixResult.output.totalFiles);
        console.log("📦 Repomix lines:", repomixResult.output.totalLines);
        console.log("🎯 NO TreeSitter - LLM will parse code from Repomix XML!");

        const allSteps: GeneratedTourStep[] = [];

        // STEP 1: Welcome Page (LLM generates high-level overview)
        progress.report({ message: "🧠 Analyzing codebase for overview...", increment: 10 });
        console.log("Step 1: LLM analyzing codebase for high-level overview...");
        const welcomeSteps = await this.generateWelcomeFromLLM(repomixResult, projectContext, progress);

        if (welcomeSteps.length === 0) {
            console.error("❌ ERROR: No welcome steps generated!");
        } else {
            console.log(`✅ Welcome steps generated: ${welcomeSteps.length}`);
            allSteps.push(...welcomeSteps);
        }

        // STEP 2: Generate checkpoints from Repomix XML (ONE LLM CALL!)
        progress.report({ message: "🤖 Generating checkpoints from Repomix...", increment: 20 });
        console.log("Step 2: Generating checkpoints from Repomix (ONE LLM CALL)...");
        const checkpointSteps = await this.generateCheckpointsFromRepomix(repomixResult, projectContext, progress);

        if (checkpointSteps.length === 0) {
            throw new Error("❌ ERROR: No checkpoint steps generated!");
        }

        console.log(`✅ Checkpoint steps generated: ${checkpointSteps.length}`);
        allSteps.push(...checkpointSteps);

        progress.report({ message: "✅ Tour generation complete!", increment: 30 });
        console.log("\n🎉 TOUR GENERATION COMPLETE!");
        console.log(`   Welcome steps: ${welcomeSteps.length}`);
        console.log(`   Checkpoint steps: ${checkpointSteps.length}`);
        console.log(`   Total steps: ${allSteps.length}`);
        console.log(`   Method: Repomix → LLM (NO TreeSitter!)`);

        return allSteps;
    }

    // Generate checkpoints using CHUNKED approach to avoid rate limits
    private async generateCheckpointsFromRepomix(
        repomixResult: any,
        projectContext: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<GeneratedTourStep[]> {
        console.log(`\n🤖 Generating checkpoints from Repomix data (CHUNKED APPROACH)...`);
        console.log(`   Total files: ${repomixResult.output.totalFiles}`);
        console.log(`   Total lines: ${repomixResult.output.totalLines}`);
        console.log(`   XML size: ${(repomixResult.outputContent.length / 1024).toFixed(2)} KB`);
        console.log(`   Strategy: Process ${this.FILES_PER_CHUNK} files per chunk to avoid rate limits`);

        // Step 1: Sort files by importance (entry points first!)
        const allFiles = [...repomixResult.output.files]; // Copy array

        // Prioritize entry point files to be in chunk 1
        const entryPointPriority = (file: any): number => {
            const path = file.path.toLowerCase();
            const name = path.split('/').pop() || '';

            // Highest priority: main entry points
            if (name.match(/^(main|index|app|server|extension)\.(ts|js|tsx|jsx|py|go|java|rb)$/)) return 1;
            // High priority: src root files
            if (path.match(/^src\/(main|index|app|extension)\./)) return 2;
            // Medium priority: top-level src files
            if (path.match(/^src\/[^\/]+\.(ts|js|tsx|jsx)$/)) return 3;
            // Everything else
            return 4;
        };

        allFiles.sort((a, b) => {
            const priorityA = entryPointPriority(a);
            const priorityB = entryPointPriority(b);
            if (priorityA !== priorityB) return priorityA - priorityB;
            // If same priority, sort by path
            return a.path.localeCompare(b.path);
        });

        console.log(`   ✅ Sorted files (entry points first):`);
        console.log(`      First file: ${allFiles[0]?.path} (priority: ${entryPointPriority(allFiles[0])})`);
        console.log(`      Last file: ${allFiles[allFiles.length - 1]?.path}`);

        // Step 2: Split sorted files into chunks
        const chunks: any[][] = [];
        for (let i = 0; i < allFiles.length; i += this.FILES_PER_CHUNK) {
            chunks.push(allFiles.slice(i, i + this.FILES_PER_CHUNK));
        }

        console.log(`\n📦 Split into ${chunks.length} chunks of ~${this.FILES_PER_CHUNK} files each`);
        console.log(`   Processing ${this.PARALLEL_CHUNKS} chunks in parallel for speed`);

        // Step 2: Process chunks in parallel batches
        const allCheckpoints: GeneratedTourStep[] = [];
        const stepsPerChunk = Math.ceil(this.TARGET_STEPS / chunks.length);

        // Process PARALLEL_CHUNKS at a time
        for (let batchStart = 0; batchStart < chunks.length; batchStart += this.PARALLEL_CHUNKS) {
            const batchEnd = Math.min(batchStart + this.PARALLEL_CHUNKS, chunks.length);
            const parallelChunks = chunks.slice(batchStart, batchEnd);

            console.log(`\n🔄 Processing parallel batch: chunks ${batchStart + 1}-${batchEnd} of ${chunks.length}`);

            // Process this batch in parallel
            const promises = parallelChunks.map(async (chunk, index) => {
                const chunkNum = batchStart + index + 1;

                console.log(`📤 Chunk ${chunkNum}/${chunks.length}: Starting (${chunk.length} files)...`);

                const progressIncrement = 60 / chunks.length;
                progress.report({
                    message: `🤖 Analyzing chunk ${chunkNum}/${chunks.length}...`,
                    increment: progressIncrement
                });

                try {
                    const checkpoints = await this.generateCheckpointsForChunk(
                        chunk,
                        projectContext,
                        stepsPerChunk,
                        chunkNum,
                        chunks.length
                    );

                    console.log(`✅ Chunk ${chunkNum}: Generated ${checkpoints.length} checkpoints`);
                    return { chunkNum, checkpoints, success: true };

                } catch (error: any) {
                    console.error(`❌ Chunk ${chunkNum} FAILED: ${error.message}`);
                    return { chunkNum, checkpoints: [], success: false, error: error.message };
                }
            });

            // Wait for all parallel chunks to complete
            const results = await Promise.all(promises);

            // Collect successful checkpoints
            for (const result of results) {
                if (result.success && result.checkpoints.length > 0) {
                    allCheckpoints.push(...result.checkpoints);
                    console.log(`   ✓ Chunk ${result.chunkNum}: Added ${result.checkpoints.length} checkpoints (total: ${allCheckpoints.length})`);
                } else if (result.success && result.checkpoints.length === 0) {
                    console.warn(`   ⚠️ Chunk ${result.chunkNum}: No checkpoints generated`);
                }
            }

            // Small delay between parallel batches (not between individual chunks!)
            if (batchEnd < chunks.length) {
                console.log(`   ⏳ Waiting 1s before next parallel batch...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`\n✅ TOTAL: Generated ${allCheckpoints.length} checkpoints from ${chunks.length} chunks`);

        // Step 3: Check if we got any checkpoints at all
        if (allCheckpoints.length === 0) {
            console.error(`\n❌ CRITICAL: No checkpoints generated from ANY chunk!`);
            console.error(`   This means all ${chunks.length} chunks failed.`);
            console.error(`   Check the error logs above for details.`);
            console.error(`   Common causes:`);
            console.error(`   - LLM API key not configured`);
            console.error(`   - LLM returning non-JSON responses`);
            console.error(`   - Rate limits (even with chunking)`);
            console.error(`   - Network issues`);
            throw new Error(`Failed to generate any checkpoints. All ${chunks.length} chunks failed. Check console for details.`);
        }

        // Step 4: If we have more than TARGET_STEPS, pick the best ones
        if (allCheckpoints.length > this.TARGET_STEPS) {
            console.log(`   Trimming to top ${this.TARGET_STEPS} checkpoints...`);
            // Keep first checkpoint from each chunk, then fill remaining
            const finalCheckpoints = allCheckpoints.slice(0, this.TARGET_STEPS);
            return finalCheckpoints;
        }

        return allCheckpoints;
    }

    // Process a single chunk of files
    private async generateCheckpointsForChunk(
        files: any[],
        projectContext: string,
        targetSteps: number,
        chunkNum: number,
        totalChunks: number
    ): Promise<GeneratedTourStep[]> {
        // Build file summaries for this chunk
        const fileSummaries = files.map((file: any) => {
            // Get first N lines of each file as preview
            const lines = file.content.split('\n').slice(0, this.LINES_PER_FILE);
            const preview = lines.map((line: string, idx: number) =>
                `${String(idx + 1).padStart(4, ' ')}|${line}`
            ).join('\n');

            return `### ${file.path}
**Language:** ${file.language} | **Lines:** ${file.lineCount}
\`\`\`${file.language}
${preview}
\`\`\`
`;
        }).join('\n\n');

        const systemPrompt = `You are a senior software engineer creating a MENTAL MODEL tour of this codebase.

**🎯 Critical: This is NOT a random collection of files.**
This is a **sequential journey** where each checkpoint naturally leads to the next.

**Create ${targetSteps} checkpoints for chunk ${chunkNum}/${totalChunks}:**

${chunkNum === 1 ? `**⚠️ CHUNK 1 RULES (YOU ARE FIRST):**
1. **Checkpoint 1 MUST be the entry point** - Analyze the files and identify where the application starts
2. Look for: package.json "main" field, files with minimal imports but are imported by others, bootstrap/initialization patterns
3. Then follow where that entry point leads (imports, initializations)
4. Build the mental model: "Start here → Then this happens → Then that happens"
` : `**CHUNK ${chunkNum} RULES (continuing from previous chunks):**
1. These checkpoints continue the journey from previous chunks
2. Follow the logical flow (data flow, execution path, module dependencies)
3. Each checkpoint should feel like the next natural step
`}

**Each checkpoint must include:**
1. **Title**: Technical + sequential (e.g., "🏁 Entry Point - Application Bootstrap" or "⚙️ Core Router - Request Dispatch")
2. **File**: The actual file path
3. **Line**: Where this checkpoint starts (1-${this.LINES_PER_FILE})
4. **Description**: 4-6 sentences covering:
   - **What**: What this component does
   - **Why**: Why it exists in the flow (what problem it solves)
   - **How**: Key implementation details (patterns, data structures)
   - **Next**: How it connects to the next checkpoint ("This calls X, which handles Y...")

**Mental Model Flow Rules:**
- ✅ **Sequential**: Each checkpoint should logically follow the previous
- ✅ **Connected**: Explicitly mention how components interact ("calls", "imports", "emits to", "receives from")
- ✅ **Execution order**: Follow how code actually executes, not alphabetical order
- ✅ **Progressive depth**: Start broad (entry points) → go deeper (core logic) → integrations

**Writing Style:**
- Professional and technical
- Focus on flow: "This component receives X, processes it via Y, and outputs Z to..."
- Explain architectural decisions and trade-offs
- Use proper technical terminology

**Good Example:**
"Application entry point that bootstraps the VS Code extension. Registers the 'generateTour' command with vscode.commands and initializes the RepomixService for codebase analysis. The activation function follows VS Code's extension lifecycle pattern, ensuring all services are ready before accepting user commands. **Next**: When users trigger the command, it delegates to TourGenerator for analysis."

**Return Format (JSON array, no markdown):**
[
  {
    "title": "🏁 Entry Point - Extension Activation",
    "file": "src/extension.ts",
    "line": 1,
    "description": "..."
  },
  {
    "title": "⚙️ Tour Generator - Orchestration Layer",
    "file": "src/generator/tour-generator.ts",
    "line": 15,
    "description": "..."
  }
]`;

        const userPrompt = `${projectContext}

**📂 Chunk ${chunkNum} of ${totalChunks}:**

${chunkNum === 1 ? `**🚨 YOU ARE CREATING THE FIRST CHECKPOINTS:**
- **Checkpoint 1 MUST be the entry point** - Analyze and identify where the application actually starts
- Hints: Check package.json, look for bootstrap patterns, see which files are imported by many but import few
- Then follow the natural execution flow from there
- Think: "Where does the application START? What happens NEXT?"
` : `**Continuing the journey from previous chunks:**
- Build on what came before
- Follow the logical flow of the architecture
`}

**🔍 Files in this chunk:**
${fileSummaries}

**Your Task:**
Create ${targetSteps} checkpoints that form a MENTAL MODEL of how this code works.

**Think about:**
1. If chunk 1: **Start with the entry point**, then follow the flow
2. How do these components connect? (imports, function calls, data flow)
3. What's the SEQUENCE? (not alphabetical, but execution order)
4. How does each checkpoint lead to the next?

**Use emojis for visual flow:** 🏁 (entry) → ⚙️ (core logic) → 🔗 (integration) → 📊 (data) → 💾 (storage) → 🌐 (network) → 🎯 (output)

Remember: This is a TOUR, not a file listing. Tell a story of how the code executes.`;

        const promptSize = (systemPrompt.length + userPrompt.length) / 1024;
        console.log(`   Chunk ${chunkNum} prompt size: ${promptSize.toFixed(2)} KB`);

        try {
            const response = await this.llmService.generateCompletion([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);

            console.log(`   ✅ LLM response received (${response.content.length} chars)`);
            console.log(`   Preview: ${response.content.substring(0, 100)}...`);

            // Parse JSON response
            const cleanResponse = response.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            console.log(`   Attempting to parse JSON...`);
            const steps = JSON.parse(cleanResponse);

            if (!Array.isArray(steps)) {
                console.error(`   ❌ Response is not an array: ${typeof steps}`);
                throw new Error(`Invalid response format (expected array, got ${typeof steps})`);
            }

            console.log(`   ✅ Parsed ${steps.length} steps successfully`);
            return steps;

        } catch (error: any) {
            console.error(`   ❌ Failed to process chunk ${chunkNum}:`);
            console.error(`   Error type: ${error.constructor.name}`);
            console.error(`   Error message: ${error.message}`);

            if (error.message.includes('JSON')) {
                console.error(`   This looks like a JSON parsing error - LLM might not have returned valid JSON`);
            }

            throw error; // Re-throw to be caught by outer try-catch
        }
    }

    /**
     * Generates welcome checkpoint by asking LLM to analyze the entire codebase
     * This provides a high-level overview: purpose, architecture, flows, use cases
     */
    private async generateWelcomeFromLLM(
        repomixResult: any,
        projectContext: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<GeneratedTourStep[]> {
        console.log("\n🧠 Generating high-level overview from LLM (analyzing Repomix data)...");

        const allFiles = repomixResult.output.files;
        const totalFiles = repomixResult.output.totalFiles;
        const totalLines = repomixResult.output.totalLines;
        const languages = Array.from(new Set(allFiles.map((f: any) => f.language)));

        // 1. Find key files
        const readmeFile = allFiles.find((f: any) => f.path.toLowerCase().includes('readme'));
        const packageJson = allFiles.find((f: any) => f.path.toLowerCase() === 'package.json');

        // 2. Identify entry point (priority-based)
        const entryPointPriority = (file: any): number => {
            const path = file.path.toLowerCase();
            const name = path.split('/').pop() || '';
            if (name.match(/^(main|index|app|server|extension)\.(ts|js|tsx|jsx|py|go|java|rb)$/)) return 1;
            if (path.match(/^src\/(main|index|app|extension)\./)) return 2;
            if (path.match(/^src\/[^\/]+\.(ts|js|tsx|jsx)$/)) return 3;
            return 4;
        };

        const sortedFiles = [...allFiles].sort((a, b) => {
            const priorityA = entryPointPriority(a);
            const priorityB = entryPointPriority(b);
            return priorityA - priorityB;
        });

        const entryPointFile = sortedFiles[0];
        console.log(`   Identified entry point: ${entryPointFile.path}`);

        // 3. Select 8-10 key files for analysis (entry point + important files)
        const keyFiles = [entryPointFile];

        // Add package.json if exists
        if (packageJson) {
            keyFiles.push(packageJson);
        }

        // Add 6-8 more important files (skip README, we'll handle it separately)
        for (const file of sortedFiles.slice(1, 20)) {
            if (file.path.toLowerCase().includes('readme')) continue;
            if (file.path === packageJson?.path) continue;
            if (keyFiles.length >= 10) break;
            keyFiles.push(file);
        }

        console.log(`   Analyzing ${keyFiles.length} key files for overview`);

        // 4. Build code snippets from key files
        const codeSnippets = keyFiles.map(file => {
            const lines = file.content.split('\n');
            const preview = lines.slice(0, 40).join('\n'); // First 40 lines
            return `\n### File: ${file.path} (${file.language}, ${file.lines} lines)\n\`\`\`${file.language}\n${preview}\n${lines.length > 40 ? '... (truncated)' : ''}\`\`\``;
        }).join('\n\n');

        // 5. Get README content if available
        const readmeContent = readmeFile ? readmeFile.content.substring(0, 2000) : "No README available";

        const systemPrompt = `You are a senior software architect analyzing a codebase for the first time.

Your task: Generate a comprehensive **Welcome Checkpoint** that provides a high-level overview of this project by analyzing the actual code.

**What to include:**
1. **🎯 Project Purpose** - What problem does this solve? What is it for? (analyze package.json, README, code patterns)
2. **🏗️ Architecture Overview** - High-level component structure, layers, modules (trace imports, identify patterns)
3. **🔄 Key Technical Flows** - Main execution paths, data flow, control flow (follow the code from entry point)
4. **💡 Use Cases** - Primary use cases and user interactions (what can users do with this?)
5. **⚙️ Technology Stack** - Frameworks, libraries, patterns, tools used (from package.json and imports)
6. **🏁 Entry Points** - Where the application starts (identify from code analysis)

**Tone:** Professional, technical, but accessible (like explaining to a new senior engineer joining the team).

**Critical:** Analyze the CODE SNIPPETS provided below. Don't just read README - look at actual implementation!

**Format:** Return ONLY a JSON object (no markdown wrapper):
{
  "title": "🏁 Welcome - Project Overview",
  "file": "${readmeFile ? readmeFile.path : entryPointFile.path}",
  "line": 1,
  "description": "A detailed multi-paragraph overview covering all 6 points above. Use markdown formatting with ## headers, bullet points, emojis for visual structure. Be specific about actual files and modules found in the code."
}`;

        const userPrompt = `${projectContext}

**📊 Codebase Statistics:**
- ${totalFiles} files
- ${totalLines.toLocaleString()} lines
- Languages: ${languages.join(", ")}
- Entry Point: ${entryPointFile.path}

**📝 README Context:**
${readmeContent}

**🔍 CODE ANALYSIS - Key Files with Actual Code:**
${codeSnippets}

**Your Task:**
Analyze the CODE ABOVE (not just the README) and create a comprehensive Welcome checkpoint that explains:

1. **What is this project?** (Purpose, goals)
2. **How is it architected?** (Components, modules, layers you see in the code)
3. **What are the main flows?** (Trace execution from ${entryPointFile.path})
4. **What are the use cases?** (What can users do?)
5. **What technologies?** (Frameworks, libraries you see imported)
6. **Where to start?** (Entry point and next steps)

Be SPECIFIC with file/directory names from the code you analyzed above.`;


        try {
            console.log("   Calling LLM for high-level overview...");
            const response = await this.llmService.generateCompletion([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);

            console.log("   ✅ LLM response received");
            console.log(`   Response size: ${response.content.length} chars`);

            // Parse JSON response
            const parsed = JSON.parse(response.content);

            if (!parsed.title || !parsed.file || !parsed.description) {
                throw new Error("LLM response missing required fields (title, file, description)");
            }

            console.log(`   ✅ Welcome checkpoint generated: "${parsed.title}"`);

            return [{
                title: parsed.title,
                file: parsed.file,
                line: parsed.line || 1,
                description: parsed.description
            }];

        } catch (error: any) {
            console.error(`   ❌ Failed to generate welcome from LLM: ${error.message}`);
            console.error(`   Falling back to static welcome page...`);

            // Fallback to static welcome
            return this.generateStaticWelcomePage(repomixResult);
        }
    }

    /**
     * Fallback: Static welcome page (used if LLM fails)
     */
    private generateStaticWelcomePage(
        repomixResult: any
    ): GeneratedTourStep[] {
        console.log("\n📖 Generating static Welcome Page...");

        const allFiles = repomixResult.output.files;

        // Find README file
        const readmeFile = allFiles.find((f: any) =>
            f.path.toLowerCase().includes('readme')
        );

        // Find entry point as fallback
        const entryPointPriority = (file: any): number => {
            const path = file.path.toLowerCase();
            const name = path.split('/').pop() || '';
            if (name.match(/^(main|index|app|server|extension)\.(ts|js|tsx|jsx|py|go|java|rb)$/)) return 1;
            if (path.match(/^src\/(main|index|app|extension)\./)) return 2;
            return 3;
        };

        const sortedFiles = [...allFiles].sort((a, b) => {
            return entryPointPriority(a) - entryPointPriority(b);
        });

        const entryPointFile = sortedFiles[0];

        // Use README if exists, otherwise use entry point
        const welcomeFile = readmeFile || entryPointFile;

        if (!welcomeFile) {
            console.log("   ❌ No files found for welcome page");
            return [];
        }

        console.log(`   Welcome file: ${welcomeFile.path} ${readmeFile ? '(README)' : '(Entry Point)'}`);

        // Build welcome description
        const totalFiles = repomixResult.output.totalFiles;
        const totalLines = repomixResult.output.totalLines;
        const languages = Array.from(new Set(repomixResult.output.files.map((f: any) => f.language)));

        let welcomeDescription = `# 🏁 Codebase Architecture Tour\n\n`;
        welcomeDescription += `This tour provides a technical walkthrough of the system architecture, design patterns, and implementation details.\n\n`;
        welcomeDescription += `## 📊 Codebase Overview:\n`;
        welcomeDescription += `- **${totalFiles} files** totaling ${totalLines.toLocaleString()} lines of code\n`;
        welcomeDescription += `- **Technology Stack**: ${languages.join(", ")}\n`;
        welcomeDescription += `- **Entry Point**: ${entryPointFile.path}\n`;
        welcomeDescription += `- **Tour Checkpoints**: ${this.TARGET_STEPS}+ key architectural components\n\n`;
        welcomeDescription += `## 🎯 What This Tour Covers:\n`;
        welcomeDescription += `- 🏗️ **System Architecture** - Component structure and module organization\n`;
        welcomeDescription += `- 🔄 **Data Flow** - Request handling, state management, and processing pipelines\n`;
        welcomeDescription += `- 🧠 **Design Patterns** - Factory, Strategy, Observer, and other patterns in use\n`;
        welcomeDescription += `- 💡 **Technical Decisions** - Implementation rationale and trade-offs\n\n`;
        welcomeDescription += `## 📖 How to Navigate:\n`;
        welcomeDescription += `- **Sequential reading** recommended for full architectural understanding\n`;
        welcomeDescription += `- Each checkpoint includes technical details and integration points\n`;
        welcomeDescription += `- Use the checkpoint descriptions to understand component relationships\n\n`;

        if (readmeFile) {
            welcomeDescription += `---\n\n## 📝 Project Information:\n`;
            welcomeDescription += this.cleanReadmeContent(readmeFile.content || "");
        } else {
            welcomeDescription += `---\n\n## 🏁 Starting Point:\n`;
            welcomeDescription += `No README found. This tour starts at the entry point: **${entryPointFile.path}**\n\n`;
            welcomeDescription += `Click "Next" to begin exploring the codebase from the application entry point.`;
        }

        return [{
            title: "🏁 Welcome to the Codebase",
            file: welcomeFile.path,
            line: 1,
            description: welcomeDescription
        }];
    }

    /**
     * Cleans README content for inclusion in tour
     */
    private cleanReadmeContent(readme: string): string {
        // Remove excessive newlines
        let cleaned = readme.replace(/\n{3,}/g, '\n\n');

        // Truncate if too long (keep first 500 chars)
        if (cleaned.length > 500) {
            cleaned = cleaned.substring(0, 500) + '...\n\n[See full README for more details]';
        }

        return cleaned;
    }

    // Remove old TreeSitter-dependent methods (no longer needed!)
    // - filterImportantFiles
    // - selectTopFilesByImportance
    // - getFileImportance
    // - analyzeArchitecture
    // - buildCodebaseOverview
}
