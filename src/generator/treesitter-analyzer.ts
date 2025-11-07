// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import * as vscode from "vscode";
import Parser from "web-tree-sitter";
import { AnalysisLogger } from "./analysis-logger";

export interface CodeElement {
    type: "class" | "function" | "async function" | "method" | "interface" | "enum" | "variable" | "import";
    name: string;
    file: string;
    line: number;
    endLine: number;
    description?: string;
    children?: CodeElement[];
    modifiers?: string[];
}

export interface FileAnalysis {
    file: string;
    language: string;
    elements: CodeElement[];
    imports: string[];
    exports: string[];
}

export interface ProjectStructure {
    rootPath: string;
    files: FileAnalysis[];
    entryPoints: string[];
    dependencies: Record<string, string[]>;
}

export class TreeSitterAnalyzer {
    private parser: Parser | null = null;
    private languages: Map<string, Parser.Language> = new Map();
    private initialized: boolean = false;
    private extensionPath: string;
    private logger: AnalysisLogger | null = null;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
    }

    setLogger(logger: AnalysisLogger) {
        this.logger = logger;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            console.log("🌳 Initializing TreeSitter with WASM grammars...");

            // Try dist folder first (packaged extension), fall back to node_modules (development)
            const tryPaths = [
                path.join(this.extensionPath, 'dist', 'tree-sitter.wasm'),
                path.join(this.extensionPath, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm')
            ];

            let wasmPath = tryPaths[0];
            for (const testPath of tryPaths) {
                try {
                    const fs = require('fs');
                    if (fs.existsSync(testPath)) {
                        wasmPath = testPath;
                        console.log(`  ℹ️  Using WASM from: ${testPath}`);
                        break;
                    }
                } catch (e) {
                    // Continue to next path
                }
            }

            await Parser.init({
                locateFile: () => wasmPath
            });

            this.parser = new Parser();

            // Try dist/grammars (packaged) or node_modules (dev)
            const grammarPaths = [
                path.join(this.extensionPath, 'dist', 'grammars'),
                path.join(this.extensionPath, 'node_modules', 'tree-sitter-wasms', 'out')
            ];

            let wasmsPath = grammarPaths[0];
            for (const testPath of grammarPaths) {
                try {
                    const fs = require('fs');
                    if (fs.existsSync(testPath)) {
                        wasmsPath = testPath;
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }

            // Load language grammars
            try {
                const tsPath = path.join(wasmsPath, 'tree-sitter-typescript.wasm');
                const TypeScript = await Parser.Language.load(tsPath);
                this.languages.set("typescript", TypeScript);
                this.languages.set("tsx", TypeScript);
                console.log("  ✓ Loaded TypeScript grammar");
            } catch (e) {
                console.warn("  ⚠ TypeScript grammar not available:", e);
            }

            try {
                const jsPath = path.join(wasmsPath, 'tree-sitter-javascript.wasm');
                const JavaScript = await Parser.Language.load(jsPath);
                this.languages.set("javascript", JavaScript);
                this.languages.set("jsx", JavaScript);
                console.log("  ✓ Loaded JavaScript grammar");
            } catch (e) {
                console.warn("  ⚠ JavaScript grammar not available:", e);
            }

            try {
                const pyPath = path.join(wasmsPath, 'tree-sitter-python.wasm');
                const Python = await Parser.Language.load(pyPath);
                this.languages.set("python", Python);
                console.log("  ✓ Loaded Python grammar");
            } catch (e) {
                console.warn("  ⚠ Python grammar not available:", e);
            }

            this.initialized = true;
            const langs = Array.from(this.languages.keys());
            console.log(`✅ TreeSitter AST parser initialized with ${this.languages.size} language(s)`);
            console.log(`🌳 TREESITTER AST ANALYSIS ACTIVE - Using real syntax tree parsing!`);
            console.log(`📊 Supported languages: ${langs.join(", ")}`);

            if (this.logger) {
                this.logger.logTreeSitterInit(langs);
            }
        } catch (error) {
            console.error("❌ Failed to initialize TreeSitter:", error);
            console.log("⚠️ Will use regex fallback for code analysis");
            this.initialized = true; // Mark as initialized to avoid retry loop
        }
    }

    getLanguage(languageId: string): Parser.Language | null {
        const langMap: Record<string, string> = {
            "typescript": "typescript",
            "typescriptreact": "tsx",
            "javascript": "javascript",
            "javascriptreact": "jsx",
            "python": "python"
        };

        const mappedLang = langMap[languageId];
        if (mappedLang && this.languages.has(mappedLang)) {
            return this.languages.get(mappedLang)!;
        }
        return null;
    }

    async analyzeFile(filePath: string, content: string, languageId: string): Promise<FileAnalysis | null> {
        if (!this.initialized) {
            await this.initialize();
        }

        // Try TreeSitter AST first
        if (this.parser) {
            const language = this.getLanguage(languageId);
            if (language) {
                try {
                    console.log(`🌳 TreeSitter AST: Parsing ${filePath} (${languageId})`);
                    this.parser.setLanguage(language);
                    const tree = this.parser.parse(content);

                    console.log(`   └─ AST Root: ${tree.rootNode.type} (${tree.rootNode.childCount} children)`);

                    // ⚠️ Log warnings for parse errors but STILL EXTRACT DATA
                    if (tree.rootNode.type === 'ERROR' || tree.rootNode.hasError()) {
                        console.warn(`   └─ ⚠️  Parse errors in ${filePath} - extracting what we can...`);
                    }

                    const elements = this.extractElements(tree.rootNode, filePath, content);
                    const imports = this.extractImports(tree.rootNode, content);
                    const exports = this.extractExports(tree.rootNode, content);

                    console.log(`   └─ ✅ TreeSitter extracted: ${elements.length} elements, ${imports.length} imports, ${exports.length} exports`);

                    // Log detailed element breakdown
                    const classes = elements.filter(e => e.type === 'class');
                    const functions = elements.filter(e => e.type === 'function' || e.type === 'async function');
                    const methods = elements.flatMap(e => e.children || []);
                    console.log(`      • ${classes.length} classes, ${functions.length} functions, ${methods.length} methods`);

                    // Log to file for evidence
                    if (this.logger) {
                        this.logger.logFileAnalysis(filePath, 'treesitter', {
                            astNodeType: tree.rootNode.type,
                            astNodeCount: tree.rootNode.childCount,
                            classes: classes.length,
                            functions: functions.length,
                            methods: methods.length,
                            imports: imports.length,
                            exports: exports.length
                        });
                    }

                    return {
                        file: filePath,
                        language: languageId,
                        elements,
                        imports,
                        exports
                    };
                } catch (error) {
                    console.error(`❌ TreeSitter parse failed for ${filePath}:`, error);
                }
            } else {
                console.log(`⚠️  No TreeSitter grammar for ${languageId}, using regex fallback`);
            }
        }

        // Fallback to regex if TreeSitter fails
        console.log(`📝 Using regex fallback for ${filePath}`);
        return this.analyzeFileRegex(filePath, content, languageId);
    }

    private extractElements(node: Parser.SyntaxNode, filePath: string, content: string): CodeElement[] {
        const elements: CodeElement[] = [];

        const traverse = (node: Parser.SyntaxNode, parent?: CodeElement) => {
            const element = this.nodeToElement(node, filePath, content);

            if (element) {
                if (parent && this.isMethodNode(node)) {
                    parent.children = parent.children || [];
                    parent.children.push(element);
                } else {
                    elements.push(element);
                }

                if (element.type === "class") {
                    for (const child of node.children) {
                        traverse(child, element);
                    }
                    return;
                }
            }

            if (!element || element.type !== "class") {
                for (const child of node.children) {
                    traverse(child, parent);
                }
            }
        };

        traverse(node);
        return elements;
    }

    private isMethodNode(node: Parser.SyntaxNode): boolean {
        return node.type === "method_definition" ||
            node.type === "function_definition" ||
            (node.parent?.type === "class_body" &&
                (node.type === "function_declaration" || node.type === "method_declaration"));
    }

    private nodeToElement(node: Parser.SyntaxNode, filePath: string, content: string): CodeElement | null {
        const typeMap: Record<string, CodeElement["type"]> = {
            "class_declaration": "class",
            "class_definition": "class",
            "function_declaration": "function",
            "function_definition": "function",
            "method_definition": "method",
            "method_declaration": "method",
            "interface_declaration": "interface",
            "enum_declaration": "enum",
            "type_alias_declaration": "interface"
        };

        const elementType = typeMap[node.type];
        if (elementType) {
            const nameNode = node.childForFieldName("name");
            const name = nameNode ? content.substring(nameNode.startIndex, nameNode.endIndex) : "anonymous";

            const isAsync = node.children.some((child: Parser.SyntaxNode) => child.type === "async");
            const finalType = (isAsync && elementType === "function") ? "async function" : elementType;

            return {
                type: finalType as CodeElement["type"],
                name: name,
                file: filePath,
                line: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1
            };
        }

        // Handle lexical declarations (const, let, var) - these might be exported functions
        if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
            for (const child of node.children) {
                if (child.type === "variable_declarator") {
                    const nameNode = child.childForFieldName("name");
                    const valueNode = child.childForFieldName("value");

                    if (nameNode && valueNode) {
                        const name = content.substring(nameNode.startIndex, nameNode.endIndex);

                        // Check if it's an arrow function or function expression
                        if (valueNode.type === "arrow_function" || valueNode.type === "function" || valueNode.type === "function_expression") {
                            const isAsync = valueNode.children.some((c: Parser.SyntaxNode) => c.type === "async");
                            return {
                                type: isAsync ? "async function" : "function",
                                name: name,
                                file: filePath,
                                line: node.startPosition.row + 1,
                                endLine: node.endPosition.row + 1
                            };
                        }

                        // Otherwise it's a variable/constant
                        return {
                            type: "variable",
                            name: name,
                            file: filePath,
                            line: node.startPosition.row + 1,
                            endLine: node.endPosition.row + 1
                        };
                    }
                }
            }
        }

        // Handle export statements - dig into what's being exported
        if (node.type === "export_statement") {
            for (const child of node.children) {
                // Export declaration (export const foo = ...)
                if (child.type === "lexical_declaration" || child.type === "variable_declaration") {
                    return this.nodeToElement(child, filePath, content);
                }
                // Export function declaration
                if (child.type === "function_declaration" || child.type === "class_declaration") {
                    return this.nodeToElement(child, filePath, content);
                }
            }
        }

        return null;
    }

    private extractImports(node: Parser.SyntaxNode, content: string): string[] {
        const imports: string[] = [];
        const traverse = (node: Parser.SyntaxNode) => {
            if (node.type.includes("import")) {
                imports.push(content.substring(node.startIndex, node.endIndex).trim());
            }
            for (const child of node.children) {
                traverse(child);
            }
        };
        traverse(node);
        return imports;
    }

    private extractExports(node: Parser.SyntaxNode, content: string): string[] {
        const exports: string[] = [];
        const traverse = (node: Parser.SyntaxNode) => {
            if (node.type.includes("export")) {
                exports.push(content.substring(node.startIndex, node.endIndex).trim());
            }
            for (const child of node.children) {
                traverse(child);
            }
        };
        traverse(node);
        return exports;
    }

    private analyzeFileRegex(filePath: string, content: string, languageId: string): FileAnalysis {
        const elements: CodeElement[] = [];
        const imports: string[] = [];
        const exports: string[] = [];
        const lines = content.split("\n");

        let currentClass: CodeElement | null = null;
        let currentIndent = 0;

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            const indent = line.search(/\S/);

            if (languageId === "typescript" || languageId === "javascript") {
                const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
                if (classMatch) {
                    currentClass = {
                        type: "class",
                        name: classMatch[1],
                        file: filePath,
                        line: index + 1,
                        endLine: index + 1,
                        children: []
                    };
                    currentIndent = indent;
                    elements.push(currentClass);
                }

                const methodMatch = trimmed.match(/^(?:public|private|protected|async|static)*\s*(\w+)\s*\([^)]*\)\s*[:=>{]/);
                if (methodMatch && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
                    const method: CodeElement = {
                        type: trimmed.includes("async") ? "async function" : "function",
                        name: methodMatch[1],
                        file: filePath,
                        line: index + 1,
                        endLine: index + 1
                    };

                    if (currentClass && indent > currentIndent) {
                        if (!currentClass.children) currentClass.children = [];
                        currentClass.children.push(method);
                    } else {
                        elements.push(method);
                        currentClass = null;
                    }
                }
            }

            if (trimmed.includes("import ") || trimmed.includes("from ")) {
                imports.push(trimmed);
            }
            if (trimmed.startsWith("export ")) {
                exports.push(trimmed);
            }
        });

        return {
            file: filePath,
            language: languageId,
            elements,
            imports,
            exports
        };
    }

    async analyzeProject(workspaceRoot: vscode.Uri): Promise<ProjectStructure> {
        console.log("📂 Starting TreeSitter AST code analysis...");
        const config = vscode.workspace.getConfiguration("codetour");
        const maxFiles = config.get<number>("autoGenerate.maxFilesToAnalyze", 200);
        const includeFileTypes = config.get<string[]>("autoGenerate.includeFileTypes", [".ts", ".js", ".py"]);

        const files: FileAnalysis[] = [];
        const entryPoints: string[] = [];

        console.log(`🔍 Searching for files: ${includeFileTypes.join(", ")}`);
        const pattern = `**/*{${includeFileTypes.join(",")}}`;

        // 🔥 AGGRESSIVE EXCLUSION (like Cline - only analyze REAL source code!)
        const excludePatterns = [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/out/**",
            "**/.next/**",
            "**/coverage/**",
            "**/__tests__/**",
            "**/__mocks__/**",
            "**/*.test.*",
            "**/*.spec.*",
            "**/*.min.*",
            "**/*.d.ts",
            "**/.git/**",
            "**/.vscode/**",
            "**/.idea/**",
            "**/fixtures/**",        // ← SKIP TEST FIXTURES!
            "**/examples/**",        // ← SKIP EXAMPLES!
            "**/demo/**",            // ← SKIP DEMOS!
            "**/demos/**",
            "**/scripts/**",         // ← SKIP BUILD SCRIPTS!
            "**/tools/**",           // ← SKIP TOOLING!
            "**/.storybook/**",
            "**/stories/**",
            "**/*.stories.*",
            "**/webpack.config.*",
            "**/vite.config.*",
            "**/rollup.config.*",
            "**/*.config.js",
            "**/*.config.ts"
        ].join(",");

        // If maxFiles is 0, analyze EVERYTHING (unlimited)
        // Otherwise, find more files than maxFiles for better prioritization
        const searchLimit = maxFiles === 0 ? undefined : maxFiles * 3;
        console.log(maxFiles === 0 ? "   🌟 Analyzing ENTIRE codebase (unlimited, auto-excludes tests/build/node_modules)" : `   📊 Limit: ${maxFiles} files (searching ${maxFiles * 3} for prioritization)`);

        const foundFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspaceRoot, pattern),
            `{${excludePatterns}}`,
            searchLimit
        );

        console.log(`📝 Found ${foundFiles.length} source files (tests/node_modules excluded)`);

        // 🔥 FINAL FILTER - catch anything that slipped through!
        const cleanedFiles = foundFiles.filter(uri => {
            const relativePath = vscode.workspace.asRelativePath(uri).toLowerCase();

            // Skip ANYTHING non-essential (like Cline does!)
            if (relativePath.includes('.test.') ||
                relativePath.includes('.spec.') ||
                relativePath.includes('test/') ||
                relativePath.includes('tests/') ||
                relativePath.includes('__test__') ||
                relativePath.includes('.config.') ||
                relativePath.includes('config/') ||
                relativePath.includes('.generated.') ||
                relativePath.includes('.min.') ||
                relativePath.includes('fixture') ||     // ← fixtures
                relativePath.includes('example') ||     // ← examples
                relativePath.includes('demo') ||        // ← demos
                relativePath.includes('script') ||      // ← scripts (downloadFonts.js etc)
                relativePath.includes('tool') ||        // ← tools
                relativePath.includes('storybook') ||   // ← storybook
                relativePath.includes('.stories.')) {
                return false;
            }

            return true;
        });

        console.log(`🧹 After filtering: ${cleanedFiles.length} files`);

        const prioritizedFiles = this.prioritizeFiles(cleanedFiles, workspaceRoot);
        // If maxFiles is 0, analyze ALL files; otherwise limit to maxFiles
        const filesToAnalyze = maxFiles === 0 ? prioritizedFiles : prioritizedFiles.slice(0, maxFiles);
        console.log(`🎯 Analyzing ${filesToAnalyze.length} files with TreeSitter AST...`);

        // SEQUENTIAL ANALYSIS with TIMEOUT per file (avoid hanging!)
        console.log(`📊 Analyzing ${filesToAnalyze.length} files SEQUENTIALLY (with timeout per file)...`);

        let analyzed = 0;
        const FILE_TIMEOUT = 5000; // 5 seconds max per file

        for (const fileUri of filesToAnalyze) {
            try {
                // Wrap analysis in timeout
                const analysisPromise = (async () => {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const relativePath = vscode.workspace.asRelativePath(fileUri);
                    return await this.analyzeFile(
                        relativePath,
                        document.getText(),
                        document.languageId
                    );
                })();

                const timeoutPromise = new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), FILE_TIMEOUT)
                );

                const analysis = await Promise.race([analysisPromise, timeoutPromise]);

                if (analysis) {
                    const relativePath = vscode.workspace.asRelativePath(fileUri);
                    files.push(analysis);
                    analyzed++;
                    console.log(`   ✓ ${relativePath}: ${analysis.elements.length} elements`);

                    const fileName = relativePath.toLowerCase();
                    if (fileName.includes("index") || fileName.includes("main") || fileName.includes("app")) {
                        entryPoints.push(relativePath);
                    }
                }

                // Show progress every 10 files
                if (analyzed % 10 === 0) {
                    console.log(`   📊 Progress: ${analyzed}/${filesToAnalyze.length} files`);
                }
            } catch (error: any) {
                if (error.message === 'Timeout') {
                    console.warn(`   ⏱️  Skipped ${vscode.workspace.asRelativePath(fileUri)} (took >5s)`);
                } else {
                    console.error(`   ❌ Failed to analyze ${fileUri.fsPath}:`, error.message);
                }
            }
        }

        console.log(`✅ Analyzed ${analyzed} files with TreeSitter AST`);
        console.log(`📍 Found ${entryPoints.length} entry points`);

        return {
            rootPath: workspaceRoot.fsPath,
            files,
            entryPoints,
            dependencies: this.buildDependencyGraph(files)
        };
    }

    private prioritizeFiles(files: vscode.Uri[], workspaceRoot: vscode.Uri): vscode.Uri[] {
        const scored = files.map(uri => {
            const relativePath = vscode.workspace.asRelativePath(uri).toLowerCase();
            let score = 0;

            if (relativePath.includes('index') || relativePath.includes('main') ||
                relativePath.includes('app')) score += 100;
            if (relativePath.includes('src/') || relativePath.includes('lib/')) score += 50;
            if (relativePath.includes('test') || relativePath.includes('spec')) score -= 50;

            const depth = relativePath.split('/').length;
            score -= depth * 2;

            if (relativePath.includes('config') || relativePath.includes('webpack')) score -= 30;
            if (relativePath.includes('type') || relativePath.includes('interface')) score += 10;

            return { uri, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.uri);
    }

    private buildDependencyGraph(files: FileAnalysis[]): Record<string, string[]> {
        const graph: Record<string, string[]> = {};
        files.forEach(file => {
            graph[file.file] = [];
            file.imports.forEach(importStmt => {
                const match = importStmt.match(/from\s+['"](.+?)['"]/);
                if (match) {
                    graph[file.file].push(match[1]);
                }
            });
        });
        return graph;
    }
}
