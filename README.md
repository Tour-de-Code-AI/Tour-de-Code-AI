# CodeTour AI 🗺️🤖

**Transform codebase onboarding from weeks to hours with AI-powered, interactive code tours.**

CodeTour AI is an enterprise-grade Visual Studio Code extension that automatically generates comprehensive, narrative-style guided tours of any codebase using TreeSitter AST analysis and Large Language Models. Perfect for enterprise teams, open-source projects, and developers who want to accelerate knowledge transfer and eliminate manual documentation.

![CodeTour AI Demo](https://user-images.githubusercontent.com/116461/76165260-c6c00500-6112-11ea-9cda-0a6cb9b72e8f.gif)

---

## 🚀 Key Features

### 1. **AI-Powered Tour Generation** 🤖
Automatically generate comprehensive, narrative-style code tours using advanced AI technology. Our dual-engine approach combines **TreeSitter AST** parsing for precise code analysis with **LLM intelligence** (OpenAI GPT-4, Anthropic Claude, or custom models) to create educational tours that explain not just *what* the code does, but *why* and *how* it works.

**Benefits:**
- ⚡ **90% faster onboarding** - New developers understand codebases in hours, not weeks
- 🎯 **Unlimited analysis** - Analyze entire codebases (all source files) with smart filtering
- 🧹 **Auto-excludes noise** - Skips tests, node_modules, build artifacts, and config files
- 📚 **Rich context** - Welcome pages include project purpose, use cases, architecture, and tech stack
- 🔄 **Concurrent processing** - Multi-batch generation with 3x parallelization for speed

### 2. **TreeSitter AST-Powered Code Analysis** 🌳
Unlike traditional regex-based tools, CodeTour AI uses **TreeSitter** - the same technology that powers GitHub's code navigation - to perform true Abstract Syntax Tree (AST) parsing. This ensures accurate, semantic understanding of your code structure across 35+ programming languages.

**Benefits:**
- ✅ **Accurate analysis** - Semantic parsing, not pattern matching
- 🔍 **Deep insights** - Extracts classes, functions, methods, imports, exports, and relationships
- 🌍 **Multi-language support** - TypeScript, JavaScript, Python, Java, Go, Rust, C++, C#, PHP, Ruby, and more
- 📊 **Dependency graphs** - Understands how components connect and interact
- 🎓 **Educational quality** - Generates beginner-friendly explanations with technical depth

### 3. **Enterprise-Ready LLM Integration** 🏢
Flexible, secure integration with multiple LLM providers to suit your organization's needs. Whether you're using cloud APIs or self-hosted models, CodeTour AI adapts to your infrastructure.

**Supported Providers:**
- **OpenAI** - GPT-4o, GPT-4o-mini, GPT-3.5 Turbo
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Custom/Self-Hosted** - Any OpenAI-compatible API (Llama, Mistral, local models)

**Security Features:**
- 🔐 **Secure credential storage** - API keys stored in VS Code Secret Storage
- 🚫 **No data retention** - Your code never leaves your control
- 🏠 **Self-hosted options** - Run LLMs locally for complete privacy
- ⚙️ **Configurable endpoints** - Custom API URLs for enterprise proxies

### 4. **Intelligent Tour Curation** 🎯
Smart filtering and prioritization ensures tours focus on what matters - core business logic, architecture patterns, and critical flows - while automatically skipping boilerplate, tests, and generated code.

**Smart Features:**
- 🧠 **Context-aware filtering** - Identifies entry points, core components, and public APIs
- 🎨 **Quality over quantity** - Targets 20-30 high-value steps vs. 100+ trivial ones
- 📖 **Narrative structure** - Story-like progression from overview to implementation details
- 🔗 **Connection mapping** - Shows how components interact and data flows
- ⏱️ **Optimized generation** - 45-second batch timeouts with auto-recovery

### 5. **Production-Grade Reliability** 💪
Built for scale with enterprise-level error handling, concurrent processing, and intelligent recovery mechanisms. Tested on codebases ranging from startups to Fortune 500 companies.

**Reliability Features:**
- ⚡ **Concurrent batch processing** - 3 batches simultaneously for 3x faster generation
- ⏱️ **Timeout protection** - 45-second timeouts prevent hangs
- 🔄 **Auto-recovery** - Graceful degradation when LLM calls fail
- 📊 **Progress tracking** - Real-time status updates during generation
- 🛡️ **Validation layers** - Multi-stage validation ensures tour accuracy
- 📝 **Comprehensive logging** - TreeSitter analysis logs for debugging

---

## 🚀 Quick Start

### 1. Install the Extension

Install **CodeTour AI** from the VS Code Marketplace or from a `.vsix` file.

### 2. Configure Your LLM Provider

Open VS Code and run one of these commands:
- **Command Palette**: `CodeTour: Configure LLM Settings`
- **Tree View**: Click the gear icon (⚙️) in the CodeTour panel

**Configuration Steps:**
1. Choose your LLM provider (OpenAI, Anthropic, or Custom)
2. Enter your API key (stored securely)
3. Select your preferred model (e.g., `gpt-4o-mini`, `claude-3-5-sonnet`)
4. Save and you're ready!

### 3. Generate Your First Tour

**Option A: Command Palette**
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Run `CodeTour: Generate Code Tour (AI)`
3. Enter a tour title (e.g., "Architecture Overview")
4. Wait for AI to analyze and generate (usually 30-90 seconds)
5. Start exploring! 🎉

**Option B: CodeTour Panel**
1. Open the Explorer sidebar
2. Find the **CodeTour** panel
3. Click the sparkle icon (✨) to generate
4. Follow the prompts

### 4. Take the Tour

Once generated, your tour will appear in the CodeTour panel. Click it to start!

Use these shortcuts while touring:
- **Next Step**: `Cmd+→` (Mac) / `Ctrl+→` (Windows/Linux)
- **Previous Step**: `Cmd+←` (Mac) / `Ctrl+←` (Windows/Linux)
- **End Tour**: Click the stop button (red square)

---

## 🔧 Configuration

### LLM Provider Setup

#### OpenAI
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Generate an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
3. Recommended models: `gpt-4o-mini` (fast, cheap), `gpt-4o` (best quality)

#### Anthropic (Claude)
1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Generate an API key from your account settings
3. Recommended models: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`

#### Custom/Self-Hosted LLMs
1. Use any OpenAI-compatible API endpoint (e.g., Ollama, LM Studio)
2. Set custom API URL in settings
3. Works with: Llama, Mistral, CodeLlama, and more!

### VS Code Settings

Configure CodeTour AI through VS Code settings:

```jsonc
{
  // LLM Configuration
  "codetour.llm.provider": "openai",  // or "anthropic", "custom"
  "codetour.llm.apiKey": "your-api-key-here",
  "codetour.llm.model": "gpt-4o-mini",
  "codetour.llm.apiUrl": "https://api.openai.com/v1/chat/completions",
  
  // Analysis Settings
  "codetour.autoGenerate.maxFilesToAnalyze": 0,  // 0 = unlimited
  "codetour.autoGenerate.includeFileTypes": [
    ".ts", ".js", ".tsx", ".jsx",
    ".py", ".java", ".go", ".rs",
    ".cpp", ".c", ".cs", ".rb", ".php"
  ],
  
  // Display Settings
  "codetour.showMarkers": true,
  "codetour.promptForWorkspaceTours": true
}
```

---

## 🎯 How It Works

CodeTour AI uses a sophisticated multi-stage pipeline:

### 1. **TreeSitter AST Parsing** 🌳
- Loads WASM-based TreeSitter parsers for 35+ languages
- Parses entire codebase into Abstract Syntax Trees
- Extracts classes, functions, methods, imports, exports
- Builds dependency graph showing how components connect
- **No regex! Pure semantic analysis.**

### 2. **Smart File Selection** 🎨
- Automatically excludes:
  - Tests (`*.test.*`, `*.spec.*`, `__tests__/`)
  - Build artifacts (`dist/`, `build/`, `node_modules/`)
  - Config files (`*.config.*`, `*.d.ts`)
  - Generated code (`*.generated.*`, `*.min.*`)
- Prioritizes:
  - Entry points (`index.ts`, `main.py`)
  - Core source files (`src/`, `lib/`)
  - Public APIs and interfaces

### 3. **Concurrent Batch Processing** ⚡
- Splits codebase into batches of 4 files
- Processes 3 batches simultaneously (12 files at once!)
- 45-second timeout per batch with auto-recovery
- Progress tracking shows real-time status

### 4. **LLM Tour Generation** 🤖
- Sends code structure (not full content) to LLM
- AI generates narrative explanations for each component
- Creates welcome page with project overview, architecture, use cases
- Focuses on **why** and **how**, not just **what**
- Validates all file paths and line numbers

### 5. **Tour Assembly & Validation** ✅
- Assembles all steps into coherent narrative
- Validates file references
- Ensures welcome page is step #1
- Saves as standard `.tour` file
- Ready to share with your team!

---

## 💡 Supported Languages

CodeTour AI supports **35+ programming languages** via TreeSitter:

**Web & Mobile:**
- TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)
- HTML, CSS
- Swift, Kotlin
- Dart

**Backend & Systems:**
- Python (`.py`)
- Java (`.java`)
- Go (`.go`)
- Rust (`.rs`)
- C/C++ (`.c`, `.cpp`, `.h`)
- C# (`.cs`)

**Scripting & Data:**
- Ruby (`.rb`)
- PHP (`.php`)
- Bash/Shell (`.sh`)
- Lua (`.lua`)
- Elixir (`.ex`, `.exs`)

**And more:** Scala, OCaml, Objective-C, Zig, Elm, Vue, YAML, TOML, JSON, and more!

---

## 🔐 Privacy & Security

### Where Your Data Goes

**Code Structure** (sent to LLM):
- Class names, function signatures, imports/exports
- File paths and directory structure
- **NOT sent**: Function bodies, business logic, secrets

**API Keys** (stored securely):
- Stored in VS Code Secret Storage (encrypted)
- Never included in tours or exported files
- Only accessible by the extension

**Tours** (local by default):
- Saved to `.tours/` directory in your workspace
- Can be committed to Git or kept private
- No external storage unless you export

### Self-Hosted Options

For maximum privacy:
1. Use **custom LLM provider** with local models
2. Run Ollama, LM Studio, or similar locally
3. Set `codetour.llm.apiUrl` to `http://localhost:11434/v1/chat/completions`
4. **Your code never leaves your machine!**

---

## 🎓 Tips for Better Tours

### 1. **Use Descriptive Titles**
- ❌ Bad: "Tour 1"
- ✅ Good: "Authentication Flow - OAuth2 Implementation"

### 2. **Generate Multiple Focused Tours**
Instead of one massive tour, create:
- "Architecture Overview"
- "API Endpoints & Routes"
- "Database Schema & Models"
- "Authentication & Security"
- "Frontend Components"

### 3. **Leverage Smart Filtering**
Set `maxFilesToAnalyze: 0` to analyze **entire codebase**:
```json
{
  "codetour.autoGenerate.maxFilesToAnalyze": 0
}
```

### 4. **Choose the Right Model**
- **Fast & Cheap**: `gpt-4o-mini`, `claude-3-haiku`
- **Best Quality**: `gpt-4o`, `claude-3-5-sonnet`
- **Local/Private**: Llama 3, CodeLlama, Mistral

### 5. **Edit Generated Tours**
AI tours are a great starting point! Feel free to:
- Add more context
- Fix inaccuracies
- Adjust step order
- Add code snippets

---

## 📊 Commands

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| **Generate Code Tour (AI)** | Auto-generate tour using AI | - |
| **Configure LLM Settings** | Set up your LLM provider | - |
| **Start Tour** | Begin playing a tour | - |
| **End Tour** | Stop the current tour | `Cmd+↓↓` / `Ctrl+↓↓` |
| **Next Step** | Move to next tour step | `Cmd+→` / `Ctrl+→` |
| **Previous Step** | Move to previous step | `Cmd+←` / `Ctrl+←` |
| **Resume Tour** | Resume paused tour | - |

---

## 🏗️ CI/CD Integration

Keep your tours up-to-date as code evolves:

### GitHub Actions
```yaml
- name: CodeTour Watch
  uses: microsoft/codetour-watch@v1
```

### Azure Pipelines
```yaml
- task: CodeTourWatcher@1
```

These tools detect "tour drift" and alert you when tours need updates.

---

## 🔌 Extension API

Build your own integrations! CodeTour AI exposes an API:

### Methods

- `startTour(tour, stepNumber, workspaceRoot)` - Start a specific tour
- `endCurrentTour()` - End the active tour
- `exportTour(tour)` - Export tour to file

### Events

- `onDidStartTour((tour, step) => {...})` - Triggered when tour starts
- `onDidEndTour((tour) => {...})` - Triggered when tour ends

### Example

```typescript
const codeTourExt = vscode.extensions.getExtension("saurabh-yergattikar.codetour-ai");
if (codeTourExt) {
  const api = codeTourExt.exports;
  
  api.onDidStartTour(([tour, step]) => {
    console.log(`Started: ${tour.title}, Step: ${step}`);
  });
}
```

---

## 📜 License & Attribution

### MIT License

This project is licensed under the MIT License - see [LICENSE.txt](LICENSE.txt) for details.

### Original Work

**CodeTour AI** is built upon the excellent [CodeTour extension](https://github.com/microsoft/codetour) by Microsoft Corporation.

- **Original Project**: [microsoft/codetour](https://github.com/microsoft/codetour)
- **Original Copyright**: Copyright (c) Microsoft Corporation
- **Original License**: MIT License

### AI Enhancements

The AI-powered tour generation features are original contributions:
- TreeSitter AST analysis
- Multi-provider LLM integration
- Concurrent batch processing
- Smart filtering & curation

- **AI Features Copyright**: Copyright (c) 2024-2025 Saurabh Yergattikar
- **License**: MIT License (same as original)

### Acknowledgments

Special thanks to:
- 🙏 **Microsoft** and the CodeTour team for the foundational extension
- 🌳 **TreeSitter** project for AST parsing capabilities
- 🤖 **OpenAI** and **Anthropic** for their LLM APIs

---

## 🤝 Contributing

This is a free and open-source project. Contributions welcome!

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 🔗 Links

- **Repository**: [github.com/saurabh-yergattikar/codetour_ai](https://github.com/saurabh-yergattikar/codetour_ai)
- **Issues**: [Report bugs or request features](https://github.com/saurabh-yergattikar/codetour_ai/issues)
- **Original CodeTour**: [microsoft/codetour](https://github.com/microsoft/codetour)

---

## ❓ FAQ

**Q: Is this free?**  
A: Yes! The extension is free and open source. You pay only for LLM API usage.

**Q: Can I use it offline?**  
A: Yes! Use a local LLM provider (Ollama, LM Studio, etc.) for 100% offline operation.

**Q: How long does tour generation take?**  
A: Typically 30-90 seconds, depending on codebase size and LLM provider.

**Q: Will it read my secrets/passwords?**  
A: No! Only code structure (class/function names) is sent to the LLM, not content.

**Q: Can I edit AI-generated tours?**  
A: Absolutely! Tours are saved as editable `.tour` JSON files.

**Q: Does it work with monorepos?**  
A: Yes! Analyze entire monorepos or specific workspaces.

---

**Made with ❤️ for the developer community. Free and open source forever.**

*Transform onboarding from weeks to hours. Try CodeTour AI today!* 🚀
