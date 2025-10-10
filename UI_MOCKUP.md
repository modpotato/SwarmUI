# LLM Prompt Refinement - UI Mockup

This document provides a text-based representation of the UI elements and user flow.

## Main Interface Integration

### 1. Generate Tab - Prompt Area
```
┌─────────────────────────────────────────────────────────────────┐
│ Generate Tab                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [+]  Type your prompt here...                            │   │
│  │                                                          │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│      ▲                                                           │
│      │                                                           │
│      └─ Click this "+" button                                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Negative prompt (optional)...                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [Generate]  [⚡]  [×]                                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Prompt Tools Menu (After clicking "+")
```
┌────────────────────────────────────────┐
│ ● Refine with LLM                ← NEW │
│   Use an LLM to refine and improve    │
│   your prompt                          │
│                                        │
│ ● Auto Segment Refinement             │
│   Automatically segment and refine     │
│   part of an image                     │
│                                        │
│ ● Regional Prompt                      │
│   Supply a different prompt for        │
│   a sub-region of an image             │
│                                        │
│ ● Upload Prompt Image                  │
│   Upload an image to use as an         │
│   image-prompt                         │
│                                        │
│ ● Other...                             │
│   Add some other prompt syntax         │
└────────────────────────────────────────┘
```

## 3. LLM Refinement Modal

### Initial State
```
┌─────────────────────────────────────────────────────────────────┐
│ Refine Prompt with LLM                                      [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Use an LLM (via OpenRouter) to refine and improve your prompt   │
│ or convert image tags into a coherent prompt.                   │
│                                                                   │
│ The source will be automatically detected: if an image is        │
│ selected, it will use the image tags; otherwise, it will use     │
│ your current prompt text.                                        │
│                                                                   │
│ ────────────────────────────────────────────────────────────    │
│                                                                   │
│ Select Model:                                                    │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Recommended                            ▼                │     │
│ │   • Claude 3.5 Sonnet                                   │     │
│ │   • GPT-4 Turbo                                         │     │
│ │   • Gemini Pro                                          │     │
│ │   • Llama 3 70B                                         │     │
│ │ Other Models                                            │     │
│ │   • (50+ more models...)                                │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│ Source: Current Prompt Text                                      │
│                                                                   │
│ Original:                                                        │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ a cute cat sitting on a chair                           │     │
│ │                                                          │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│                                                                   │
│                    [Refine]        [Close]                       │
└─────────────────────────────────────────────────────────────────┘
```

### During Refinement
```
┌─────────────────────────────────────────────────────────────────┐
│ Refine Prompt with LLM                                      [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Select Model: Claude 3.5 Sonnet                          ▼      │
│                                                                   │
│ Source: Current Prompt Text                                      │
│                                                                   │
│ Original:                                                        │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ a cute cat sitting on a chair                           │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│ ⏳ Refining prompt...                                            │
│                                                                   │
│                  [Refine] (disabled)   [Close]                   │
└─────────────────────────────────────────────────────────────────┘
```

### After Refinement (Success)
```
┌─────────────────────────────────────────────────────────────────┐
│ Refine Prompt with LLM                                      [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Select Model: Claude 3.5 Sonnet                          ▼      │
│                                                                   │
│ Source: Current Prompt Text                                      │
│                                                                   │
│ Original:                                                        │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ a cute cat sitting on a chair                           │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│ Refined:                                                         │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ An adorable domestic cat comfortably sitting on a       │     │
│ │ wooden chair, soft natural lighting, detailed fur       │     │
│ │ texture, cozy indoor setting                            │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│ Changes:                                                         │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Removed: cute                                            │     │
│ │          a                                               │     │
│ │          on                                              │     │
│ │                                                          │     │
│ │ Added:   adorable                                        │     │
│ │          domestic                                        │     │
│ │          comfortably                                     │     │
│ │          wooden                                          │     │
│ │          soft                                            │     │
│ │          natural                                         │     │
│ │          lighting                                        │     │
│ │          detailed                                        │     │
│ │          fur                                             │     │
│ │          texture                                         │     │
│ │          cozy                                            │     │
│ │          indoor                                          │     │
│ │          setting                                         │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│ ✓ Refinement complete!                                           │
│                                                                   │
│              [Refine]  [Apply]  [Close]                          │
└─────────────────────────────────────────────────────────────────┘
```

## 4. User Settings - API Keys

### API Keys Section
```
┌─────────────────────────────────────────────────────────────────┐
│ User Tab > API Keys                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ To use remote APIs in SwarmUI, you must set the key for it.     │
│ If you have an API key for any of the below APIs, paste it      │
│ into the corresponding box and click 'Save'.                     │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ API         │ Status    │ Actions              │ Link     │   │
│ ├─────────────┼───────────┼──────────────────────┼──────────┤   │
│ │ Stability   │ not set   │ [key input] [Save]   │ [Create] │   │
│ │             │           │ [Remove] (disabled)  │          │   │
│ ├─────────────┼───────────┼──────────────────────┼──────────┤   │
│ │ Civitai     │ set       │ [key input] [Save]   │ [Create] │   │
│ │             │           │ [Remove]             │          │   │
│ ├─────────────┼───────────┼──────────────────────┼──────────┤   │
│ │ OpenRouter  │ not set   │ [key input] [Save]   │ [Create] │   │
│ │   ← NEW     │           │ [Remove] (disabled)  │          │   │
│ │             │           │                      │          │   │
│ │ Info: To use the LLM-based prompt refinement feature in      │
│ │ SwarmUI, you must set your OpenRouter API key. This will     │
│ │ allow you to refine prompts using various LLM models.        │
│ │ Access this feature via the '+' button next to the prompt.   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Example Diff Display (Detailed)

### Visual Diff with Color Coding
```
┌─────────────────────────────────────────────────────────────────┐
│ Changes:                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Removed:                                                         │
│  ┌────┬────┬────┬────┬────┐                                     │
│  │ a  │cute│on  │    │    │  (red background)                   │
│  └────┴────┴────┴────┴────┘                                     │
│                                                                   │
│ Added:                                                           │
│  ┌────────┬────────┬───────────┬────────┬────────┬──────┐       │
│  │adorable│domestic│comfortably│wooden  │soft    │natura│       │
│  └────────┴────────┴───────────┴────────┴────────┴──────┘       │
│  ┌────────┬────────┬───┬────────┬────┬────┬────────┐           │
│  │lighting│detailed│fur│texture │cozy│indo│setting │           │
│  └────────┴────────┴───┴────────┴────┴────┴────────┘           │
│                                    (green background)            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6. Complete User Journey

```
Step 1: User Types Prompt
┌──────────────────────────┐
│ Prompt: "cat"            │
└──────────────────────────┘

Step 2: Opens Refinement
[+] → "Refine with LLM"

Step 3: Selects Model
Model: Claude 3.5 Sonnet

Step 4: Clicks Refine
⏳ Processing...

Step 5: Reviews Result
Original: "cat"
Refined: "A domestic cat with detailed fur texture..."
Changes: Shows diff

Step 6: Applies
[Apply] → Prompt updated

Step 7: Generates
[Generate] → Creates image with refined prompt
```

## 7. Error States

### No API Key Configured
```
┌─────────────────────────────────────────────────────────────────┐
│ Refine Prompt with LLM                                      [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ⚠ Error: OpenRouter API key not set. Please configure it in     │
│    User Settings.                                                │
│                                                                   │
│    [Go to User Settings]                [Close]                 │
└─────────────────────────────────────────────────────────────────┘
```

### No Model Selected
```
┌─────────────────────────────────────────────────────────────────┐
│ Refine Prompt with LLM                                      [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ⚠ Error: Please select a model.                                 │
│                                                                   │
│ Select Model:                                                    │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Select a model...                               ▼       │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### API Error
```
┌─────────────────────────────────────────────────────────────────┐
│ Refine Prompt with LLM                                      [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ⚠ Error: Failed to refine prompt. Please try again.             │
│                                                                   │
│ Details: Network timeout (or other specific error)              │
│                                                                   │
│              [Try Again]              [Close]                    │
└─────────────────────────────────────────────────────────────────┘
```

## 8. Mobile/Responsive View

### Compact Modal View
```
┌────────────────────────────┐
│ Refine with LLM        [×] │
├────────────────────────────┤
│                            │
│ Model:                     │
│ ┌────────────────────┐     │
│ │ Claude 3.5      ▼ │     │
│ └────────────────────┘     │
│                            │
│ Source: Prompt Text        │
│                            │
│ Original:                  │
│ ┌────────────────────┐     │
│ │ cute cat           │     │
│ └────────────────────┘     │
│                            │
│ [Refine]                   │
│                            │
│ Refined:                   │
│ ┌────────────────────┐     │
│ │ adorable domestic  │     │
│ │ cat...             │     │
│ └────────────────────┘     │
│                            │
│ Changes: +12 -2 words      │
│                            │
│ [Apply]  [Close]           │
└────────────────────────────┘
```

---

## Color Legend

In actual implementation:
- **Red background**: Removed words
- **Green background**: Added words
- **Gray background**: Unchanged or context
- **Blue buttons**: Primary actions (Refine, Apply)
- **Gray buttons**: Secondary actions (Close)
- **Yellow/Orange**: Warning messages
- **Green checkmark**: Success indicators

## Animation States

1. **Loading**: Spinner animation during model fetch
2. **Processing**: Progress indicator during refinement
3. **Success**: Smooth reveal of results
4. **Error**: Shake animation for error messages
5. **Apply**: Fade out modal, update prompt box with animation

---

This mockup represents the complete user interface for the LLM Prompt Refinement feature!
