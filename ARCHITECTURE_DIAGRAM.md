# LLM Prompt Refinement - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SwarmUI Frontend                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐         ┌─────────────────────────────┐      │
│  │  Generate Tab    │         │   Prompt Tools Menu         │      │
│  │                  │         │                             │      │
│  │  [Prompt Box]    │────────▶│  • Auto Segment            │      │
│  │  [+ Button]      │         │  • Regional Prompt         │      │
│  │                  │         │  • Upload Image            │      │
│  └──────────────────┘         │  • Refine with LLM ◀───┐   │      │
│                                │  • Other...            │   │      │
│                                └────────────────────────┼───┘      │
│                                                         │           │
│                                                         ▼           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              LLM Refinement Modal                           │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │  Source: [Image Tags / Prompt Text]  (Auto-detected) │ │   │
│  │  │  Original: [Text area with original content]         │ │   │
│  │  │  Model: [Dropdown with LLM models]                   │ │   │
│  │  │                                                       │ │   │
│  │  │  [Refine Button] ────┐                               │ │   │
│  │  │                      │                               │ │   │
│  │  │  After refinement:   ▼                               │ │   │
│  │  │  Refined: [Improved prompt text]                     │ │   │
│  │  │  Changes: [Visual diff: removed | added]             │ │   │
│  │  │                                                       │ │   │
│  │  │  [Apply Button] [Close Button]                       │ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│                                │ llmrefiner.js                      │
│                                │                                    │
└────────────────────────────────┼────────────────────────────────────┘
                                 │
                                 │ HTTP POST
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SwarmUI Backend (C#)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              OpenRouterAPI.cs                               │    │
│  │                                                             │    │
│  │  GetOpenRouterModels()                                      │    │
│  │    ├─ Fetch models from OpenRouter                         │    │
│  │    └─ Return formatted model list                          │    │
│  │                                                             │    │
│  │  RefinePromptWithOpenRouter()                              │    │
│  │    ├─ Validate API key                                     │    │
│  │    ├─ Build request with system prompt                     │    │
│  │    ├─ Send to OpenRouter API                               │    │
│  │    └─ Return refined prompt                                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                │                                     │
│  ┌────────────────────────────┼──────────────────────────────┐     │
│  │  UserUpstreamApiKeys.cs    │                              │     │
│  │    (API Key Storage)       │                              │     │
│  │    • openrouter_api ───────┘                              │     │
│  │    • civitai_api                                          │     │
│  │    • stability_api                                        │     │
│  │    • huggingface_api                                      │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                │ HTTPS Request
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          OpenRouter API                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  GET /api/v1/models                                                  │
│    └─ Returns: List of available LLM models                         │
│                                                                       │
│  POST /api/v1/chat/completions                                      │
│    └─ Forwards request to selected LLM provider:                    │
│                                                                       │
│        ┌────────────┬────────────┬────────────┬────────────┐        │
│        │  Claude    │   GPT-4    │  Gemini    │   Llama    │        │
│        │ (Anthropic)│  (OpenAI)  │  (Google)  │   (Meta)   │        │
│        └────────────┴────────────┴────────────┴────────────┘        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘


Data Flow:
──────────

1. User Action:
   User clicks "+" button → "Refine with LLM"

2. Source Detection (Frontend):
   llmrefiner.js checks:
   - Is image selected? → Use image metadata tags
   - No image? → Use current prompt text

3. Model Loading (if needed):
   Frontend → Backend → OpenRouter → Model List → Display in UI

4. Refinement Process:
   User selects model & clicks "Refine"
   Frontend → Backend (with: modelId, sourceText, isImageTags)
   Backend → OpenRouter → Selected LLM → Refined prompt
   Backend ← OpenRouter ← Response
   Frontend ← Backend ← Refined prompt
   Display: Original, Refined, and Diff

5. Application:
   User clicks "Apply" → Refined prompt replaces original in prompt box


Security & Privacy:
──────────────────

• API Key: Stored securely in user profile (encrypted at rest)
• HTTPS: All API communication encrypted in transit
• No Logging: Prompts not logged by SwarmUI
• Third-party: Prompts sent to OpenRouter/LLM providers (documented)
• User Control: Users must explicitly configure API key and trigger refinement


Error Handling:
───────────────

Level 1 (Frontend):
  • Empty prompt detection
  • No model selected warning
  • Network error handling

Level 2 (Backend):
  • API key validation
  • Request validation
  • OpenRouter API error handling
  • Timeout handling

Level 3 (UI Feedback):
  • Clear error messages
  • Status updates during processing
  • Graceful degradation
```
