// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import axios, { AxiosRequestConfig } from "axios";
import * as vscode from "vscode";
import { EXTENSION_NAME } from "../constants";

export interface LLMConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
    provider: "openai" | "anthropic" | "custom";
}

export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class LLMService {
    private config: LLMConfig;

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): LLMConfig {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        return {
            apiKey: config.get<string>("llm.apiKey", ""),
            apiUrl: config.get<string>("llm.apiUrl", "https://api.openai.com/v1/chat/completions"),
            model: config.get<string>("llm.model", "gpt-4"),
            provider: config.get<"openai" | "anthropic" | "custom">("llm.provider", "openai")
        };
    }

    public reloadConfig(): void {
        this.config = this.loadConfig();
    }

    public isConfigured(): boolean {
        return this.config.apiKey.trim() !== "";
    }

    public async generateCompletion(messages: LLMMessage[], retryCount = 0): Promise<LLMResponse> {
        if (!this.isConfigured()) {
            throw new Error("LLM API key is not configured. Please configure it using 'Tour de Code AI: Configure LLM Settings' command.");
        }

        const MAX_RETRIES = 3;
        const BASE_DELAY = 2000; // 2 seconds

        console.log(`🤖 Calling ${this.config.provider} API with model ${this.config.model}... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

        try {
            const response = await this.callLLMAPI(messages);
            console.log(`✓ LLM response received (${response.usage?.total_tokens || '?'} tokens)`);
            return response;
        } catch (error: any) {
            console.error("❌ LLM API error:", error);

            if (error.response?.status === 401) {
                throw new Error("Invalid API key. Please check your LLM configuration.");
            } else if (error.response?.status === 429) {
                // RATE LIMIT - Retry with exponential backoff
                if (retryCount < MAX_RETRIES) {
                    const delay = BASE_DELAY * Math.pow(2, retryCount); // 2s, 4s, 8s
                    console.log(`⏳ Rate limit hit! Retrying in ${delay / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.generateCompletion(messages, retryCount + 1);
                } else {
                    throw new Error("Rate limit exceeded after 3 retries. Please try again later or reduce concurrent batches.");
                }
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new Error(`Cannot reach LLM API at ${this.config.apiUrl}. Check your internet connection.`);
            } else {
                throw new Error(`LLM API error: ${error.message}`);
            }
        }
    }

    private async callLLMAPI(messages: LLMMessage[]): Promise<LLMResponse> {
        switch (this.config.provider) {
            case "openai":
                return this.callOpenAI(messages);
            case "anthropic":
                return this.callAnthropic(messages);
            case "custom":
                return this.callCustomAPI(messages);
            default:
                throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
        }
    }

    /**
     * OpenAI-compatible token limit field mapping.
     *
     * Some newer OpenAI models (e.g. gpt-5.x) reject `max_tokens` and require
     * `max_completion_tokens` instead.
     */
    private getTokenLimitField(maxTokens: number): Record<string, number> {
        const model = (this.config.model || "").trim().toLowerCase();

        // Model-based mapping requested: gpt-5* => max_completion_tokens
        if (model.startsWith("gpt-5")) {
            return { max_completion_tokens: maxTokens };
        }

        return { max_tokens: maxTokens };
    }

    private async callOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
        console.log("📡 Preparing OpenAI API request...");
        console.log(`   URL: ${this.config.apiUrl}`);
        console.log(`   Model: ${this.config.model}`);
        console.log(`   API Key: ${this.config.apiKey.substring(0, 10)}...`);
        console.log(`   Messages: ${messages.length}`);

        // Calculate approximate token count (rough estimate: 1 token ≈ 4 chars)
        const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
        const estimatedTokens = Math.ceil(totalChars / 4);
        console.log(`   Estimated input tokens: ~${estimatedTokens}`);

        // Warn if payload might be too large
        if (estimatedTokens > 100000) {
            console.warn(`   ⚠️ Input is very large (${estimatedTokens} tokens)! This might fail.`);
        }

        const tokenLimit = 2000; // Reduced from 4096 to stay under token limits
        const tokenLimitField = this.getTokenLimitField(tokenLimit);
        const tokenLimitKey = Object.keys(tokenLimitField)[0];
        console.log(`   Token limit: ${tokenLimit} via ${tokenLimitKey}`);

        const requestConfig: AxiosRequestConfig = {
            method: "POST",
            url: this.config.apiUrl,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.config.apiKey}`
            },
            data: {
                model: this.config.model,
                messages: messages,
                temperature: 0.7,
                ...tokenLimitField
            },
            timeout: 120000, // 2 minute timeout
            validateStatus: () => true // Don't throw on any status, we'll handle it
        };

        console.log("🚀 Sending request to OpenAI...");
        const startTime = Date.now();

        try {
            const response = await axios(requestConfig);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            // Check for error status codes
            if (response.status !== 200) {
                console.error(`❌ OpenAI returned status ${response.status}`);
                console.error(`   Response:`, JSON.stringify(response.data, null, 2));

                let errorMessage = `OpenAI API error (${response.status})`;

                if (response.data?.error) {
                    const error = response.data.error;
                    errorMessage = error.message || errorMessage;

                    // Provide a targeted hint for the common gpt-5.x migration error.
                    const msg = String(error.message || "");
                    const unsupportedMaxTokens =
                        msg.includes("Unsupported parameter: 'max_tokens'") ||
                        msg.includes("max_tokens is not supported") ||
                        msg.includes("Use 'max_completion_tokens' instead");

                    // Specific error handling
                    if (response.status === 400) {
                        if (error.code === 'context_length_exceeded') {
                            errorMessage = `Input is too long (exceeds model context limit). Try analyzing fewer files.`;
                        } else if (error.type === 'invalid_request_error') {
                            if (unsupportedMaxTokens) {
                                errorMessage = `Invalid request: ${error.message} (This usually means the selected model requires 'max_completion_tokens' instead of 'max_tokens'. Tour de Code AI will map this automatically for models starting with 'gpt-5'.)`;
                            } else {
                                errorMessage = `Invalid request: ${error.message}`;
                            }
                        } else {
                            errorMessage = `Bad request (400): ${error.message || 'Check your model name and API settings'}`;
                        }
                    } else if (response.status === 401) {
                        errorMessage = "Invalid API key";
                    } else if (response.status === 429) {
                        errorMessage = "Rate limit exceeded";
                    } else if (response.status === 500) {
                        errorMessage = "OpenAI server error. Try again in a moment.";
                    }
                }

                throw new Error(errorMessage);
            }

            console.log(`✓ OpenAI response received in ${duration}s`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Choices: ${response.data.choices?.length || 0}`);

            if (!response.data.choices || response.data.choices.length === 0) {
                throw new Error("OpenAI returned no choices in response");
            }

            return {
                content: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        } catch (error: any) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.error(`❌ OpenAI request failed after ${duration}s`);

            // If it's our thrown error, just rethrow
            if (error.message && !error.code) {
                throw error;
            }

            // Network or other errors
            throw error;
        }
    }

    private async callAnthropic(messages: LLMMessage[]): Promise<LLMResponse> {
        // Extract system message if present
        const systemMessage = messages.find(m => m.role === "system");
        const conversationMessages = messages.filter(m => m.role !== "system");

        const requestConfig: AxiosRequestConfig = {
            method: "POST",
            url: this.config.apiUrl || "https://api.anthropic.com/v1/messages",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.config.apiKey,
                "anthropic-version": "2023-06-01"
            },
            data: {
                model: this.config.model,
                max_tokens: 4096,
                messages: conversationMessages,
                ...(systemMessage && { system: systemMessage.content })
            }
        };

        const response = await axios(requestConfig);

        return {
            content: response.data.content[0].text,
            usage: response.data.usage
        };
    }

    private async callCustomAPI(messages: LLMMessage[]): Promise<LLMResponse> {
        // Generic OpenAI-compatible API call for custom providers
        const tokenLimit = 4096;
        const requestConfig: AxiosRequestConfig = {
            method: "POST",
            url: this.config.apiUrl,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.config.apiKey}`
            },
            data: {
                model: this.config.model,
                messages: messages,
                temperature: 0.7,
                ...this.getTokenLimitField(tokenLimit)
            }
        };

        const response = await axios(requestConfig);

        // Try to parse response in OpenAI format
        if (response.data.choices && response.data.choices[0]) {
            return {
                content: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        }

        // Fallback for other formats
        return {
            content: response.data.content || response.data.response || JSON.stringify(response.data)
        };
    }

    public async generateCodeTourDescription(
        codeStructure: string,
        projectContext: string
    ): Promise<string> {
        const systemPrompt = `You are an expert software engineer creating a comprehensive code tour to help developers deeply understand this codebase.

🎯 WRITING STYLE:
- Use clear, professional technical language
- Explain the PURPOSE and REASONING behind code decisions
- Be specific about what each component does and why it exists
- NO childish analogies or comparisons - keep it professional
- Reference actual class names, method names, parameters, and return types
- Explain relationships, dependencies, and data flow between components

📖 TOUR STRUCTURE (Create 35-60+ comprehensive steps):

**STEP 1 - WELCOME PAGE (CRITICAL!):**
Create a comprehensive welcome/overview step that includes:
- Project name and primary purpose (what problem does it solve?)
- High-level architecture overview (main components and how they interact)
- Key technologies and frameworks used
- Main flows/execution paths (e.g., "User Authentication Flow", "Data Processing Pipeline")
- Important patterns or design decisions
- Directory structure explanation
- What developers will learn from this tour
This should be markdown-formatted, use bullet points, and possibly ASCII diagrams if helpful.
Use the main entry file (like README, index, or main file) at line 1 for this step.

**STEPS 2-4 - ENTRY POINTS:**
Main files, initialization logic, startup flow

**STEPS 5-45 - CORE COMPONENTS (THE MEAT!):**
Deep dive into EVERY important class, function, and method
- For each significant file, create MULTIPLE steps covering:
  * Class definition and its purpose
  * Each important method within the class (separate step for each!)
  * Key functions and their logic
  * Important variables, configurations, or state management

**STEPS 46-52 - INTEGRATIONS:**
How different modules/files work together, data flow between components

**STEPS 53-57 - ARCHITECTURE:**
Design patterns, architectural decisions, best practices used

**STEP 58+ - SUMMARY:**
Recap of what was learned and next steps for developers

🔍 CRITICAL REQUIREMENTS:
- **ONE STEP PER FUNCTION/METHOD**: EVERY function, method, and exported constant gets its own dedicated step
- **COVER ALL ELEMENTS**: Classes, methods, functions, interfaces, types, utilities - EVERYTHING in the code structure
- **BE THOROUGH**: Aim for 50-100+ steps - more is better! Don't summarize, break it down!
- **ACCURATE LINE NUMBERS**: Use the exact line numbers provided in the code structure
- **NO SKIPPING**: If you see 20 functions listed, create 20+ steps (1 for each function + related context)
- **METHOD DETAIL**: For classes with methods, create:
  * 1 step for the class definition explaining its purpose
  * 1 step for EACH method inside that class
  * 1 step for key properties or state variables if significant

✍️ DESCRIPTION FORMAT (3-5 sentences each):
- Sentence 1: What this specific component is (class/method/function name)
- Sentence 2-3: What it does, its parameters/inputs, what it returns/produces
- Sentence 4: Why it exists, what problem it solves, or how it fits into the larger system
- Sentence 5: How it connects to other components (if applicable)

Example GOOD descriptions:

**For the WELCOME PAGE (Step 1):**
"# Welcome to the E-Commerce Platform Codebase

## 🎯 Project Purpose
This is a full-stack e-commerce platform that enables online shopping with real-time inventory management, secure payment processing, and order tracking.

## 🏗️ High-Level Architecture
The system follows a microservices architecture:
- **Frontend**: React SPA with Redux for state management
- **API Gateway**: Express.js handling routing and authentication
- **Services**: 
  - User Service (authentication, profiles)
  - Product Service (catalog, inventory)
  - Order Service (cart, checkout, fulfillment)
  - Payment Service (Stripe integration)
- **Database**: PostgreSQL for relational data, Redis for caching
- **Message Queue**: RabbitMQ for async order processing

## 🔄 Main Flows
1. **User Registration → Login → Browse Products → Add to Cart → Checkout → Payment → Order Confirmation**
2. **Admin: Product Management → Inventory Updates → Order Fulfillment**

## 🛠️ Tech Stack
Node.js, Express, React, PostgreSQL, Redis, Docker, JWT Auth

## 📂 Directory Structure
- \`/src/api\` - API endpoints and routes
- \`/src/services\` - Business logic layer
- \`/src/models\` - Database models
- \`/src/middleware\` - Auth, validation, error handling
- \`/src/utils\` - Helper functions

## 📚 What You'll Learn
This tour will walk you through the entire codebase, from authentication flow to payment processing. You'll understand how each component works and how they integrate together."

**For a class:**
"The UserAuthenticationService class handles all user authentication logic for the application. It manages login, logout, token validation, and session management through dedicated methods. This service exists as a centralized authentication layer to ensure consistent security practices across the entire application. It integrates with the TokenManager for JWT handling and the DatabaseService for user credential verification."

**For a method:**
"The validateUserCredentials(username: string, password: string) method performs user authentication by verifying credentials against the database. It accepts a username and password, hashes the password using bcrypt, queries the database for matching records, and returns a boolean indicating success or failure. This method is called by the login endpoint to authenticate users before issuing access tokens. It implements rate limiting to prevent brute force attacks."

❌ AVOID these styles:
- "Think of this as a chef in a kitchen..." (NO analogies)
- "This acts like a traffic controller..." (NO metaphors)
- "Imagine this is a library..." (NO comparisons to unrelated things)
- "This file is responsible for..." (too vague - be specific about classes/functions)

🎨 OUTPUT FORMAT:
Return ONLY a valid JSON array of 30-50+ steps:
{
  "title": "Specific Component Name",
  "file": "relative/path/to/file.ext",
  "line": <actual_line_number>,
  "description": "Professional technical explanation (3-5 sentences) with specific details about implementation, purpose, and connections."
}`;



        const userPrompt = `Here's the codebase structure with all classes, functions, and methods:

=== PROJECT CONTEXT ===
${projectContext}

=== DETAILED CODE STRUCTURE ===
${codeStructure}

=== YOUR TASK ===
Create a COMPREHENSIVE code tour with 35-60+ steps that truly helps developers understand this codebase.

🎯 CRITICAL REQUIREMENTS:

**1. STEP 1 MUST BE A WELCOME PAGE:**
Create an amazing welcome/overview step with:
- Project name and what problem it solves
- High-level architecture (components and how they interact)
- Tech stack and frameworks
- Main execution flows (e.g., authentication flow, data processing pipeline)
- Directory structure explanation
- Key patterns/decisions
- What they'll learn from this tour
Use markdown with sections, bullet points, emojis. Make it comprehensive! Use the main entry point file at line 1.

**2. CREATE MULTIPLE STEPS PER FILE:**
If a file has 10 methods, create 10+ separate steps (one for each method/function)

**3. USE EXACT LINE NUMBERS:**
From the code structure provided above

**4. COVER EVERYTHING:**
Every class, method, function, interface listed in the structure

**5. PROFESSIONAL TECHNICAL LANGUAGE:**
NO childish analogies. Explain actual implementation, parameters, return types, purpose, and connections.

**Structure your tour:**
- Step 1: Welcome page (comprehensive overview)
- Steps 2-4: Entry points and startup
- Steps 5-50: Deep dive into ALL classes and their methods
- Steps 51-55: Integrations and data flow
- Steps 56-58: Architecture and patterns
- Step 59+: Summary

Return ONLY a valid JSON array of 35-60+ steps, no additional text or markdown.`;


        const messages: LLMMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        const response = await this.generateCompletion(messages);
        return response.content;
    }
}
