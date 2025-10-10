# LLM Prompt Refinement Feature - Implementation Summary

## Overview

This document provides a comprehensive summary of the LLM-based prompt refinement feature that has been integrated into SwarmUI.

## Implementation Details

### Backend Components

#### 1. OpenRouterAPI.cs (`src/WebAPI/OpenRouterAPI.cs`)

A new API class that handles all communication with OpenRouter's API:

- **GetOpenRouterModels**: Fetches the list of available LLM models from OpenRouter
  - Retrieves models from `https://openrouter.ai/api/v1/models`
  - Formats them for the UI dropdown
  - Requires OpenRouter API key to be configured

- **RefinePromptWithOpenRouter**: Sends prompts to the selected LLM model for refinement
  - Accepts model ID, source text, and source type (image tags or prompt text)
  - Uses different system prompts based on source type
  - Returns refined prompt text
  - Handles errors gracefully

#### 2. UserUpstreamApiKeys.cs Updates

Added registration for OpenRouter API key:
- Key type: `openrouter_api`
- JS prefix: `openrouter`
- Create link: `https://openrouter.ai/keys`
- Appears in User tab's API Keys section

#### 3. BasicAPIFeatures.cs Updates

Added registration of the new OpenRouter API endpoints in the main API registration.

### Frontend Components

#### 1. llmrefiner.js (`src/wwwroot/js/genpage/gentab/llmrefiner.js`)

Main JavaScript handler for the LLM refinement feature:

**Class: LLMPromptRefiner**
- `init()`: Loads available models from OpenRouter API
- `openModal()`: Opens the refinement modal and detects source (image tags or prompt text)
- `detectSource()`: Automatically determines whether to use image metadata or prompt text
- `refinePrompt()`: Sends the prompt to OpenRouter for refinement
- `displayRefinedPrompt()`: Shows the refined result
- `displayDiff()`: Generates a visual diff showing added/removed words
- `applyRefinedPrompt()`: Applies the refined prompt to the prompt box

**Features**:
- Automatic source detection (image tags vs text prompt)
- Model selection with recommended models shown first
- Simple word-based diff visualization
- Error handling for API failures

#### 2. prompttools.js Updates

Added "Refine with LLM" button to the prompt tools menu (the + button next to the prompt box).
This button opens the LLM refinement modal when clicked.

#### 3. GenTabModals.cshtml Updates

Added a new modal (`llm_prompt_refine_modal`) with:
- Model selection dropdown
- Source information display
- Original prompt text area
- Refined prompt text area
- Visual diff display
- Status messages and error handling
- "Refine" and "Apply" buttons

#### 4. Text2Image.cshtml Updates

Added script reference to include the new `llmrefiner.js` file in the page.

### Documentation

#### 1. LLMPromptRefinement.md (`docs/Features/LLMPromptRefinement.md`)

Comprehensive user documentation including:
- Feature overview and capabilities
- Setup instructions (getting OpenRouter API key)
- Usage guide with step-by-step instructions
- Tips for model selection and iterative refinement
- Example workflow
- Troubleshooting guide
- Privacy and cost information

#### 2. Features README.md Updates

Added link to the new LLM Prompt Refinement documentation.

#### 3. Main README.md Updates

Removed "LLM-assisted prompting" from the "Key feature targets not yet implemented" list.

## User Experience Flow

1. User clicks the "+" button next to the prompt box
2. Selects "Refine with LLM" from the menu
3. Modal opens showing:
   - Detected source (image tags or prompt text)
   - Original text to be refined
   - Model selection dropdown
4. User selects a model from the dropdown
5. Clicks "Refine" button
6. System sends prompt to OpenRouter API
7. Refined prompt is displayed along with a visual diff
8. User reviews the changes
9. If satisfied, user clicks "Apply" to use the refined prompt

## Key Features

1. **Automatic Source Detection**: Intelligently detects whether to use image metadata tags or current prompt text
2. **Multiple Model Support**: Access to various LLM models through OpenRouter (Claude, GPT-4, Gemini, Llama, etc.)
3. **Visual Diff**: Clear visualization of changes with added words in green and removed words in red
4. **Error Handling**: Graceful handling of API errors, missing keys, and network issues
5. **Secure Key Storage**: API keys stored securely in user profile using existing SwarmUI infrastructure
6. **Easy Integration**: Accessible via the familiar prompt tools menu

## Technical Decisions

1. **OpenRouter Integration**: Chose OpenRouter as it provides access to multiple LLM providers through a single API
2. **Simple Diff Algorithm**: Implemented a straightforward word-based diff for clarity and performance
3. **Async/Await Pattern**: Used modern async patterns for API calls to ensure responsive UI
4. **Bootstrap Modals**: Leveraged existing modal infrastructure for consistency with SwarmUI design
5. **Existing API Key Infrastructure**: Reused SwarmUI's existing API key management system

## Files Modified/Created

### Created:
- `src/WebAPI/OpenRouterAPI.cs`
- `src/wwwroot/js/genpage/gentab/llmrefiner.js`
- `docs/Features/LLMPromptRefinement.md`

### Modified:
- `src/WebAPI/BasicAPIFeatures.cs`
- `src/WebAPI/UserUpstreamApiKeys.cs`
- `src/Pages/Text2Image.cshtml`
- `src/Pages/_Generate/GenTabModals.cshtml`
- `src/wwwroot/js/genpage/gentab/prompttools.js`
- `docs/Features/README.md`
- `README.md`

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
