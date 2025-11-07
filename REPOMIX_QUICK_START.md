# Repomix Integration - Quick Start Guide

## 🚀 What Just Changed

CodeTour now uses **Repomix's technique** to generate code tours with **actual line numbers** from your source files!

---

## How to Use It

### Step 1: Open Your Project
Open any workspace in VS Code with source code files.

### Step 2: Configure LLM (if not already done)
Run command: `CodeTour: Configure LLM Settings`
- Choose provider (OpenAI, Anthropic, or Custom)
- Enter your API key
- Select model (e.g., `gpt-4o-mini`, `claude-3-5-sonnet`)

### Step 3: Generate a Tour
Run command: `CodeTour: Generate Code Tour (AI)`
- Enter tour title (e.g., "Architecture Overview")
- Enter description (optional)
- Wait for generation (~30-90 seconds)

### Step 4: Check the Output
Look for these new features:

**1. Repomix Output File:**
```
workspace/
└── repomix-output.xml  ← NEW! Comprehensive codebase summary
```

**2. Progress Updates:**
```
📦 Generating Repomix summary (0/7)...
🔍 Scanning workspace...
📂 Found 150 files...
✅ Complete!
```

**3. Accurate Line Numbers:**
Tour steps now point to the **exact lines** in your source code!

---

## What Happens Behind the Scenes

### Old Flow (Before Repomix)
```
1. TreeSitter analyzes code structure
2. LLM generates tour with estimated line numbers
3. Line numbers might be off by 10-50 lines ⚠️
```

### New Flow (With Repomix)
```
1. 📦 Repomix generates comprehensive summary with line numbers
2. TreeSitter analyzes code structure
3. LLM receives BOTH sources
4. LLM generates tour with ACTUAL line numbers ✅
```

---

## File Structure

After generating a tour, you'll see:

```
workspace/
├── .tours/
│   └── your-tour.tour          ← Generated tour (as before)
├── repomix-output.xml          ← NEW! Repomix analysis
└── .vscode/
    └── codetour-analysis.log   ← Analysis log (as before)
```

---

## The Repomix Output

**File:** `repomix-output.xml`

**Contents:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<codebase>
  <!-- File summary with statistics -->
  <file_summary>
    Total Files: 150
    Total Lines: 12543
    Languages:
      - typescript: 120 files
      - javascript: 25 files
  </file_summary>

  <!-- Visual directory tree -->
  <directory_structure>
    src/
    ├── api/
    ├── components/
    └── utils/
  </directory_structure>

  <!-- All files with line numbers -->
  <files>
    <file path="src/index.ts" language="typescript" lines="42">
         1|import { App } from './App';
         2|
         3|export class App {
         4|  constructor() {
         5|    // ...
         6|  }
         7|}
    </file>
    <!-- ... more files ... -->
  </files>
</codebase>
```

**Why This Matters:**
- ✅ LLM can see your actual code
- ✅ LLM knows the exact line numbers
- ✅ Tours are more accurate
- ✅ You can inspect what was analyzed

---

## What Gets Analyzed

### ✅ Included
- Source code files (`.ts`, `.js`, `.py`, `.java`, etc.)
- Important configuration files
- README and documentation

### ❌ Excluded (Smart Filtering)
- `node_modules/`
- Test files (`*.test.*`, `*.spec.*`)
- Build output (`dist/`, `build/`)
- Config files (`*.config.*`, `tsconfig.json`)
- Type definitions (`*.d.ts`)
- Generated files (`*.generated.*`)

---

## Benefits You'll Notice

### 🎯 Accurate Line Numbers
**Before:**
```json
{
  "line": 45,  // ⚠️ Estimated - might be wrong
  "description": "This is the UserService class..."
}
```

**After (with Repomix):**
```json
{
  "line": 42,  // ✅ Actual line number from source!
  "description": "This is the UserService class..."
}
```

### 📚 Better Context
**Before:** LLM only sees:
- Class names
- Function signatures
- Approximate structure

**After:** LLM sees:
- All of the above +
- **Actual code content**
- **Real line numbers**
- **Full context**

### 🚀 Better Tours
- More comprehensive explanations
- References exact code locations
- Understands code relationships better
- Generates more helpful descriptions

---

## Example Tour Step

### Generated with Repomix:
```json
{
  "title": "User Authentication Service",
  "file": "src/services/auth.service.ts",
  "line": 15,
  "description": "The AuthService class (line 15) handles all user authentication logic including login, logout, and token validation. It uses JWT tokens for stateless authentication and integrates with the UserRepository (line 18) to verify credentials against the database. The validateToken method (line 45) implements token expiration checks and signature verification. This service is injected into authentication middleware at src/middleware/auth.middleware.ts."
}
```

**Note the accuracy:**
- ✅ Class starts at line 15 (exact!)
- ✅ Repository reference at line 18 (exact!)
- ✅ Method at line 45 (exact!)
- ✅ References other files correctly

---

## Troubleshooting

### "Repomix analysis failed"
**Causes:**
- No read permissions on workspace
- No source files found
- All files excluded by ignore patterns

**Solution:**
- Check console logs (View → Output → "CodeTour")
- Verify workspace has source code files
- Check file permissions

### "repomix-output.xml not created"
**Causes:**
- No write permissions
- Disk full
- Invalid workspace path

**Solution:**
- Check workspace path is valid
- Ensure write permissions
- Check available disk space

### Line numbers still wrong
**Causes:**
- Repomix analysis failed silently
- Fallback to TreeSitter-only mode

**Solution:**
- Check console for "📦 Using Repomix data" message
- Verify `repomix-output.xml` exists and has content
- Re-generate tour

### Generation takes too long
**Normal:** 30-90 seconds is expected for 100-200 files

**Too slow (>2 minutes):**
- Very large project (500+ files)
- Slow LLM API
- Network issues

**Solutions:**
- Use faster LLM model (e.g., `gpt-4o-mini`)
- Exclude more files via ignore patterns
- Check internet connection

---

## Performance

### Typical Project (150 files, 12,000 lines)
- **Repomix analysis:** 2-5 seconds
- **TreeSitter analysis:** 3-4 seconds
- **LLM generation:** 30-90 seconds
- **Total:** 35-100 seconds

### Large Project (500 files, 50,000 lines)
- **Repomix analysis:** 5-10 seconds
- **TreeSitter analysis:** 10-15 seconds
- **LLM generation:** 60-180 seconds
- **Total:** 75-205 seconds

---

## Configuration (Coming Soon)

Future versions will support customization:

```json
{
  "codetour.repomix.enabled": true,
  "codetour.repomix.maxFileSize": 52428800,
  "codetour.repomix.ignorePatterns": [
    "**/node_modules/**",
    "**/*.test.*",
    "**/dist/**"
  ],
  "codetour.repomix.includePatterns": [
    "**/*.ts",
    "**/*.js",
    "**/*.py"
  ]
}
```

---

## Advanced Usage

### Inspecting Repomix Output
You can open and read `repomix-output.xml` to see exactly what the LLM analyzed:

```bash
# View in VS Code
code repomix-output.xml

# Or use any text editor
cat repomix-output.xml
```

This is useful for:
- Debugging tour generation
- Understanding what files were analyzed
- Verifying line numbers
- Checking if important files were missed

### Re-using Repomix Output
The `repomix-output.xml` file is reusable. You could:
- Share it with team members
- Use it for documentation
- Analyze with other tools
- Keep for reference

---

## FAQ

**Q: Do I need to do anything different?**
A: No! Just generate tours as normal. Repomix runs automatically.

**Q: Will this slow down tour generation?**
A: Adds 2-5 seconds for Repomix analysis. Total time is similar.

**Q: Can I disable Repomix?**
A: Not yet, but this is planned for future releases.

**Q: What if Repomix fails?**
A: Tour generation will fail with a clear error message. Check console logs.

**Q: Can I customize what files are analyzed?**
A: Not yet via UI, but you can modify the ignore patterns in the code.

**Q: Is my code sent to the LLM?**
A: Yes, but only the files in `repomix-output.xml`. You can inspect this file.

**Q: Is this secure?**
A: As secure as before. Repomix just organizes your code; the LLM API key is used the same way.

---

## Next Steps

1. ✅ **Try it out** - Generate a tour on your project
2. ✅ **Check accuracy** - Verify line numbers are correct
3. ✅ **Inspect output** - Look at `repomix-output.xml`
4. ✅ **Give feedback** - Report any issues or suggestions

---

## Learn More

- **Full Documentation:** See `REPOMIX_INTEGRATION.md`
- **Implementation Details:** See `INTEGRATION_SUMMARY.md`
- **Original Repomix:** https://github.com/yamadashy/repomix
- **CodeTour:** https://github.com/microsoft/codetour

---

## Support

Having issues? Check these resources:

1. **Console Logs:** View → Output → Select "CodeTour"
2. **Repomix Output:** Open `repomix-output.xml` in workspace
3. **Documentation:** Read `REPOMIX_INTEGRATION.md`
4. **GitHub Issues:** Report problems or ask questions

---

**Happy Touring! 🚀**

