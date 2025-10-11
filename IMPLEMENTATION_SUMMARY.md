# Prompt LLM Feature - Implementation Summary

## Overview

This document provides a comprehensive summary of the Prompt LLM feature (formerly "LLM Refiner") that has been significantly enhanced in SwarmUI. The feature now includes prompt refinement, generation, and blending capabilities powered by LLM models via OpenRouter.

## Key Features

### 1. **Prompt Refinement**
- Refine existing prompts or convert image tags into coherent prompts
- Enhanced context control with multiple modes (replace, inspire, append)
- Best practices integration for quality image generation
- LoRA metadata awareness for automatic LoRA suggestions

### 2. **Prompt Generation**
- Generate complete prompts from minimal input (keywords or simple ideas)
- Customizable detail levels (minimal, moderate, detailed, extreme)
- Optional style specification
- Intelligent prompt expansion with quality tags

### 3. **Prompt Blending**
- Blend 2-3 prompts together into a coherent combination
- Multiple blend modes:
  - **Balanced**: Equal weight to all prompts
  - **Favor First**: Emphasize the first prompt
  - **Creative**: Let the LLM be creative with the blend
  - **Structured**: Maintain clear structure and organization

## Implementation Details

### Backend Components

#### 1. OpenRouterAPI.cs (`src/WebAPI/OpenRouterAPI.cs`)

A new API class that handles all communication with OpenRouter's API:

- **GetOpenRouterModels**: Fetches the list of available LLM models from OpenRouter
  - Retrieves models from `https://openrouter.ai/api/v1/models`
  - Formats them for the UI dropdown
  - Detects vision capability support
  - Requires OpenRouter API key to be configured

- **RefinePromptWithOpenRouter**: Sends prompts to the selected LLM model for processing
  - Accepts model ID, source text, source type, custom system prompts, and additional parameters
  - Uses different default system prompts based on source type
  - Supports custom system prompts with best practices and LoRA metadata
  - Returns processed prompt text
  - Handles errors gracefully with detailed error messages

#### 2. UserUpstreamApiKeys.cs Updates

Added registration for OpenRouter API key:
- Key type: `openrouter_api`
- JS prefix: `openrouter`
- Create link: `https://openrouter.ai/keys`
- Appears in User tab's API Keys section

#### 3. BasicAPIFeatures.cs Updates

Added registration of the new OpenRouter API endpoints in the main API registration.

### Frontend Components

#### 1. promptllm.js (`src/wwwroot/js/genpage/gentab/promptllm.js`)

Main JavaScript handler for the Prompt LLM feature (formerly llmrefiner.js):

**Class: PromptLLM** (formerly LLMPromptRefiner)

Core Methods:
- `init()`: Loads available models from OpenRouter API
- `openModal()`: Opens the modal and detects source, fetches LoRA metadata
- `detectSource()`: Automatically determines source with enhanced context control
- `executeAction()`: Routes to appropriate action based on active tab (refine/generate/blend)
- `applyResult()`: Applies the result from any mode to the prompt box

Refinement Methods:
- `refinePrompt()`: Sends the prompt to OpenRouter for refinement with enhanced system prompt
- `displayRefinedPrompt()`: Shows the refined result
- `displayDiff()`: Generates a visual diff showing added/removed words

Generation Methods:
- `generatePrompt()`: Generates a complete prompt from minimal input
- `displayGeneratedPrompt()`: Displays the generated result
- `applyGeneratedPrompt()`: Applies generated prompt to the prompt box

Blending Methods:
- `blendPrompts()`: Blends multiple prompts together
- `displayBlendedPrompt()`: Displays the blended result
- `applyBlendedPrompt()`: Applies blended prompt to the prompt box

Enhanced Features:
- `fetchLoraMetadata()`: Retrieves available LoRAs and trigger words
- `buildSystemPromptWithBestPractices()`: Builds comprehensive system prompt with best practices and LoRA awareness
- `checkVisionSupport()`: Checks model vision capability and warns user
- `populateModelDropdown()`: Populates all model dropdowns for different tabs

**Features**:
- Tabbed interface for Refine, Generate, and Blend modes
- Automatic source detection (image tags vs text prompt)
- Enhanced context control (replace, inspire, append modes)
- Model selection with recommended models shown first
- Simple word-based diff visualization
- Best practices integration
- LoRA metadata awareness and suggestions
- Error handling for API failures
- Backward compatibility maintained with legacy API

#### 2. prompttools.js Updates

Updated "Refine with LLM" to "Prompt LLM" in the prompt tools menu (the + button next to the prompt box).
This button opens the enhanced Prompt LLM modal when clicked.

#### 3. GenTabModals.cshtml Updates

Significantly enhanced modal (`llm_prompt_refine_modal`) with:
- **Tabbed Interface**: Three tabs (Refine, Generate, Blend)
- **Refine Tab**:
  - Model selection dropdown
  - Additional instructions textarea
  - Vision bypass checkbox
  - Context mode selector (replace/inspire/append)
  - Source information display
  - Original and refined prompt areas
  - Visual diff display
  - Status messages and error handling
- **Generate Tab**:
  - Model selection dropdown
  - Idea/keywords input
  - Style input (optional)
  - Detail level selector
  - Generated prompt display
- **Blend Tab**:
  - Model selection dropdown
  - Three prompt input areas
  - Blend mode selector
  - Blended prompt display
- Unified action button that adapts to current tab
- "Apply" button to insert result into prompt box

#### 4. Text2Image.cshtml Updates

Updated script reference from `llmrefiner.js` to `promptllm.js` to reflect the renamed file.

### Enhanced Context Control

The new context modes allow users to control how image metadata is used:

1. **Replace Mode** (default): Traditional behavior - uses image tags as the source
2. **Inspire Mode**: Keeps the current prompt, uses image metadata as inspiration
3. **Append Mode**: Appends image metadata to the current prompt

This addresses the requirement for retaining prompts while taking inspiration from image metadata.

### Best Practices System Prompt

The enhanced system prompt includes:
- Clear, descriptive Danbooru-style tag guidelines
- Quality tag recommendations (masterpiece, best quality, etc.)
- Composition and lighting guidance
- Logical tag organization (subject → setting → style → quality)
- NSFW content preservation (no censoring)
- LoRA awareness and suggestion capability

### LoRA Metadata Integration

When available, the system prompt includes:
- List of available LoRAs
- Trigger words for each LoRA (when metadata provides them)
- Instructions for suggesting LoRAs using `<lora:name>` syntax
- Limited to top 20 LoRAs to avoid token overflow

## User Experience Flow

### Refine Mode
1. User clicks the "+" button next to the prompt box
2. Selects "Prompt LLM" from the menu
3. Modal opens on the "Refine" tab showing:
   - Detected source (image tags or prompt text)
   - Original text to be refined
   - Model selection dropdown
   - Context mode selector (if image metadata available)
4. User selects a model and optionally adjusts context mode
5. Clicks "Execute" button
6. System sends prompt to OpenRouter API with enhanced system prompt
7. Refined prompt is displayed along with a visual diff
8. User reviews the changes
9. If satisfied, user clicks "Apply" to use the refined prompt

### Generate Mode
1. User clicks the "+" button next to the prompt box
2. Selects "Prompt LLM" from the menu
3. Switches to the "Generate" tab
4. Enters a simple idea or keywords (e.g., "cyberpunk warrior")
5. Optionally specifies a style (e.g., "anime")
6. Selects detail level (minimal to extreme)
7. Clicks "Execute" button
8. System generates a complete, detailed prompt
9. Generated prompt is displayed
10. User clicks "Apply" to use the generated prompt

### Blend Mode
1. User clicks the "+" button next to the prompt box
2. Selects "Prompt LLM" from the menu
3. Switches to the "Blend" tab
4. Enters 2-3 prompts to blend together
5. Selects blend mode (balanced, favor first, creative, or structured)
6. Clicks "Execute" button
7. System blends the prompts intelligently
8. Blended prompt is displayed
9. User clicks "Apply" to use the blended prompt

## Key Features Summary

1. **Three-in-One Tool**: Refine, Generate, and Blend prompts in a single interface
2. **Automatic Source Detection**: Intelligently detects whether to use image metadata tags or current prompt text
3. **Enhanced Context Control**: Choose how to use image metadata (replace, inspire, or append)
4. **Multiple Model Support**: Access to various LLM models through OpenRouter (Claude, GPT-4, Gemini, Llama, etc.)
5. **Best Practices Integration**: System prompts include comprehensive guidelines for quality prompts
6. **LoRA Awareness**: Automatically suggests appropriate LoRAs with trigger words
7. **Visual Diff**: Clear visualization of changes with added words in green and removed words in red
8. **Error Handling**: Graceful handling of API errors, missing keys, and network issues
9. **Secure Key Storage**: API keys stored securely in user profile using existing SwarmUI infrastructure
10. **Easy Integration**: Accessible via the familiar prompt tools menu

## Technical Decisions

1. **OpenRouter Integration**: Chose OpenRouter as it provides access to multiple LLM providers through a single API
2. **Tabbed Interface**: Used Bootstrap tabs for clean separation of three modes
3. **Simple Diff Algorithm**: Implemented a straightforward word-based diff for clarity and performance
4. **Async/Await Pattern**: Used modern async patterns for API calls to ensure responsive UI
5. **Bootstrap Modals**: Leveraged existing modal infrastructure for consistency with SwarmUI design
6. **Existing API Key Infrastructure**: Reused SwarmUI's existing API key management system
7. **Backward Compatibility**: Maintained alias for legacy code (`llmPromptRefiner`)

## Files Modified/Created

### Created:
- `src/wwwroot/js/genpage/gentab/promptllm.js` (renamed from llmrefiner.js)

### Modified:
- `src/WebAPI/OpenRouterAPI.cs` (already existed, no changes in this update)
- `src/Pages/Text2Image.cshtml` (updated script reference)
- `src/Pages/_Generate/GenTabModals.cshtml` (enhanced modal with tabs and new features)
- `src/wwwroot/js/genpage/gentab/prompttools.js` (updated menu label)
- `IMPLEMENTATION_SUMMARY.md` (this file, updated documentation)

### Removed:
- `src/wwwroot/js/genpage/gentab/llmrefiner.js` (renamed to promptllm.js)

## Build Status

✅ Project builds successfully with no warnings or errors
✅ All new code follows existing SwarmUI patterns and conventions
✅ Documentation is comprehensive and user-friendly

## Testing Recommendations

When testing this feature:

1. **API Key Configuration**:
   - Test with valid OpenRouter API key
   - Test with invalid API key
   - Test with no API key configured

2. **Model Selection**:
   - Verify models load correctly
   - Test refinement with different model types
   - Verify recommended models appear first

3. **Source Detection**:
   - Test with image selected (has metadata)
   - Test with image selected (no metadata)
   - Test with no image selected
   - Test with empty prompt

4. **Refinement Process**:
   - Verify prompt is sent correctly
   - Check refined prompt is displayed
   - Verify diff shows correctly
   - Test applying refined prompt

5. **Error Handling**:
   - Test network failures
   - Test API rate limits
   - Test invalid responses
   - Verify error messages are clear

## Future Enhancements (Optional)

Potential improvements that could be added later:

1. **More Advanced Diff**: Could integrate a library like `diff-match-patch` for more sophisticated diffing
2. **Prompt History**: Save refined prompts for later reference
3. **Custom System Prompts**: Allow users to customize the refinement instructions
4. **Batch Refinement**: Refine multiple prompts at once
5. **Model Favorites**: Let users save their preferred models
6. **Cost Tracking**: Display estimated API costs before refinement
7. **Offline Models**: Support for local LLM models

## Security Considerations

- API keys are stored in user profile using SwarmUI's existing secure storage
- All API communications use HTTPS
- No sensitive data is logged
- User prompts are sent to third-party services (OpenRouter/LLM providers) - documented in privacy section

## Accessibility

- Modal can be closed with keyboard (ESC key)
- All interactive elements are keyboard-accessible
- Error messages are clear and actionable
- Status updates are provided during async operations

## Performance

- Model list is cached after first load
- Minimal impact on page load time
- Async operations don't block UI
- Graceful degradation if API is unavailable
