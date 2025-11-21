# Agentic Imagen Quick Start Guide

## What is Agentic Imagen?

Agentic Imagen is an AI-powered image refinement assistant that helps you create better prompts by analyzing a target image. It uses two AI agents that work together to iteratively improve your prompts and generation settings.

## Quick Start

### 1. Access the Feature

1. Click the **"+"** button next to your prompt box
2. Select **"Agentic Imagen"** from the menu
3. A floating widget will appear

### 2. Configure Your Session

**Required:**
- **Target Image**: Upload an image file OR paste an image URL
- **Turn A Model**: Select a vision-capable model (e.g., Claude 3.5 Sonnet)
- **Turn B Model**: Select a vision-capable model (same as Turn A is fine)

**Optional:**
- **Tags/Description**: Add context like "anime style" or "cyberpunk aesthetic"
- **Max Iterations**: Set upper limit (default: 5)

### 3. Start Refinement

Click **"Start Agentic Refinement"** and watch the magic happen!

The widget will show real-time updates as:
- **Turn A (Prompt Engineer)** analyzes your image and creates prompts
- The system **generates test images**
- **Turn B (Critic)** evaluates results and decides whether to continue

### 4. Use the Results

When complete, you'll see:
- Final positive prompt
- Final negative prompt  
- Final resolution and settings

Click **"Apply & Generate"** to create your image with the refined settings!

## Tips for Best Results

### Choose Good Target Images
✅ **DO**: Use clear, well-composed reference images  
❌ **DON'T**: Use tiny, blurry, or complex collage images

### Provide Context
✅ **DO**: Add helpful tags like "realistic portrait" or "watercolor style"  
❌ **DON'T**: Write long paragraphs - let the AI figure out the details

### Start with Lower Iterations
✅ **DO**: Try 3-5 iterations first  
❌ **DON'T**: Start with 20 iterations - the AI might stop early anyway!

### Use Vision-Capable Models
✅ **DO**: Use Claude 3.5 Sonnet, GPT-4 Vision, or Gemini Pro Vision  
❌ **DON'T**: Use text-only models - they can't "see" your target image

## Understanding the Interface

### Widget Controls

- **Header**: Drag to reposition the widget anywhere on screen
- **"-" Button**: Minimize to just the title bar
- **"×" Button**: Close the widget
- **Cancel**: Stop the current refinement process

### Chat Transcript

Watch the conversation between agents:
- 🔵 **Turn A** (blue): Prompt Engineer making changes
- 🟠 **Turn B** (orange): Critic evaluating results  
- 🟣 **Tool** (purple): Actions being taken
- ⚪ **System** (gray): Status updates
- 🔴 **Error** (red): Something went wrong

### Status Indicator

Shows current state:
- "Ready to start" - Waiting for you
- "Running" - Actively refining
- "Iteration X / Y" - Current progress
- "Completed" - Done!

## Common Questions

### Why does it stop before max iterations?

Turn B (the Critic) decides when the result is good enough. If it outputs `DECISION: STOP`, the process ends early. This is actually a good thing - it means you've achieved your goal!

### Can I use the same model for both agents?

Yes! Using Claude 3.5 Sonnet for both Turn A and Turn B works great.

### Do I need to provide tags?

No, tags are optional. But they help guide the AI, especially for specific styles or aesthetics.

### What if generation fails?

Check that:
- You have a model selected in the Generate tab
- Your Generate tab settings are valid
- You have backend(s) running and ready

### Can I use this without an OpenRouter API key?

No, you need an OpenRouter API key configured in User Settings. The feature uses OpenRouter's API to access LLM models.

## Workflow Example

**Goal**: Create a portrait matching a reference photo

1. **Open widget** from prompt tools menu
2. **Upload** your reference portrait image  
3. **Add tags**: "professional portrait, studio lighting"
4. **Select models**: Claude 3.5 Sonnet for both
5. **Set max iterations**: 5
6. **Click "Start"**

**What happens**:
- Turn A sees your reference and writes an initial prompt
- System generates a test image
- Turn B compares it: "DECISION: CONTINUE - needs better facial detail"
- Turn A refines the prompt, adds "detailed face, high resolution"
- System generates again
- Turn B: "DECISION: STOP - result matches target well"
- You get the final refined prompts!

7. **Apply & Generate** to create your final image

## Widget Features

### Drag & Drop
Click and hold the header to drag the widget anywhere on your screen.

### Minimize
Click the "-" button to shrink the widget to just a title bar. Click again to expand.

### Multiple Tabs
Each Generate tab can have its own Agentic Imagen widget with different settings.

### Real-time Updates
See exactly what both agents are thinking as they work.

## Need Help?

### Widget won't open
- Make sure you have an OpenRouter API key configured
- Refresh the page and try again

### "No models available"
- Configure your OpenRouter API key in User Settings
- Refresh the page

### "Request too large" error  
- Use a smaller image file
- Try compressing your image first
- Use an image URL instead of upload

### Agents not working properly
- Make sure you selected vision-capable models
- Try Claude 3.5 Sonnet - it's very reliable
- Check that your OpenRouter account has credits

## Pro Tips

### 🎯 Target Image Quality Matters
Better reference images = better results. Use high-quality, clear images.

### 🤖 Vision Models Are Key
Always use models with vision capabilities. They need to "see" your target image!

### ⚡ Start Small
Begin with 3-5 iterations. You can always run it again if needed.

### 📝 Let AI Do the Work
Provide high-level guidance in tags, but let Turn A handle the detailed prompt engineering.

### 🔄 Iterate on Iterations
If results aren't perfect, adjust your tags or target image and run again.

### 💡 Learn from the Transcript
Read what Turn A and Turn B are discussing - you'll learn what works!

## Advanced Usage

### Different Models for Each Agent

Try using different models for specialized tasks:
- **Turn A**: Claude 3.5 Sonnet (great at prompt engineering)
- **Turn B**: GPT-4 Vision (strong visual evaluation)

### Parameter Tuning

Turn A can adjust not just prompts, but also:
- Resolution (width × height)
- Steps (generation quality)
- CFG Scale (prompt adherence)
- Sampler (generation algorithm)

### Strategic Tag Use

Guide the AI with strategic tags:
- Style: "anime", "realistic", "watercolor"
- Composition: "close-up", "full body", "landscape"
- Lighting: "natural light", "dramatic shadows", "soft glow"
- Quality: "high detail", "masterpiece", "4k"

## Limitations to Know

- Widget state is lost if you refresh the page
- Each iteration generates only one image
- No streaming (responses appear all at once)
- Can't run multiple refinements simultaneously

These are intentional design choices for simplicity and reliability.

## Getting the Most Out of It

1. **Experiment!** Try different target images and models
2. **Read the transcript** to understand what the AI is thinking
3. **Adjust your tags** based on what Turn A and Turn B discuss
4. **Save good results** in presets for later use
5. **Share findings** - what combinations work best?

## Ready to Start?

Click that **"+"** button and select **"Agentic Imagen"** to begin your journey into AI-assisted prompt refinement! 🚀
