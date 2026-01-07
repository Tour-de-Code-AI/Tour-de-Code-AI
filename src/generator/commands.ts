// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { EXTENSION_NAME } from "../constants";
import { saveTour } from "../recorder/commands";
import { store } from "../store";
import { startCodeTour } from "../store/actions";
import { LLMService } from "./llm-service";
import { TourGenerator } from "./tour-generator";

export function registerGeneratorCommands(extensionPath: string) {
    const tourGenerator = new TourGenerator(extensionPath);
    const llmService = new LLMService();

    // Command: Generate Code Tour
    vscode.commands.registerCommand(
        `${EXTENSION_NAME}.generateTour`,
        async () => {
            try {
                // Check if LLM is configured
                console.log("🔍 Checking LLM configuration...");
                if (!llmService.isConfigured()) {
                    console.log("⚠️ LLM not configured");
                    const result = await vscode.window.showWarningMessage(
                        "LLM API key is not configured. Would you like to configure it now?",
                        "Configure Now",
                        "Cancel"
                    );

                    if (result === "Configure Now") {
                        await vscode.commands.executeCommand(`${EXTENSION_NAME}.configureLLM`);
                        llmService.reloadConfig();

                        if (!llmService.isConfigured()) {
                            console.log("❌ LLM still not configured after settings");
                            return;
                        }
                    } else {
                        console.log("❌ User cancelled configuration");
                        return;
                    }
                }
                console.log("✓ LLM is configured");

                // Get workspace root
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage("No workspace folder is open.");
                    return;
                }

                // Prompt for tour details
                const tourTitle = await vscode.window.showInputBox({
                    prompt: "Enter a title for the generated tour",
                    placeHolder: "e.g., Getting Started with This Project",
                    value: `${vscode.workspace.name} Tour`
                });

                if (!tourTitle) {
                    return;
                }

                const tourDescription = await vscode.window.showInputBox({
                    prompt: "Enter an optional description for the tour",
                    placeHolder: "e.g., A comprehensive walkthrough of the main features"
                });

                // Generate the tour
                const generatedTour = await tourGenerator.generateTour({
                    workspaceRoot: workspaceFolder.uri,
                    tourTitle,
                    tourDescription: tourDescription || undefined
                });

                // Save the tour
                await saveTour(generatedTour);

                // Add to store if not already there
                const existingTour = store.tours.find(t => t.id === generatedTour.id);
                if (!existingTour) {
                    store.tours.push(generatedTour);
                }

                // Ask if user wants to start the tour
                const startNow = await vscode.window.showInformationMessage(
                    `Code tour "${tourTitle}" generated successfully with ${generatedTour.steps.length} steps!`,
                    "Start Tour",
                    "Close"
                );

                if (startNow === "Start Tour") {
                    startCodeTour(generatedTour, 0, workspaceFolder.uri);
                }

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to generate tour: ${error.message}`);
                console.error("Tour generation error:", error);
            }
        }
    );

    // Command: Configure LLM Settings
    vscode.commands.registerCommand(
        `${EXTENSION_NAME}.configureLLM`,
        async () => {
            try {
                const config = vscode.workspace.getConfiguration(EXTENSION_NAME);

                // Create settings panel
                const panel = vscode.window.createWebviewPanel(
                    "tourdecodeLLMSettings",
                    "Tour de Code AI LLM Settings",
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true
                    }
                );

                // Get current settings
                const currentApiKey = config.get<string>("llm.apiKey", "");
                const currentApiUrl = config.get<string>("llm.apiUrl", "https://api.openai.com/v1/chat/completions");
                const currentModel = config.get<string>("llm.model", "gpt-4");
                const currentProvider = config.get<string>("llm.provider", "openai");

                // Set webview content
                panel.webview.html = getSettingsWebviewContent(
                    currentProvider,
                    currentApiKey,
                    currentApiUrl,
                    currentModel
                );

                // Handle messages from webview
                panel.webview.onDidReceiveMessage(
                    async (message) => {
                        switch (message.command) {
                            case "save":
                                try {
                                    // Save settings
                                    await config.update("llm.provider", message.provider, vscode.ConfigurationTarget.Global);
                                    await config.update("llm.apiKey", message.apiKey, vscode.ConfigurationTarget.Global);
                                    await config.update("llm.apiUrl", message.apiUrl, vscode.ConfigurationTarget.Global);
                                    await config.update("llm.model", message.model, vscode.ConfigurationTarget.Global);

                                    // Reload LLM service config
                                    llmService.reloadConfig();

                                    vscode.window.showInformationMessage("LLM settings saved successfully!");
                                    panel.dispose();
                                } catch (error: any) {
                                    vscode.window.showErrorMessage(`Failed to save settings: ${error.message}`);
                                }
                                break;

                            case "test":
                                try {
                                    // Test connection with provided credentials
                                    const testService = new LLMService();

                                    // Temporarily update config for test
                                    await config.update("llm.provider", message.provider, vscode.ConfigurationTarget.Global);
                                    await config.update("llm.apiKey", message.apiKey, vscode.ConfigurationTarget.Global);
                                    await config.update("llm.apiUrl", message.apiUrl, vscode.ConfigurationTarget.Global);
                                    await config.update("llm.model", message.model, vscode.ConfigurationTarget.Global);

                                    testService.reloadConfig();

                                    // Make a simple test call
                                    await testService.generateCompletion([
                                        { role: "user", content: "Reply with just 'OK' if you can read this." }
                                    ]);

                                    panel.webview.postMessage({
                                        command: "testResult",
                                        success: true,
                                        message: "Connection successful! LLM is responding correctly."
                                    });

                                } catch (error: any) {
                                    panel.webview.postMessage({
                                        command: "testResult",
                                        success: false,
                                        message: `Connection failed: ${error.message}`
                                    });
                                }
                                break;

                            case "cancel":
                                panel.dispose();
                                break;
                        }
                    },
                    undefined
                );

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to open settings: ${error.message}`);
            }
        }
    );
}

function getSettingsWebviewContent(
    provider: string,
    apiKey: string,
    apiUrl: string,
    model: string
): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tour de Code AI LLM Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        h1 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        
        input, select {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }
        
        input:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 30px;
        }
        
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .status-message {
            padding: 10px;
            margin-top: 15px;
            border-radius: 2px;
            display: none;
        }
        
        .status-message.success {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }
        
        .status-message.error {
            background-color: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }
        
        .info-box {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 12px;
            margin: 20px 0;
            border-radius: 2px;
        }
        
        .info-box h3 {
            margin-top: 0;
            font-size: 14px;
        }
        
        .info-box ul {
            margin: 8px 0;
            padding-left: 20px;
        }
        
        .info-box li {
            margin: 5px 0;
            font-size: 12px;
        }
        
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 2px;
            font-family: var(--vscode-editor-font-family);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Tour de Code AI LLM Settings</h1>
        
        <div class="info-box">
            <h3>📝 Quick Setup Guide</h3>
            <ul>
                <li><strong>OpenAI:</strong> Get your API key from <a href="https://platform.openai.com/api-keys">platform.openai.com</a></li>
                <li><strong>Anthropic:</strong> Get your API key from <a href="https://console.anthropic.com/">console.anthropic.com</a></li>
                <li><strong>Custom:</strong> Use any OpenAI-compatible API endpoint (e.g., local LLMs)</li>
            </ul>
        </div>
        
        <form id="settingsForm">
            <div class="form-group">
                <label for="provider">LLM Provider</label>
                <div class="description">Choose your LLM provider</div>
                <select id="provider" name="provider">
                    <option value="openai" ${provider === "openai" ? "selected" : ""}>OpenAI (GPT-4, GPT-3.5)</option>
                    <option value="anthropic" ${provider === "anthropic" ? "selected" : ""}>Anthropic (Claude)</option>
                    <option value="custom" ${provider === "custom" ? "selected" : ""}>Custom (OpenAI-compatible)</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="apiKey">API Key *</label>
                <div class="description">Your LLM provider API key (stored securely in VS Code settings)</div>
                <input type="password" id="apiKey" name="apiKey" value="${apiKey}" placeholder="sk-..." required>
            </div>
            
            <div class="form-group">
                <label for="apiUrl">API Endpoint URL</label>
                <div class="description">API endpoint (default works for most cases). For OpenAI, this extension uses the Chat Completions compatible format.</div>
                <input type="text" id="apiUrl" name="apiUrl" value="${apiUrl}" placeholder="https://api.openai.com/v1/chat/completions">
            </div>
            
            <div class="form-group">
                <label for="model">Model Name</label>
                <div class="description">LLM model to use (e.g., <code>gpt-4o-mini</code>, <code>gpt-4o</code>, <code>gpt-5.2</code>, <code>claude-3-opus-20240229</code>). Note: for models starting with <code>gpt-5</code>, Tour de Code AI automatically uses <code>max_completion_tokens</code> instead of <code>max_tokens</code>.</div>
                <input type="text" id="model" name="model" value="${model}" placeholder="gpt-4o-mini" required>
            </div>
            
            <div class="status-message" id="statusMessage"></div>
            
            <div class="button-group">
                <button type="submit" class="btn-primary">💾 Save Settings</button>
                <button type="button" class="btn-secondary" id="testButton">🔌 Test Connection</button>
                <button type="button" class="btn-secondary" id="cancelButton">Cancel</button>
            </div>
        </form>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Update API URL based on provider selection
        document.getElementById('provider').addEventListener('change', (e) => {
            const provider = e.target.value;
            const apiUrlInput = document.getElementById('apiUrl');
            
            if (provider === 'openai') {
                apiUrlInput.value = 'https://api.openai.com/v1/chat/completions';
            } else if (provider === 'anthropic') {
                apiUrlInput.value = 'https://api.anthropic.com/v1/messages';
            }
        });
        
        // Handle form submission
        document.getElementById('settingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            vscode.postMessage({
                command: 'save',
                provider: formData.get('provider'),
                apiKey: formData.get('apiKey'),
                apiUrl: formData.get('apiUrl'),
                model: formData.get('model')
            });
        });
        
        // Handle test button
        document.getElementById('testButton').addEventListener('click', () => {
            const formData = new FormData(document.getElementById('settingsForm'));
            const statusMessage = document.getElementById('statusMessage');
            
            statusMessage.textContent = 'Testing connection...';
            statusMessage.className = 'status-message';
            statusMessage.style.display = 'block';
            
            vscode.postMessage({
                command: 'test',
                provider: formData.get('provider'),
                apiKey: formData.get('apiKey'),
                apiUrl: formData.get('apiUrl'),
                model: formData.get('model')
            });
        });
        
        // Handle cancel button
        document.getElementById('cancelButton').addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'testResult') {
                const statusMessage = document.getElementById('statusMessage');
                statusMessage.textContent = message.message;
                statusMessage.className = 'status-message ' + (message.success ? 'success' : 'error');
                statusMessage.style.display = 'block';
            }
        });
    </script>
</body>
</html>`;
}
