# Agentic Imagen - UI Mockup

This document provides a text-based visualization of the Agentic Imagen widget UI.

## Widget Layout (Expanded State)

```
┌─────────────────────────────────────────────────────────────┐
│ ≡ Agentic Imagen                                    [ _ ][ × ]│ ← Draggable Header
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─ Configuration ───────────────────────────────────────┐   │
│ │                                                        │   │
│ │ Target Image:                                          │   │
│ │ ┌──────────────────────────────┐                      │   │
│ │ │ [Choose File]                │  or                  │   │
│ │ └──────────────────────────────┘                      │   │
│ │ ┌──────────────────────────────────────────────────┐  │   │
│ │ │ Paste image URL...                               │  │   │
│ │ └──────────────────────────────────────────────────┘  │   │
│ │                                                        │   │
│ │ ┌─────────────────────────────────────┐               │   │
│ │ │ [Preview Image]                     │               │   │
│ │ │                                     │               │   │
│ │ └─────────────────────────────────────┘               │   │
│ │ [ Clear Image ]                                        │   │
│ │                                                        │   │
│ │ Tags / Description (optional):                         │   │
│ │ ┌──────────────────────────────────────────────────┐  │   │
│ │ │ Enter tags or description...                     │  │   │
│ │ └──────────────────────────────────────────────────┘  │   │
│ │                                                        │   │
│ │ Turn A Model (Prompt Engineer):                        │   │
│ │ ┌──────────────────────────────────────────────────┐  │   │
│ │ │ anthropic/claude-3.5-sonnet            ▼         │  │   │
│ │ └──────────────────────────────────────────────────┘  │   │
│ │                                                        │   │
│ │ Turn B Model (Critic):                                 │   │
│ │ ┌──────────────────────────────────────────────────┐  │   │
│ │ │ anthropic/claude-3.5-sonnet            ▼         │  │   │
│ │ └──────────────────────────────────────────────────┘  │   │
│ │                                                        │   │
│ │ Max Iterations (cap, not target): [5]                  │   │
│ │ Note: Turn B may stop earlier if satisfied.            │   │
│ │                                                        │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌─ Chat Transcript ──────────────────────────────────────┐   │
│ │ ╔═══════════════════════════════════════════════════╗ │   │
│ │ ║ System                                            ║ │   │
│ │ ║ Starting Agentic Imagen refinement...             ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ System                                            ║ │   │
│ │ ║ --- Iteration 1 / 5 ---                           ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ Turn A (Prompt Engineer)                          ║ │   │
│ │ ║ Analyzing target and crafting prompts...          ║ │   │
│ │ ║ Turn A: I'll set an initial prompt...             ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ Tool Call                                         ║ │   │
│ │ ║ Tool: set_positive_prompt({"text": "master..."})  ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ Tool Call                                         ║ │   │
│ │ ║ Tool: set_aspect_ratio({"ratio": "3:4"})          ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ Tool Call                                         ║ │   │
│ │ ║ Tool: generate_image({})                          ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ System                                            ║ │   │
│ │ ║ Generating image...                               ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ System                                            ║ │   │
│ │ ║ Generated 1 image(s)                              ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ Turn B (Critic)                                   ║ │   │
│ │ ║ Evaluating generated images...                    ║ │   │
│ │ ║ Turn B: DECISION: CONTINUE                        ║ │   │
│ │ ║ The composition is good but needs more detail...  ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ [Scroll for more...]                              ║ │   │
│ │ ╚═══════════════════════════════════════════════════╝ │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ Status: Running    Iteration 2 / 5 - Turn A thinking         │
│                                                               │
│ [Start Agentic Refinement]  [Cancel]                          │
└─────────────────────────────────────────────────────────────┘
```

## Widget Layout (Minimized State)

```
┌─────────────────────────────────────────────────────────────┐
│ ≡ Agentic Imagen - Running: Iteration 2/5       [ □ ][ × ]  │
└─────────────────────────────────────────────────────────────┘
```

## Widget Layout (Completed State)

```
┌─────────────────────────────────────────────────────────────┐
│ ≡ Agentic Imagen                                    [ _ ][ × ]│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─ Chat Transcript ──────────────────────────────────────┐   │
│ │ ╔═══════════════════════════════════════════════════╗ │   │
│ │ ║ [Previous messages...]                            ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ Turn B (Critic)                                   ║ │   │
│ │ ║ Evaluating generated images...                    ║ │   │
│ │ ║ Turn B: DECISION: STOP                            ║ │   │
│ │ ║ The generated image closely matches the target    ║ │   │
│ │ ║ in composition, style, and detail quality.        ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ System                                            ║ │   │
│ │ ║ Turn B decided the refinement is complete!        ║ │   │
│ │ ║                                                   ║ │   │
│ │ ║ System                                            ║ │   │
│ │ ║ Refinement complete! Review the results below.    ║ │   │
│ │ ╚═══════════════════════════════════════════════════╝ │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌─ Final Results ────────────────────────────────────────┐   │
│ │                                                        │   │
│ │ Final Positive Prompt:                                 │   │
│ │ ┌──────────────────────────────────────────────────┐  │   │
│ │ │ masterpiece, best quality, 1girl, portrait,      │  │   │
│ │ │ blue eyes, detailed face, high resolution,       │  │   │
│ │ │ professional lighting, photorealistic            │  │   │
│ │ └──────────────────────────────────────────────────┘  │   │
│ │                                                        │   │
│ │ Final Negative Prompt:                                 │   │
│ │ ┌──────────────────────────────────────────────────┐  │   │
│ │ │ low quality, blurry, distorted, amateur          │  │   │
│ │ └──────────────────────────────────────────────────┘  │   │
│ │                                                        │   │
│ │ Resolution: 512 x 768                                  │   │
│ │                                                        │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ Status: Completed    Finished after 3 iterations              │
│                                                               │
│ [Apply to Generate Tab]  [Apply & Generate]                   │
└─────────────────────────────────────────────────────────────┘
```

## Entry Point (Generate Tab)

```
┌─────────────────────────────────────────────────────────────┐
│                     SwarmUI - Generate Tab                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ [ + ]  ← Click here to open menu                              │
│ ┌───────────────────────────────────┐                         │
│ │ Prompt LLM                        │                         │
│ │ Agentic Imagen          ← NEW!    │                         │
│ │ Auto Segment Refinement           │                         │
│ │ Regional Prompt                   │                         │
│ │ Upload Prompt Image               │                         │
│ └───────────────────────────────────┘                         │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Type your prompt here...                                │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Negative prompt...                                      │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ [ Generate ]  [ ⟳ ]  [ × ]                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Color Scheme

```
Message Types:
- System    (gray)   : #888
- Turn A    (blue)   : #4a9eff
- Turn B    (orange) : #ffa94a
- Tool      (purple) : #9b59b6
- Error     (red)    : #e74c3c

Buttons:
- Primary   (blue)   : #4a9eff
- Success   (green)  : #27ae60
- Danger    (red)    : #e74c3c
- Secondary (gray)   : #2a2a2a

Background:
- Main      : #1a1a1a
- Light     : #2a2a2a
- Border    : #444
```

## Responsive Behavior

```
Desktop (> 1024px):
┌────────────────────────────────────────────┐
│  Widget: 600px × 700px                     │
│  Position: Draggable anywhere              │
│  All features visible                      │
└────────────────────────────────────────────┘

Tablet (768px - 1024px):
┌────────────────────────────────────────────┐
│  Widget: 500px × 600px                     │
│  Position: Centered by default             │
│  Scrollable content                        │
└────────────────────────────────────────────┘

Mobile (< 768px):
┌────────────────────────────────────────────┐
│  Widget: Full width - 20px padding         │
│  Position: Top of screen                   │
│  Compact layout                            │
│  Touch-friendly controls                   │
└────────────────────────────────────────────┘
```

## Interactive Elements

```
Draggable Header:
┌─────────────────────────────────────────────────────────────┐
│ ≡ Agentic Imagen                ← Drag handle (cursor: move)│
│   ↑                                                           │
│   └─ Title text                                               │
└─────────────────────────────────────────────────────────────┘

Buttons:
┌──────────────────────┐
│ Start Refinement     │ ← Primary action (blue, cursor: pointer)
└──────────────────────┘

┌──────────────────────┐
│ Cancel               │ ← Danger action (red, cursor: pointer)
└──────────────────────┘

┌──────────────────────┐
│ Apply & Generate     │ ← Success action (green, cursor: pointer)
└──────────────────────┘

Input Fields:
┌──────────────────────────────────────────────────┐
│ Type here...                    ← Text input     │
└──────────────────────────────────────────────────┘

Dropdowns:
┌──────────────────────────────────────────────────┐
│ Select a model...                    ▼           │
└──────────────────────────────────────────────────┘
```

## State Transitions

```
Idle State:
┌───────────────┐
│ Configuration │
│    visible    │
│               │
│  Chat area    │
│    empty      │
└───────────────┘
        ↓ [Start Refinement]
        
Running State:
┌───────────────┐
│ Configuration │
│    hidden     │
│               │
│  Chat area    │
│   updating    │
│               │
│  [Cancel]     │
└───────────────┘
        ↓ [Iteration complete or Cancel]
        
Completed State:
┌───────────────┐
│ Configuration │
│    hidden     │
│               │
│  Chat area    │
│  with history │
│               │
│ Final Results │
│  displayed    │
│               │
│ [Apply btns]  │
└───────────────┘
```

## Animation & Transitions

```css
/* Widget appearance */
.agentic-imagen-widget {
    transition: all 0.3s ease;
    opacity: 1;
}

/* Minimize animation */
.agentic-imagen-widget.minimized {
    height: 40px;
    transition: height 0.2s ease;
}

/* Drag operation */
.agentic-imagen-header:active {
    cursor: move;
    opacity: 0.9;
}

/* Button hover */
.agentic-imagen-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
}

/* Message appearance */
.agentic-imagen-message {
    animation: slideIn 0.3s ease;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

## Accessibility Features

```
Keyboard Navigation:
- Tab: Move between interactive elements
- Enter: Activate buttons
- Escape: Close widget
- Arrow keys: Scroll transcript

ARIA Labels:
- Widget: role="dialog" aria-label="Agentic Imagen Assistant"
- Header: role="banner" aria-label="Widget Header"
- Transcript: role="log" aria-live="polite"
- Buttons: Clear action labels
- Inputs: Associated label elements

Screen Reader Support:
- Status updates announced
- Tool calls described
- Error messages read aloud
- Progress indicators verbalized
```

## Browser Compatibility

```
Tested & Supported:
✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+

Features Used:
✅ CSS Grid & Flexbox
✅ CSS Variables
✅ ES6+ JavaScript
✅ Fetch API
✅ Promises/Async-Await
✅ File API
```

## Performance Considerations

```
Optimization:
- Lazy initialization of widget
- Event listener cleanup
- Debounced scroll handlers
- Efficient DOM updates
- Minimal reflows/repaints

Memory Management:
- Proper event unbinding
- Image data cleanup
- Iteration history limits
- Garbage collection friendly

Network Efficiency:
- Batch API requests
- Image caching
- Error retry logic
- Abort controller support
```

This mockup provides a comprehensive visual guide to the Agentic Imagen feature's user interface and interactions.
