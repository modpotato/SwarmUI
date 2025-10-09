# UI Updates - Vision Support and Configurable System Prompt

## Updated Modal Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│ Refine Prompt with LLM                                      [×]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Use an LLM (via OpenRouter) to refine and improve your prompt      │
│ or convert image tags into a coherent prompt.                      │
│                                                                      │
│ ────────────────────────────────────────────────────────────────    │
│                                                                      │
│ Select Model:                                                       │
│ ┌──────────────────────────────────────────────────────────┐       │
│ │ Recommended                                      ▼       │       │
│ │   • Claude 3.5 Sonnet (Vision ✓)                        │       │
│ │   • GPT-4 Turbo (Vision ✓)                              │       │
│ │   • Gemini Pro (Vision ✓)                               │       │
│ │   • Llama 3 70B (Vision ✗)                              │       │
│ │ Other Models                                             │       │
│ │   • (50+ more models...)                                 │       │
│ └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│ System Prompt (optional):          ◀─── NEW                        │
│ ┌──────────────────────────────────────────────────────────┐       │
│ │ Leave empty to use default system prompt...              │       │
│ │                                                           │       │
│ └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│ ☐ Bypass Vision (use text only)   ◀─── NEW                        │
│                                                                      │
│ Source: Image Tags from selected image                             │
│                                                                      │
│ Original:                                                           │
│ ┌──────────────────────────────────────────────────────────┐       │
│ │ cat, fluffy, sitting, outdoors, sunlight                 │       │
│ └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│ ⚠ Warning: Selected model may not support vision.          ◀─ NEW  │
│   "Bypass Vision" has been enabled.                                │
│                                                                      │
│                                                                      │
│                [Refine]  [Apply]  [Close]                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Changes Highlighted

### 1. System Prompt Field (NEW)
```
┌─────────────────────────────────────────────────────────┐
│ System Prompt (optional):                               │
│ ┌───────────────────────────────────────────────────┐  │
│ │ You are an expert prompt engineer. Take the       │  │
│ │ user's input and transform it into a detailed     │  │
│ │ prompt optimized for image generation...          │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

• Users can provide custom instructions
• If empty, uses intelligent defaults based on source type
• Supports full customization of LLM behavior
```

### 2. Vision Bypass Checkbox (NEW)
```
┌──────────────────────────────────────────────┐
│ ☑ Bypass Vision (use text only)             │
│                                              │
│ Tooltip: "If checked, will not attempt to   │
│ send image data even when available (useful  │
│ for non-vision models)"                      │
└──────────────────────────────────────────────┘

• Manually force text-only mode
• Auto-enabled when non-vision model selected for image input
• Prevents API errors for vision-incapable models
```

### 3. Model Selection with Vision Indicators (ENHANCED)
```
Select Model:
┌────────────────────────────────────────┐
│ Recommended                    ▼       │
│   • Claude 3.5 Sonnet (Vision ✓)      │ ◀─ Vision capable
│   • GPT-4 Turbo (Vision ✓)            │ ◀─ Vision capable
│   • Gemini Pro (Vision ✓)             │ ◀─ Vision capable  
│   • Llama 3 70B (Vision ✗)            │ ◀─ Text only
│ Other Models                           │
│   • Mistral Large (Vision ✗)          │ ◀─ Text only
│   • Pixtral 12B (Vision ✓)            │ ◀─ Vision capable
└────────────────────────────────────────┘

• Vision support automatically detected
• Metadata stored in option elements
• Used for automatic bypass suggestions
```

### 4. Smart Warning System (NEW)
```
┌───────────────────────────────────────────────────────┐
│ Status Area (color-coded):                            │
│                                                        │
│ ⚠ Warning: Selected model may not support vision.    │
│   "Bypass Vision" has been enabled.                   │
│   (Orange text #ff8800)                               │
│                                                        │
│ OR                                                     │
│                                                        │
│ ⏳ Refining prompt...                                 │
│   (Gray text #666)                                    │
│                                                        │
│ OR                                                     │
│                                                        │
│ ✓ Refinement complete!                                │
│   (Green text #0a0)                                   │
└───────────────────────────────────────────────────────┘
```

## Flow Diagram: Vision Support Detection

```
User selects model
       ↓
Check if model has vision support
       ↓
       ├─ YES (Vision ✓) ──────────────┐
       │                                ↓
       │                         No warning
       │                         User can choose
       │                                ↓
       └─ NO (Vision ✗) ────────────────┼─ Source is image?
                                        │
                                        ├─ YES ──→ Auto-check bypass
                                        │         Show warning
                                        │
                                        └─ NO ──→ No action needed
```

## Example Use Cases

### Use Case 1: Custom Prompt for Anime Style
```
System Prompt:
"You are an anime art expert. Transform the user's prompt into 
a detailed anime-style image generation prompt. Include specific 
anime art characteristics, lighting, and composition details."

Result: Specialized refinement for anime aesthetics
```

### Use Case 2: Non-Vision Model with Image Tags
```
Selected: Llama 3 70B (no vision)
Source: Image tags from selected image

Action taken:
1. Detect model doesn't support vision
2. Auto-enable "Bypass Vision" checkbox
3. Show warning message
4. Process as text-only (image tags as text)

Result: Prevents API errors, smooth experience
```

### Use Case 3: Vision Model with Custom Instructions
```
Selected: Claude 3.5 Sonnet (vision)
Source: Image tags
System Prompt: "Focus on enhancing color descriptions and mood"

Result: Refined prompt emphasizes colors and atmosphere
```

## Technical Implementation Details

### Backend Vision Detection Logic
```csharp
// Check if model supports vision/multimodal
bool supportsVision = false;
JToken architecture = model["architecture"];
if (architecture != null)
{
    string archStr = architecture.ToString().ToLower();
    supportsVision = archStr.Contains("vision") || 
                     archStr.Contains("multimodal");
}

// Also check model ID for common vision models
string modelId = model["id"]?.ToString() ?? "";
if (modelId.Contains("vision") || 
    modelId.Contains("gpt-4") || 
    modelId.Contains("claude-3") || 
    modelId.Contains("gemini") || 
    modelId.Contains("pixtral"))
{
    supportsVision = true;
}
```

### Frontend Auto-Bypass Logic
```javascript
checkVisionSupport() {
    let selectedOption = modelSelect.options[modelSelect.selectedIndex];
    let supportsVision = selectedOption.dataset.supportsVision === 'true';

    // Auto-enable bypass if model doesn't support vision
    if (this.currentSourceType === 'image_tags' && 
        !supportsVision && 
        !bypassCheckbox.checked) {
        
        statusDiv.textContent = 'Warning: Selected model may not support vision. "Bypass Vision" has been enabled.';
        statusDiv.style.color = '#ff8800';
        bypassCheckbox.checked = true;
    }
}
```

## API Request Example (New Parameters)

### Before
```json
{
  "modelId": "anthropic/claude-3.5-sonnet",
  "sourceText": "cat, fluffy, sitting",
  "isImageTags": true
}
```

### After (with new features)
```json
{
  "modelId": "meta-llama/llama-3-70b-instruct",
  "sourceText": "cat, fluffy, sitting",
  "isImageTags": true,
  "systemPrompt": "You are a creative writing expert...",
  "bypassVision": true
}
```

---

## Summary of Improvements

✅ **Flexibility**: Users can customize LLM behavior with system prompts  
✅ **Compatibility**: Automatic detection prevents vision API errors  
✅ **User Control**: Manual bypass option for advanced users  
✅ **Smart Warnings**: Proactive feedback about model capabilities  
✅ **Seamless UX**: Auto-configuration reduces friction  

All changes are backward compatible and enhance the existing feature!
