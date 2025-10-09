# LLM-Based Prompt Refinement

SwarmUI includes an integrated LLM-based prompt refinement feature that allows you to use various LLM models via OpenRouter to refine and improve your prompts.

## Features

- **Model Selection**: Choose from a wide variety of LLM models available through OpenRouter
- **Automatic Source Detection**: The feature automatically detects whether to use image tags (from a selected image) or your current prompt text
- **Visual Diff Display**: See a clear comparison showing what words were added or removed during refinement
- **Easy Application**: Apply refined prompts with a single click

## Setup

### 1. Get an OpenRouter API Key

1. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in to your OpenRouter account
3. Create a new API key

### 2. Configure SwarmUI

1. In SwarmUI, navigate to the **User** tab
2. Scroll down to the **API Keys** section
3. Find the **OpenRouter** row
4. Paste your API key into the input field
5. Click **Save**

## Usage

### Accessing the Feature

1. Navigate to the **Generate** tab
2. Click the **+** button next to the prompt text box
3. Select **Refine with LLM** from the menu

### Refining a Prompt

1. The modal will open showing:
   - **Source**: Either "Image Tags from selected image" or "Current Prompt Text"
   - **Original**: The text that will be refined
   - **Select Model**: A dropdown to choose your preferred LLM model

2. Select an LLM model from the dropdown
   - Recommended models are shown first (Claude, GPT-4, Gemini, etc.)
   - You can choose from many other available models

3. Click the **Refine** button
   - The system will send your prompt to the selected LLM
   - Wait a few seconds for the refinement to complete

4. Review the results:
   - **Refined**: The improved prompt text
   - **Changes**: A visual diff showing removed words (red) and added words (green)

5. If you're satisfied with the refinement, click **Apply** to use it in your prompt box

### Tips

- **Image Tags Source**: When you have an image selected with metadata, the feature will automatically use the image's prompt tags as the source. This is useful for converting raw tags into coherent prompts.

- **Prompt Text Source**: When no image is selected (or the image has no metadata), it will use your current prompt text from the prompt box.

- **Model Selection**: Different models have different strengths:
  - Claude models are great for detailed, nuanced refinements
  - GPT-4 models excel at creative improvements
  - Gemini is good for balanced refinements
  - Llama models are cost-effective options

- **Iterative Refinement**: You can refine a prompt multiple times with different models to get the best result.

## Example Workflow

1. Generate an image
2. Click on the generated image to select it
3. Click the **+** button next to the prompt box
4. Select **Refine with LLM**
5. Choose a model like "Claude 3.5 Sonnet"
6. Click **Refine**
7. Review the refined prompt
8. Click **Apply** to use the improved prompt
9. Generate a new image with the refined prompt

## Troubleshooting

### "OpenRouter API key not set" Error

Make sure you've properly configured your OpenRouter API key in the User tab's API Keys section.

### "Failed to fetch models from OpenRouter" Error

- Check your internet connection
- Verify your API key is valid
- Ensure you have credits in your OpenRouter account

### "Failed to refine prompt" Error

- Make sure you have sufficient credits in your OpenRouter account
- Try a different model
- Check if the selected model is currently available

## Privacy and Costs

- Your prompts are sent to OpenRouter's API and then forwarded to the selected LLM provider
- OpenRouter charges per API call based on the model used
- Costs vary by model; check [OpenRouter's pricing](https://openrouter.ai/models) for details
- Your API key is stored securely in your SwarmUI user profile

## API Integration Details

The feature uses two main API endpoints:

- `GetOpenRouterModels`: Fetches the list of available models from OpenRouter
- `RefinePromptWithOpenRouter`: Sends the prompt to the selected model for refinement

Both endpoints require a valid OpenRouter API key configured in your user settings.
