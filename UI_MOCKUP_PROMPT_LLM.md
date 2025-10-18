# Prompt LLM UI Mockup

## Modal Interface Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Prompt LLM                            ✕   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────┬──────────┬────────┐                                       │
│  │Refine│ Generate │ Blend  │  ← Three tabs for different modes    │
│  └──────┴──────────┴────────┘                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [Active Tab Content - See detailed views below]                    │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│  Error: [Error messages appear here]                                │
│  [Execute Button]  [Apply Button]  [Close]                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Refine Tab (Default)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Use an LLM to refine and improve your prompt or convert image      │
│  tags into a coherent prompt. The source will be automatically      │
│  detected: if an image is selected, it will use the image tags;     │
│  otherwise, it will use your current prompt text.                   │
├─────────────────────────────────────────────────────────────────────┤
│  Select Model:                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Recommended                                                  ▼│   │
│  │   anthropic/claude-3.5-sonnet                                │   │
│  │   openai/gpt-4-turbo                                         │   │
│  │ Other Models                                                  │   │
│  │   meta-llama/llama-3-70b-instruct                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Additional Instructions (optional):                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Add per-request guidance for the refiner...                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Default behavior is controlled from User Settings → LLM Refiner.   │
│                                                                       │
│  ☐ Bypass Vision (use text only)                                    │
│                                                                       │
│  Context Mode:                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ○ Replace prompt with image metadata                        ▼│   │
│  │ ○ Keep prompt, use image metadata as inspiration            │   │
│  │ ○ Append image metadata to current prompt                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Choose how to handle image metadata when available.                │
│                                                                       │
│  Source: Current Prompt Text                                         │
│                                                                       │
│  Original:                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ cat sitting on table, cute, sunny day                       │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  [After clicking Execute...]                                         │
│                                                                       │
│  Refined:                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1girl, cat, sitting, table, cute, masterpiece, best quality,│   │
│  │ natural lighting, sunny day, high resolution, detailed      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Changes:                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ REMOVED                                                      │   │
│  │  (none)                                                      │   │
│  │                                                              │   │
│  │ ADDED                                                        │   │
│  │  [1girl] [masterpiece] [best quality] [natural lighting]    │   │
│  │  [high resolution] [detailed]                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ✓ Refinement complete!                                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Generate Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│  Generate a complete prompt from a simple idea or keywords.          │
│  The LLM will create a detailed, coherent prompt based on your      │
│  input.                                                              │
├─────────────────────────────────────────────────────────────────────┤
│  Select Model:                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Recommended                                                  ▼│   │
│  │   anthropic/claude-3.5-sonnet                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Enter your idea or keywords:                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ fantasy warrior                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Style (optional):                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ anime                                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Detail Level:                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Moderate - Good balance                                     ▼│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  [After clicking Execute...]                                         │
│                                                                       │
│  Generated Prompt:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1girl, fantasy, warrior, anime style, armor, sword,         │   │
│  │ determined expression, long hair, flowing cape,             │   │
│  │ masterpiece, best quality, detailed armor design, epic      │   │
│  │ composition, dramatic lighting, high resolution             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ✓ Generation complete!                                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Blend Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│  Blend multiple prompts together to create a unique combination.     │
│  Mix styles, themes, and concepts from different prompts.           │
├─────────────────────────────────────────────────────────────────────┤
│  Select Model:                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Recommended                                                  ▼│   │
│  │   openai/gpt-4-turbo                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Prompt 1:                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1girl, magical girl, pink dress, wand, sparkles             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Prompt 2:                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ cyberpunk, futuristic, neon lights, city background         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Prompt 3 (optional):                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Blend Mode:                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Creative - Let the LLM be creative                          ▼│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  [After clicking Execute...]                                         │
│                                                                       │
│  Blended Prompt:                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1girl, magical girl, cyberpunk, futuristic magical outfit,  │   │
│  │ pink and neon color scheme, holographic wand, digital       │   │
│  │ sparkles, city background, neon lights, tech-fantasy        │   │
│  │ fusion, masterpiece, best quality, unique concept,          │   │
│  │ detailed design                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ✓ Blending complete!                                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Button Behavior

The Execute and Apply buttons adapt to the current tab:

| Tab      | Execute Button Does         | Apply Button Does              |
|----------|----------------------------|--------------------------------|
| Refine   | Calls `refinePrompt()`     | Calls `applyRefinedPrompt()`   |
| Generate | Calls `generatePrompt()`   | Calls `applyGeneratedPrompt()` |
| Blend    | Calls `blendPrompts()`     | Calls `applyBlendedPrompt()`   |

## Accessing the Feature

```
Generate Tab
  ↓
  Prompt Box
    ↓
    [+ Button]  ← Click here
      ↓
      ┌─────────────────────┐
      │ Prompt LLM          │ ← Updated label
      │ Auto Segment...     │
      │ Regional Prompt     │
      │ Upload Prompt Image │
      │ ...                 │
      └─────────────────────┘
```

## Color Scheme

### Diff Display

- **Added tags**: Green background (#7be495), bordered
- **Removed tags**: Red background (#ff9aa2), bordered
- **Labels**: 
  - "REMOVED": Red text (#ff9aa2)
  - "ADDED": Green text (#7be495)

### Status Messages

- **In Progress**: Gray (#666)
- **Success**: Green (#0a0)
- **Error**: Red (error styling)

### Result Displays

- **Original**: Light gray background (#f5f5f5)
- **Refined/Generated/Blended**: Light green background (#e8f5e9)

## Responsive Design

The modal is designed to work across different screen sizes:

- Desktop: Full-width modal with side-by-side elements
- Tablet: Stacked layout with full-width inputs
- Mobile: Single-column layout with scrollable content

### Mobile Layout (< 768px)

```
┌───────────────────────┐
│ Prompt LLM        [×] │
├───────────────────────┤
│ [Refine][Generate]    │
│ [Blend]               │
├───────────────────────┤
│                       │
│ Model:                │
│ ┌─────────────────┐   │
│ │ Claude 3.5   ▼ │   │
│ └─────────────────┘   │
│                       │
│ Instructions:         │
│ ┌─────────────────┐   │
│ │ (optional)      │   │
│ └─────────────────┘   │
│                       │
│ ☐ Bypass Vision      │
│                       │
│ Source: Prompt        │
│                       │
│ Original:             │
│ ┌─────────────────┐   │
│ │ cat on table    │   │
│ └─────────────────┘   │
│                       │
│ [Execute]             │
│                       │
│ ⏳ Processing...      │
│                       │
│ (Scroll for results)  │
│                       │
│ Refined:              │
│ ┌─────────────────┐   │
│ │ adorable cat... │   │
│ └─────────────────┘   │
│                       │
│ Changes:              │
│ +10 -2 words         │
│                       │
│ [Apply] [Close]       │
└───────────────────────┘
```

### Tablet Layout (768px - 1024px)

```
┌────────────────────────────────────┐
│ Prompt LLM                     [×] │
├────────────────────────────────────┤
│ ┌────┬────────┬────────┐          │
│ │Ref.│Generate│ Blend  │          │
│ └────┴────────┴────────┘          │
├────────────────────────────────────┤
│                                    │
│ Model:                             │
│ ┌──────────────────────────────┐   │
│ │ Recommended              ▼  │   │
│ └──────────────────────────────┘   │
│                                    │
│ Instructions: (optional)           │
│ ┌──────────────────────────────┐   │
│ │                              │   │
│ └──────────────────────────────┘   │
│                                    │
│ ☐ Bypass Vision                   │
│                                    │
│ Source: Current Prompt Text        │
│                                    │
│ Original:                          │
│ ┌──────────────────────────────┐   │
│ │ cat sitting on table         │   │
│ └──────────────────────────────┘   │
│                                    │
│ [Execute]                          │
│                                    │
│ Refined:                           │
│ ┌──────────────────────────────┐   │
│ │ adorable domestic cat...     │   │
│ └──────────────────────────────┘   │
│                                    │
│ Changes:                           │
│ REMOVED: (none)                    │
│ ADDED: [adorable][domestic]...    │
│                                    │
│ [Apply] [Close]                    │
└────────────────────────────────────┘
```

## Keyboard Shortcuts (Future Enhancement)

Potential shortcuts for power users:
- `Ctrl+Enter` in any text field: Execute action
- `Ctrl+A` when result visible: Apply result
- `Ctrl+Tab`: Switch between tabs
- `Esc`: Close modal

## Accessibility Features

- Proper ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader friendly status messages
- High contrast diff visualization
- Clear focus indicators
