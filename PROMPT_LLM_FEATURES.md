# Prompt LLM Features - User Guide

## Overview

The **Prompt LLM** feature in SwarmUI provides three powerful AI-assisted tools for working with prompts:

1. **Refine** - Improve and optimize existing prompts
2. **Generate** - Create complete prompts from simple ideas
3. **Blend** - Combine multiple prompts into one coherent prompt

All three modes leverage Large Language Models (LLMs) via OpenRouter to help you create better prompts for image generation.

## Setup

### Prerequisites

1. You need an OpenRouter API key
2. Go to https://openrouter.ai/keys to create an account and generate a key
3. In SwarmUI, navigate to the **User** tab
4. Find the **API Keys** section
5. Enter your OpenRouter API key in the `openrouter_api` field
6. Click Save

## Accessing Prompt LLM

1. Click the **+** button next to the prompt text box in the Generate tab
2. Select **Prompt LLM** from the dropdown menu
3. The Prompt LLM modal will open with three tabs: Refine, Generate, and Blend

## Feature 1: Refine

### What It Does

The Refine mode takes your existing prompt (or image metadata) and improves it by:
- Converting rough ideas into polished Danbooru-style tags
- Adding appropriate quality tags
- Organizing tags logically
- Suggesting relevant LoRAs when appropriate
- Maintaining your original intent while enhancing clarity

### How to Use

1. **Source Detection**: The system automatically detects whether to use:
   - Current prompt text from the prompt box
   - Image metadata (if you have an image selected with metadata)

2. **Context Modes** (when image metadata is available):
   - **Replace**: Use image metadata as the source (default behavior)
   - **Inspire**: Keep your current prompt, use image metadata for inspiration
   - **Append**: Add image metadata to your current prompt

3. **Select a Model**: Choose an LLM model from the dropdown
   - Recommended models are shown first
   - Vision-capable models are marked

4. **Additional Options**:
   - Add custom instructions in the "Additional Instructions" field
   - Enable "Bypass Vision" for non-vision models
   - Choose your preferred context mode

5. **Execute**: Click the "Execute" button

6. **Review Results**:
   - See the refined prompt
   - View a visual diff showing added/removed words
   - Review and decide if you want to use it

7. **Apply**: Click "Apply" to insert the refined prompt into your prompt box

### Example

**Original prompt:**
```
cat sitting on table, cute, sunny day
```

**Refined prompt:**
```
1girl, cat, sitting, table, cute, masterpiece, best quality, natural lighting, sunny day, high resolution, detailed fur texture, warm colors
```

## Feature 2: Generate

### What It Does

The Generate mode creates complete, detailed prompts from minimal input:
- Takes simple keywords or ideas
- Expands them into full, coherent prompts
- Adds appropriate descriptive tags
- Incorporates quality markers
- Optionally applies a specific style

### How to Use

1. **Enter Your Idea**: Type simple keywords or a basic concept
   - Examples: "fantasy warrior", "cyberpunk city", "cute cat"

2. **Style (Optional)**: Specify an artistic style
   - Examples: "anime", "photorealistic", "oil painting"

3. **Detail Level**: Choose how detailed you want the prompt:
   - **Minimal**: Simple and concise
   - **Moderate**: Good balance (recommended)
   - **Detailed**: Very descriptive
   - **Extreme**: Maximum detail with extensive tags

4. **Select a Model**: Choose an LLM from the dropdown

5. **Execute**: Click the "Execute" button

6. **Apply**: Review the generated prompt and click "Apply" to use it

### Examples

**Input:** `fantasy warrior`  
**Style:** `anime`  
**Detail Level:** `Moderate`

**Generated:**
```
1girl, fantasy, warrior, anime style, armor, sword, determined expression, long hair, flowing cape, masterpiece, best quality, detailed armor design, epic composition, dramatic lighting, high resolution
```

**Input:** `cyberpunk city at night`  
**Detail Level:** `Detailed`

**Generated:**
```
cyberpunk, futuristic city, night scene, neon lights, rain, reflective surfaces, towering skyscrapers, flying vehicles, holographic advertisements, atmospheric perspective, cinematic lighting, purple and blue color scheme, masterpiece, best quality, high resolution, 8k, ultra detailed, photorealistic
```

## Feature 3: Blend

### What It Does

The Blend mode intelligently combines multiple prompts:
- Merges concepts from 2-3 different prompts
- Creates coherent combinations
- Maintains the essence of each prompt
- Offers different blending strategies

### How to Use

1. **Enter Prompts**: Fill in 2-3 prompt fields
   - Prompt 1 and 2 are required
   - Prompt 3 is optional

2. **Blend Mode**: Select how to blend:
   - **Balanced**: Equal weight to all prompts
   - **Favor First**: Emphasize elements from Prompt 1
   - **Creative**: Allow LLM to be creative with the blend
   - **Structured**: Maintain clear organization

3. **Select a Model**: Choose an LLM from the dropdown

4. **Execute**: Click the "Execute" button

5. **Apply**: Review the blended prompt and click "Apply" to use it

### Example

**Prompt 1:**
```
1girl, magical girl, pink dress, wand, sparkles
```

**Prompt 2:**
```
cyberpunk, futuristic, neon lights, city background
```

**Blend Mode:** `Creative`

**Blended Result:**
```
1girl, magical girl, cyberpunk, futuristic magical outfit, pink and neon color scheme, holographic wand, digital sparkles, city background, neon lights, tech-fantasy fusion, masterpiece, best quality, unique concept, detailed design
```

## Best Practices

### 1. Model Selection
- **For Refining**: Use models like Claude 3.5 Sonnet or GPT-4 for best results
- **For Generating**: Mid-tier models like Llama 3 70B work well and cost less
- **For Blending**: Creative models like GPT-4 or Claude excel at this

### 2. Iterative Refinement
- Don't expect perfection on the first try
- Refine the refined prompt if needed
- Use the diff view to understand what changed

### 3. Context Mode Selection
- Use **Replace** when you want to work with image metadata
- Use **Inspire** when you like your prompt but want ideas from an image
- Use **Append** when you want to combine your prompt with image metadata

### 4. Detail Levels
- Start with **Moderate** for most use cases
- Use **Minimal** for simple concepts or when you want more control
- Use **Detailed** or **Extreme** for complex scenes or when you need maximum specification

### 5. Custom Instructions
- Add specific requirements in the "Additional Instructions" field
- Examples: "Focus on facial details", "Emphasize the background", "Add more color descriptions"

## LoRA Integration

When available, the system will:
- Detect LoRAs in your model folder
- Suggest appropriate LoRAs in refined/generated prompts
- Include trigger words when known
- Use the syntax `<lora:name>` for LoRA suggestions

**Example:**
```
1girl, portrait, detailed face, <lora:realistic_face_v2>, natural lighting, masterpiece
```

## Enhanced System Prompt

The Prompt LLM feature uses an enhanced system prompt that includes:

1. **Quality Tag Guidelines**: Instructions to include quality markers
2. **Tag Organization**: Logical ordering (subject → setting → style → quality)
3. **Composition Guidance**: Recommendations for lighting, mood, and composition
4. **LoRA Awareness**: Information about available LoRAs and their triggers
5. **Best Practices**: Industry-standard prompt engineering techniques
6. **NSFW Preservation**: No censoring of user intent

## Troubleshooting

### "No models available" Error
- Ensure you've configured your OpenRouter API key in User Settings
- Check your internet connection
- Verify the API key is valid

### "Failed to refine prompt" Error
- Check if you've hit rate limits on OpenRouter
- Try a different model
- Ensure you have credits in your OpenRouter account

### Model doesn't support vision warning
- This appears when using a non-vision model with image metadata
- The system auto-enables "Bypass Vision" mode
- The prompt will still be processed as text

### Unexpected results
- Try adding specific instructions
- Experiment with different models
- Use iterative refinement
- Check the visual diff to understand changes

## Privacy & Costs

### Privacy
- Your prompts are sent to OpenRouter and the selected LLM provider
- Read OpenRouter's privacy policy: https://openrouter.ai/privacy
- Different LLM providers have different data policies
- No data is stored by SwarmUI beyond your local settings

### Costs
- OpenRouter charges per token used
- Costs vary by model (typically $0.001 - $0.05 per request)
- Monitor your usage on the OpenRouter dashboard
- Consider using cheaper models for experimentation
- More expensive models generally provide better results

## Tips for Best Results

1. **Be Specific**: Even when generating, more context helps
2. **Use Examples**: Reference styles, artists, or specific characteristics
3. **Iterate**: Use the output as input for further refinement
4. **Experiment**: Try different models to find what works for your style
5. **Learn from Diffs**: The visual diff helps you understand what makes a good prompt
6. **Combine Modes**: Generate → Refine → Blend for complex prompts
7. **Save Good Prompts**: Keep track of what works well for reuse

## Advanced Usage

### Chaining Operations
You can chain multiple operations for complex workflows:

1. **Generate** a base prompt from keywords
2. **Apply** it to the prompt box
3. **Refine** it for better quality tags
4. **Apply** again
5. **Blend** with another concept
6. Final **Refine** for polish

### Working with Image Metadata

The **Inspire** mode is particularly powerful:

1. Select an image with good metadata
2. Keep your current creative prompt
3. Use Inspire mode to add elements from the image
4. Get the best of both worlds

### Custom System Prompts

While not exposed in the UI, developers can modify the `buildSystemPromptWithBestPractices()` method to:
- Add domain-specific knowledge
- Include preferred artists or styles
- Customize quality tag preferences
- Add custom LoRA recommendations

## Future Enhancements

Potential future additions to this feature:
- Batch processing for multiple prompts
- Preset styles and templates
- History of refined prompts
- One-click apply from diff view
- Advanced LoRA metadata extraction
- Model-specific optimizations
- Prompt strength adjustment
- Multi-language support

## Feedback

This feature is continuously being improved. If you have suggestions or encounter issues, please report them on the SwarmUI GitHub repository.

---

**Version**: 1.0  
**Last Updated**: 2025-10-11  
**Feature Status**: Beta
