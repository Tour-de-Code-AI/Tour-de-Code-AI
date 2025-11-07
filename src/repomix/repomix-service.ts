// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Repomix Service for CodeTour - Generates comprehensive codebase summaries

import * as fs from "fs/promises";
import * as path from "path";
import { RepomixConfig, RepomixOutput, RepomixResult, RepomixProgressCallback, RepomixFileInfo } from "./types";

export class RepomixService {
    private config: RepomixConfig;

    constructor(workspaceRoot: string, customConfig?: Partial<RepomixConfig>) {
        this.config = {
            workspaceRoot,
            maxFileSize: 50 * 1024 * 1024, // 50MB
            includePatterns: ["**/*"],
            ignorePatterns: [
                "**/node_modules/**",
                "**/.git/**",
                "**/dist/**",
                "**/build/**",
                "**/*.min.js",
                "**/*.bundle.js",
                "**/coverage/**",
                "**/.vscode/**",
                "**/.idea/**",
                "**/package-lock.json",
                "**/yarn.lock",
                "**/.DS_Store",
                // Test files
                "**/*.test.*",
                "**/*.spec.*",
                "**/__tests__/**",
                "**/__mocks__/**",
                // Type definitions
                "**/*.d.ts",
                // Config files
                "**/*.config.*",
                "**/tsconfig.json",
                "**/jest.config.*",
                // Generated files
                "**/*.generated.*",
                "**/*.g.ts",
                "**/*.g.js"
            ],
            removeComments: false,
            showLineNumbers: true,
            enableSecurityCheck: false,
            ...customConfig
        };
    }

    /**
     * Generate a comprehensive Repomix-style summary of the codebase
     */
    async generateSummary(progressCallback?: RepomixProgressCallback): Promise<RepomixResult> {
        try {
            progressCallback?.("🔍 Scanning workspace...", 10);
            console.log("📦 Repomix: Starting codebase analysis...");
            console.log(`   Workspace: ${this.config.workspaceRoot}`);

            // Step 1: Search for files
            const files = await this.searchFiles();
            progressCallback?.(`📂 Found ${files.length} files...`, 30);
            console.log(`✓ Found ${files.length} files to analyze`);

            // Step 2: Read and process files
            progressCallback?.("📖 Reading file contents...", 50);
            const fileInfos = await this.processFiles(files);
            console.log(`✓ Processed ${fileInfos.length} files`);

            // Step 3: Generate directory structure
            progressCallback?.("🌳 Building directory tree...", 70);
            const directoryStructure = this.generateDirectoryTree(files);
            console.log(`✓ Generated directory structure`);

            // Step 4: Create summary
            progressCallback?.("✍️ Creating summary...", 80);
            const summary = this.generateFileSummary(fileInfos);

            // Step 5: Build output
            progressCallback?.("📝 Building output...", 90);
            const output: RepomixOutput = {
                summary,
                directoryStructure,
                files: fileInfos,
                totalFiles: fileInfos.length,
                totalCharacters: fileInfos.reduce((sum, f) => sum + f.content.length, 0),
                totalLines: fileInfos.reduce((sum, f) => sum + f.lineCount, 0)
            };

            // Step 6: Generate full XML content
            const outputContent = this.generateXMLOutput(output);

            // DEBUG: Save XML to file for review
            const debugFilePath = path.join(this.config.workspaceRoot, 'repomix-debug.xml');
            try {
                await fs.writeFile(debugFilePath, outputContent, 'utf-8');
                console.log(`📝 DEBUG: Repomix XML saved to: ${debugFilePath}`);
                console.log(`   Size: ${(outputContent.length / 1024).toFixed(2)} KB`);
            } catch (err) {
                console.warn(`⚠️ Could not save debug XML: ${err}`);
            }

            progressCallback?.("✅ Complete!", 100);
            console.log("🎉 Repomix analysis complete!");
            console.log(`   Files: ${output.totalFiles}`);
            console.log(`   Lines: ${output.totalLines}`);
            console.log(`   Characters: ${output.totalCharacters}`);

            return {
                output,
                outputContent,
                success: true
            };

        } catch (error: any) {
            console.error("❌ Repomix error:", error);
            return {
                output: {
                    summary: "",
                    directoryStructure: "",
                    files: [],
                    totalFiles: 0,
                    totalCharacters: 0,
                    totalLines: 0
                },
                outputContent: "",
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Search for files matching include/ignore patterns
     */
    private async searchFiles(): Promise<string[]> {
        async function scanDirectory(dir: string, ignorePatterns: string[]): Promise<string[]> {
            const result: string[] = [];
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(process.cwd(), fullPath);

                    // Check if should be ignored
                    const shouldIgnore = ignorePatterns.some(pattern => {
                        const normalized = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
                        const regex = new RegExp(normalized);
                        return regex.test(relativePath) || regex.test(entry.name);
                    });

                    if (shouldIgnore) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        const subFiles = await scanDirectory(fullPath, ignorePatterns);
                        result.push(...subFiles);
                    } else if (entry.isFile()) {
                        // Include source code files
                        const ext = path.extname(entry.name);
                        const sourceExts = [
                            ".ts", ".tsx", ".js", ".jsx",
                            ".py", ".java", ".go", ".rs",
                            ".cpp", ".c", ".cs", ".rb",
                            ".php", ".swift", ".kt", ".dart",
                            ".vue", ".svelte", ".scala",
                            ".sh", ".bash", ".lua", ".ex"
                        ];

                        if (sourceExts.includes(ext)) {
                            result.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                console.warn(`Warning: Cannot read directory ${dir}`, error);
            }

            return result;
        }

        const foundFiles = await scanDirectory(this.config.workspaceRoot, this.config.ignorePatterns);
        return foundFiles;
    }

    /**
     * Process files and extract information
     */
    private async processFiles(filePaths: string[]): Promise<RepomixFileInfo[]> {
        const results: RepomixFileInfo[] = [];

        for (const filePath of filePaths) {
            try {
                const stat = await fs.stat(filePath);

                // Skip files that are too large
                if (stat.size > this.config.maxFileSize) {
                    console.warn(`⚠️  Skipping large file: ${filePath} (${Math.round(stat.size / 1024)}KB)`);
                    continue;
                }

                const content = await fs.readFile(filePath, "utf-8");
                const relativePath = path.relative(this.config.workspaceRoot, filePath);
                const language = this.getLanguageFromExtension(path.extname(filePath));
                const lines = content.split("\n");

                // Optionally add line numbers
                let processedContent = content;
                if (this.config.showLineNumbers) {
                    processedContent = lines
                        .map((line, idx) => `${String(idx + 1).padStart(6, " ")}|${line}`)
                        .join("\n");
                }

                results.push({
                    path: relativePath,
                    content: processedContent,
                    language,
                    lineCount: lines.length,
                    size: stat.size
                });

            } catch (error) {
                console.warn(`Warning: Cannot read file ${filePath}`, error);
            }
        }

        return results;
    }

    /**
     * Generate directory tree structure
     */
    private generateDirectoryTree(filePaths: string[]): string {
        const tree = new Map<string, Set<string>>();

        filePaths.forEach(filePath => {
            const relativePath = path.relative(this.config.workspaceRoot, filePath);
            const parts = relativePath.split(path.sep);
            let currentPath = "";

            parts.forEach((part, index) => {
                const parentPath = currentPath;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (!tree.has(parentPath)) {
                    tree.set(parentPath, new Set());
                }
                tree.get(parentPath)!.add(part);
            });
        });

        // Build tree string
        let result = "";
        function buildTree(dir: string, indent: string = ""): void {
            const children = Array.from(tree.get(dir) || []).sort();
            children.forEach((child, index) => {
                const isLast = index === children.length - 1;
                const prefix = isLast ? "└── " : "├── ";
                result += `${indent}${prefix}${child}\n`;

                const childPath = dir ? `${dir}/${child}` : child;
                if (tree.has(childPath)) {
                    const newIndent = indent + (isLast ? "    " : "│   ");
                    buildTree(childPath, newIndent);
                }
            });
        }

        buildTree("");
        return result;
    }

    /**
     * Generate file summary section
     */
    private generateFileSummary(files: RepomixFileInfo[]): string {
        const languages = new Map<string, number>();
        files.forEach(f => {
            languages.set(f.language, (languages.get(f.language) || 0) + 1);
        });

        let summary = "This file is a comprehensive representation of the entire codebase.\n\n";
        summary += `Total Files: ${files.length}\n`;
        summary += `Total Lines: ${files.reduce((sum, f) => sum + f.lineCount, 0)}\n`;
        summary += `Total Characters: ${files.reduce((sum, f) => sum + f.content.length, 0)}\n\n`;

        summary += "Languages:\n";
        Array.from(languages.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([lang, count]) => {
                summary += `  - ${lang}: ${count} files\n`;
            });

        return summary;
    }

    /**
     * Generate XML output (Repomix-style)
     */
    private generateXMLOutput(output: RepomixOutput): string {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<codebase>\n\n`;

        // File Summary
        xml += `  <file_summary>\n`;
        xml += output.summary.split("\n").map(line => `    ${line}`).join("\n");
        xml += `\n  </file_summary>\n\n`;

        // Directory Structure
        xml += `  <directory_structure>\n`;
        xml += output.directoryStructure.split("\n").map(line => `    ${line}`).join("\n");
        xml += `\n  </directory_structure>\n\n`;

        // Files
        xml += `  <files>\n`;
        output.files.forEach(file => {
            xml += `    <file path="${this.escapeXml(file.path)}" language="${file.language}" lines="${file.lineCount}">\n`;
            xml += this.escapeXml(file.content).split("\n").map(line => `      ${line}`).join("\n");
            xml += `\n    </file>\n\n`;
        });
        xml += `  </files>\n`;

        xml += `</codebase>\n`;
        return xml;
    }

    /**
     * Get programming language from file extension
     */
    private getLanguageFromExtension(ext: string): string {
        const langMap: Record<string, string> = {
            ".ts": "typescript",
            ".tsx": "typescriptreact",
            ".js": "javascript",
            ".jsx": "javascriptreact",
            ".py": "python",
            ".java": "java",
            ".go": "go",
            ".rs": "rust",
            ".cpp": "cpp",
            ".c": "c",
            ".cs": "csharp",
            ".rb": "ruby",
            ".php": "php",
            ".swift": "swift",
            ".kt": "kotlin",
            ".dart": "dart",
            ".vue": "vue",
            ".svelte": "svelte",
            ".scala": "scala",
            ".sh": "shell",
            ".bash": "shell",
            ".lua": "lua",
            ".ex": "elixir"
        };

        return langMap[ext] || "plaintext";
    }

    /**
     * Escape XML special characters
     */
    private escapeXml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    /**
     * Save output to file
     */
    async saveOutput(outputContent: string, fileName: string = "repomix-output.xml"): Promise<string> {
        const outputPath = path.join(this.config.workspaceRoot, fileName);
        await fs.writeFile(outputPath, outputContent, "utf-8");
        console.log(`💾 Saved Repomix output to: ${outputPath}`);
        return outputPath;
    }
}

