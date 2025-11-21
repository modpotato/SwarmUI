# Agentic Imagen Feature Documentation

## Overview

Agentic Imagen is an advanced image-guided prompt refinement feature that uses a two-agent LLM orchestration system to iteratively improve prompts and generation parameters. It appears as a floating, draggable chat widget that integrates seamlessly with the SwarmUI Generate tab.

## How It Works

### Two-Agent System

The feature uses two specialized LLM agents that work together:

1. **Turn A (Prompt Engineer)**
   - Role: Analyzes the target image and crafts/refines prompts and parameters
   - Tools: Can call functions to modify prompts, resolution, and other generation settings
   - Capabilities: Uses vision models to "see" the target image
   - Output: Makes measured changes to generation parameters each iteration

2. **Turn B (Critic)**
   - Role: Evaluates generated images against the target
   - Decision: Decides whether to continue refining or stop
   - Format: Must output `DECISION: CONTINUE` or `DECISION: STOP`
   - Feedback: Provides specific guidance for Turn A's next iteration

### Iteration Loop

1. User provides a target image and optional tags/description
2. **Turn A** analyzes the target and calls tools to set/update:
   - Positive prompt
   - Negative prompt
   - Resolution
   - Other parameters (steps, CFG, etc.)
3. System generates image(s) using the current settings
4. **Turn B** compares generated vs target images
5. If Turn B says `DECISION: CONTINUE`, go to step 2
6. If Turn B says `DECISION: STOP` or max iterations reached, present final configuration

## User Interface

### Entry Point

Access via the "+" button next to the prompt box → **"Agentic Imagen"**

### Widget Features

- **Draggable**: Click and drag the header to reposition
- **Collapsible**: Minimize button (-) shrinks to title bar only
- **Closeable**: Close button (×) hides the widget
- **Per-Tab**: Each Generate tab can have its own Agentic Imagen instance

### Configuration Panel (Idle State)

- **Target Image**: Upload a file OR paste a URL
- **Tags/Description** (optional): Provide context about the target image
- **Turn A Model**: Select the LLM for prompt engineering (vision-capable recommended)
- **Turn B Model**: Select the LLM for critiquing (vision-capable recommended)
- **Max Iterations**: Upper limit (default 5, cap at 20)
  - Note: This is a *cap*, not a target. Turn B may stop earlier.

### Chat Transcript

Shows real-time messages during the refinement process:
- **System** messages (gray): Status updates
- **Turn A** messages (blue): Prompt Engineer's actions
- **Turn B** messages (orange): Critic's evaluations
- **Tool** messages (purple): Function calls executed
- **Error** messages (red): Any failures

### Results Panel (Completed State)

Displays:
- Final positive prompt
- Final negative prompt
- Final resolution
- Iteration count

Action buttons:
- **Apply to Generate Tab**: Updates settings (already applied during iteration)
- **Apply & Generate**: Applies settings and triggers generation

## Available Tools (Turn A)

Turn A can call these functions to modify generation settings:

### set_positive_prompt(text)
Sets the main prompt for image generation.

**Example:**
```json
{
  "name": "set_positive_prompt",
  "arguments": {
    "text": "masterpiece, best quality, 1girl, blue eyes, long hair, detailed"
  }
}
```

### set_negative_prompt(text)
Sets the negative prompt to avoid unwanted elements.

**Example:**
```json
{
  "name": "set_negative_prompt",
  "arguments": {
    "text": "low quality, blurry, distorted"
  }
}
```

### set_aspect_ratio(ratio)
Sets the aspect ratio for the image.

**Options:** 1:1, 4:3, 3:2, 8:5, 16:9, 21:9, 3:4, 2:3, 5:8, 9:16, 9:21

**Example:**
```json
{
  "name": "set_aspect_ratio",
  "arguments": {
    "ratio": "16:9"
  }
}
```

### set_param(name, value)
Sets other generation parameters.

**Example:**
```json
{
  "name": "set_param",
  "arguments": {
    "name": "steps",
    "value": 30
  }
}
```

Supported parameter names: `steps`, `cfgscale`, `sampler`, etc.

### generate_image()
Triggers an image generation with the current settings.

**Example:**
```json
{
  "name": "generate_image",
  "arguments": {}
}
```

## System Prompts

System prompts for Turn A and Turn B are now **configurable** through User Settings, similar to the Prompt LLM feature. You can customize these prompts to adjust agent behavior.

### Configuration Location

1. Go to **User Settings** in SwarmUI
2. Navigate to **Agentic Imagen** settings section
3. Edit **Turn A Prompt** and **Turn B Prompt** fields
4. Save your changes

The prompts will be loaded when the Agentic Imagen widget is opened.

### Turn A System Prompt (Default)

```
You are an expert AI image generation prompt engineer. Your role is to 
iteratively refine prompts and parameters to match a target image.

Available tools:
- set_positive_prompt(text): Set the positive prompt for image generation
- set_negative_prompt(text): Set the negative prompt
- set_aspect_ratio(ratio): Set the aspect ratio for the image (options: 1:1, 4:3, 3:2, 8:5, 16:9, 21:9, 3:4, 2:3, 5:8, 9:16, 9:21)
- set_param(name, value): Set other parameters like steps, CFG, sampler
- generate_image(): Trigger an image generation with current settings

Guidelines:
1. Make modest, purposeful changes each iteration - avoid changing everything at once
2. Use clear, descriptive tags in Danbooru/image-board style
3. Include quality tags and composition details
4. Be specific about subjects, lighting, and mood
5. After making changes, call generate_image() to test them

Your goal is to match the target image as closely as possible through 
iterative refinement.
```

### Turn B System Prompt (Default)

```
You are a strict visual critic for AI image generation. Your role is to 
compare generated images against a target image and decide whether the 
refinement process should continue or stop.

CRITICAL: You must start your response with a clear decision marker:
- "DECISION: CONTINUE" if more refinement is needed
- "DECISION: STOP" if the current result is satisfactory

After the decision, explain your reasoning and provide specific feedback 
for the next iteration (if continuing).

Guidelines:
1. Compare composition, style, subjects, lighting, and overall quality
2. Be constructive but honest about gaps
3. Only STOP when the generated image adequately matches the target
4. Provide actionable feedback for Turn A to improve
```

## Usage Example

### Scenario: Refining a portrait

1. **Open Agentic Imagen widget**
   - Click "+" next to prompt box → "Agentic Imagen"

2. **Configure**
   - Upload target image: `portrait.jpg`
   - Tags: "woman, blue eyes, professional lighting"
   - Turn A Model: `anthropic/claude-3.5-sonnet`
   - Turn B Model: `anthropic/claude-3.5-sonnet`
   - Max Iterations: 5

3. **Start Refinement**
   - Click "Start Agentic Refinement"

4. **Iteration 1**
   - Turn A analyzes target, sets initial prompt: "masterpiece, best quality, 1girl, portrait, blue eyes, professional lighting"
   - Calls `set_aspect_ratio("3:4")`
   - Calls `generate_image()`
   - System generates image
   - Turn B reviews: "DECISION: CONTINUE - Face structure needs more detail, lighting is good"

5. **Iteration 2**
   - Turn A refines: adds "detailed face, high resolution, photorealistic"
   - Calls `set_param("steps", 40)`
   - Calls `generate_image()`
   - System generates image
   - Turn B reviews: "DECISION: STOP - Generated image closely matches target in composition, lighting, and detail"

6. **Results**
   - Final prompt displayed
   - Click "Apply & Generate" to create final image

## Configuration

### Prerequisites

- OpenRouter API key must be configured in User Settings
- At least one vision-capable model available (e.g., Claude 3.5 Sonnet, GPT-4 Vision)

### Recommended Models

**Vision-Capable (Best for this feature):**
- `anthropic/claude-3.5-sonnet` - Excellent vision and reasoning
- `anthropic/claude-3-opus` - High-quality vision analysis
- `openai/gpt-4o` - Strong multimodal capabilities
- `openai/gpt-4-turbo` - Good vision support
- `google/gemini-pro-vision` - Fast vision inference

**Text-Only (Can work but limited):**
- Can use any model, but won't "see" the target image
- Relies only on tags/description provided by user

## Best Practices

### Iteration Limits

- **Start low** (3-5 iterations) to test the workflow
- **Increase gradually** if needed
- Remember: Turn B can stop early if satisfied

### Target Images

- **Use clear references**: High-quality, well-composed images work best
- **Provide context**: Add tags/descriptions to help the LLMs understand intent
- **File size**: Keep images reasonably sized (< 5MB recommended)

### Model Selection

- **Use vision models**: Critical for Turn B to evaluate results
- **Same model for both**: Simplest approach, works well
- **Different models**: Can experiment (e.g., Claude for Turn A, GPT-4 for Turn B)

### Prompts and Tags

- Let Turn A do its job - it's trained on prompt engineering
- Provide high-level guidance in tags, not detailed prompts
- Example good tags: "anime style, cyberpunk, neon lights"
- Example bad tags: Long paragraphs of detailed instructions

## Troubleshooting

### "No models available"

**Cause**: OpenRouter API key not configured or failed to load models

**Solution**:
1. Go to User Settings
2. Configure OpenRouter API key
3. Refresh the page
4. Open Agentic Imagen again

### "Request too large" error

**Cause**: Image file(s) too large when encoded as base64

**Solution**:
- Use smaller image files
- Compress images before upload
- Use image URLs instead of uploads

### Turn A not calling tools

**Cause**: Model doesn't support function calling or system prompt unclear

**Solution**:
- Ensure you're using a model that supports function calling
- Try a different model (Claude 3.5 Sonnet is reliable)

### Generation doesn't start

**Cause**: Generate tab settings invalid or generation handler not ready

**Solution**:
- Ensure Generate tab has valid settings (model selected, etc.)
- Try generating manually first to ensure pipeline works
- Check browser console for errors

### Iteration runs forever

**Cause**: Turn B not outputting proper decision format

**Solution**:
- Max iterations cap will eventually stop it
- Try a different model for Turn B
- Check transcript to see Turn B's responses

## Technical Details

### Architecture

- **Frontend**: Pure JavaScript class (`AgenticImagen`)
- **Backend**: C# API endpoint (`CallOpenRouterWithTools`)
- **LLM Provider**: OpenRouter API
- **State**: Client-side only, no server persistence

### Function Calling Format

OpenRouter function calling follows the standard format:

```json
{
  "type": "function",
  "function": {
    "name": "function_name",
    "description": "Function description",
    "parameters": {
      "type": "object",
      "properties": {
        "arg1": { "type": "string", "description": "Argument description" }
      },
      "required": ["arg1"]
    }
  }
}
```

### API Endpoint

**Endpoint**: `CallOpenRouterWithTools`

**Request Body**:
```json
{
  "modelId": "anthropic/claude-3.5-sonnet",
  "systemPrompt": "System instructions...",
  "userMessage": "User message...",
  "tools": [...],
  "imageData": ["data:image/jpeg;base64,..."],
  "temperature": 0.7,
  "maxTokens": 1000
}
```

**Response**:
```json
{
  "content": "LLM response text",
  "tool_calls": [
    {
      "name": "set_positive_prompt",
      "arguments": { "text": "..." }
    }
  ]
}
```

### State Structure

```javascript
{
  status: 'idle' | 'running' | 'completed' | 'error',
  targetImage: { type: 'upload' | 'url', src: string, dataUrl: string },
  tags: string,
  maxIterations: number,
  currentIteration: number,
  iterations: [
    {
      id: number,
      turnA: { content: string, toolCalls: [...] },
      turnB: { content: string, decision: 'continue' | 'stop' },
      generatedImages: [...]
    }
  ],
  finalConfig: {
    positive: string,
    negative: string,
    width: number,
    height: number
  }
}
```

## Limitations

### Current Limitations

- **No streaming**: LLM responses are not streamed (come all at once)
- **No history persistence**: Widget state lost on page refresh
- **Single generation**: Each iteration generates only one image
- **No batch mode**: Can't run multiple refinement processes simultaneously

### Future Enhancements (Out of Scope)

- Streaming LLM responses for better UX
- Persistent conversation history
- Multiple image generation per iteration
- Batch processing multiple targets
- Custom system prompts per agent
- Export/import iteration history

## Safety and Limits

### Hard Limits

- **Max iterations**: Capped at 20 (configurable in code)
- **Resolution**: 64-2048 pixels (configurable via constants)
- **Error timeout**: 5 seconds before error messages auto-hide

### Safety Features

- **Abort controller**: Can cancel running processes
- **Error recovery**: Graceful handling of API failures
- **Input validation**: All parameters validated before use
- **Memory management**: Proper event listener cleanup

## Support

### Getting Help

- Check browser console for detailed error messages
- Review chat transcript for LLM interaction issues
- Verify OpenRouter API key and credits
- Test with simpler target images first

### Reporting Issues

When reporting issues, include:
- Browser and version
- Models selected for Turn A and Turn B
- Target image size and format
- Console error messages
- Screenshots of widget state

## Changelog

### Version 1.0.0 (Initial Release)

**Features**:
- Floating, draggable widget UI
- Two-agent LLM orchestration (Turn A & Turn B)
- Function calling tool support
- Vision model integration
- Iteration control with early stopping
- Per-tab state isolation
- Comprehensive error handling

**Security**:
- CodeQL scan: 0 vulnerabilities
- No memory leaks
- Proper input sanitization

**Code Quality**:
- Clean, maintainable architecture
- Named constants for magic numbers
- Proper event listener management
- Comprehensive error handling
