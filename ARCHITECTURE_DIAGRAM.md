# LLM Prompt Refinement - Architecture Diagram (Mermaid)

```mermaid
flowchart TD
   %% Nodes
   U[User]

   subgraph FE[SwarmUI Frontend]
      GT[Generate Tab<br/>[Prompt Box] [ + Button ]]
      PTM[Prompt Tools Menu<br/>• Auto Segment<br/>• Regional Prompt<br/>• Upload Image<br/>• Refine with LLM]
      LMM[LLM Refinement Modal<br/>Source: Image Tags / Prompt Text (auto)<br/>Original: Text Area<br/>Model: Dropdown<br/>[Refine] → Refined + Diff<br/>[Apply] [Close]]
      JS[llmrefiner.js]
      GT --> PTM
      PTM -->|Refine with LLM| LMM
      LMM <-->|Open/Apply/Close| JS
   end

   subgraph BE[SwarmUI Backend (C#)]
      ORAPI[OpenRouterAPI.cs<br/>GetOpenRouterModels()<br/>RefinePromptWithOpenRouter()]
      KEYS[UserUpstreamApiKeys.cs<br/>(openrouter_api, civitai_api,<br/>stability_api, huggingface_api)]
      ORAPI <--> KEYS
   end

   subgraph OR[OpenRouter API]
      MODELS[GET /api/v1/models<br/>Returns model list]
      CHAT[POST /api/v1/chat/completions<br/>Routes to selected provider]
      subgraph LLMs[LLM Providers]
         Claude[Claude (Anthropic)]
         GPT4[GPT-4 (OpenAI)]
         Gemini[Gemini (Google)]
         Llama[Llama (Meta)]
      end
      CHAT --> Claude
      CHAT --> GPT4
      CHAT --> Gemini
      CHAT --> Llama
   end

   %% Flows
   U -->|Clicks "+" → "Refine with LLM"| GT
   JS -->|HTTP POST| ORAPI
   ORAPI -->|HTTPS GET models| MODELS
   MODELS -->|Model list| ORAPI
   ORAPI -->|Models| JS
   ORAPI -->|HTTPS POST chat/completions| CHAT
   CHAT -->|LLM response| ORAPI
   ORAPI -->|Refined prompt| JS
   JS -->|Update UI: Original / Refined / Diff| LMM

   %% Data source detection (frontend)
   DS[(Image selected?)] -. checks .- JS
   DS -. Yes → Use image tags .- LMM
   DS -. No → Use prompt text .- LMM

   %% Apply back to prompt box
   LMM -->|Apply refined prompt| GT

   %% Security & Privacy
   subgraph SEC[Security & Privacy]
      S1[API Key: Encrypted at rest in user profile]
      S2[HTTPS: All API comms encrypted in transit]
      S3[No Logging: Prompts not logged by SwarmUI]
      S4[Third‑party: Prompts sent to OpenRouter/LLM providers]
      S5[User Control: Explicit API key config and manual trigger]
   end
   KEYS --- S1
   ORAPI --- S2
   FE --- S3
   FE --- S5
   OR --- S4

   %% Error Handling
   subgraph ERR[Error Handling]
      E1[Frontend<br/>• Empty prompt detection<br/>• No model selected warning<br/>• Network error handling]
      E2[Backend<br/>• API key validation<br/>• Request validation<br/>• OpenRouter API error handling<br/>• Timeout handling]
      E3[UI Feedback<br/>• Clear error messages<br/>• Status updates during processing<br/>• Graceful degradation]
   end
   FE --- E1
   BE --- E2
   FE --- E3
```
