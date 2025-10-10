using Newtonsoft.Json.Linq;
using SwarmUI.Core;
using SwarmUI.Utils;
using SwarmUI.Accounts;
using System.Net.Http;
using System.Text;
using FreneticUtilities.FreneticExtensions;

namespace SwarmUI.WebAPI;

[API.APIClass("API routes for OpenRouter LLM integration.")]
public static class OpenRouterAPI
{
    private static readonly HttpClient httpClient = new();

    public static void Register()
    {
        API.RegisterAPICall(GetOpenRouterModels, false, Permissions.FundamentalGenerateTabAccess);
        API.RegisterAPICall(RefinePromptWithOpenRouter, true, Permissions.BasicImageGeneration);
    }

    [API.APIDescription("Get list of available models from OpenRouter.",
        """
        {
            "models": [
                {
                    "id": "model-id",
                    "name": "Model Name",
                    "supportsVision": true
                }
            ]
        }
        """)]
    public static async Task<JObject> GetOpenRouterModels(Session session)
    {
        string apiKey = session.User.GetGenericData("openrouter_api", "key");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new JObject() { ["error"] = "OpenRouter API key not set. Please configure it in User Settings." };
        }

        try
        {
            using HttpRequestMessage request = new(HttpMethod.Get, "https://openrouter.ai/api/v1/models");
            request.Headers.Add("Authorization", $"Bearer {apiKey}");
            
            HttpResponseMessage response = await httpClient.SendAsync(request);
            string content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Logs.Error($"OpenRouter API error: {response.StatusCode} - {content}");
                return new JObject() { ["error"] = $"Failed to fetch models from OpenRouter: {response.StatusCode}" };
            }

            JObject result = JObject.Parse(content);
            JArray models = result["data"] as JArray;
            
            if (models == null)
            {
                return new JObject() { ["error"] = "Invalid response from OpenRouter API" };
            }

            // Filter and format models for the UI
            JArray formattedModels = new JArray();
            foreach (JObject model in models)
            {
                // Check if model supports vision/multimodal capabilities
                bool supportsVision = false;
                JToken architecture = model["architecture"];
                if (architecture != null)
                {
                    string archStr = architecture.ToString().ToLower();
                    // Common vision model indicators
                    supportsVision = archStr.Contains("vision") || archStr.Contains("multimodal");
                }
                
                // Also check model ID for vision indicators
                string modelId = model["id"]?.ToString() ?? "";
                if (modelId.Contains("vision") || modelId.Contains("gpt-4") || modelId.Contains("claude-3") || 
                    modelId.Contains("gemini") || modelId.Contains("pixtral"))
                {
                    supportsVision = true;
                }

                formattedModels.Add(new JObject()
                {
                    ["id"] = model["id"],
                    ["name"] = model["name"] ?? model["id"],
                    ["supportsVision"] = supportsVision
                });
            }

            return new JObject() { ["models"] = formattedModels };
        }
        catch (Exception ex)
        {
            Logs.Error($"Error fetching OpenRouter models: {ex}");
            return new JObject() { ["error"] = $"Error fetching models: {ex.Message}" };
        }
    }

    [API.APIDescription("Refine a prompt using OpenRouter LLM.",
        """
        {
            "refined_prompt": "refined text"
        }
        """)]
    public static async Task<JObject> RefinePromptWithOpenRouter(
        Session session,
        [API.APIParameter("The model ID to use for refinement.")] string modelId,
        [API.APIParameter("The prompt or image tags to refine.")] string sourceText,
        [API.APIParameter("Whether the source is from image tags (true) or text prompt (false).")] bool isImageTags = false,
        [API.APIParameter("Custom system prompt to use (optional).")] string systemPrompt = null,
        [API.APIParameter("Whether to bypass sending image data even if available.")] bool bypassVision = false)
    {
        string apiKey = session.User.GetGenericData("openrouter_api", "key");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new JObject() { ["error"] = "OpenRouter API key not set. Please configure it in User Settings." };
        }

        if (string.IsNullOrWhiteSpace(modelId))
        {
            return new JObject() { ["error"] = "Model ID is required." };
        }

        if (string.IsNullOrWhiteSpace(sourceText))
        {
            return new JObject() { ["error"] = "Source text is required." };
        }

        try
        {
            // Use custom system prompt if provided, otherwise use defaults
            if (string.IsNullOrWhiteSpace(systemPrompt))
            {
                systemPrompt = isImageTags
                    ? "You are a helpful AI assistant. The user will provide image tags. Your task is to convert these tags into a well-structured, coherent prompt for image generation. Keep the core concepts but make the text flow naturally."
                    : "You are a helpful AI assistant. The user will provide a prompt for image generation. Your task is to refine and improve it while keeping the core concepts. Make it more descriptive, coherent, and effective for generating high-quality images.";
            }

            JObject requestBody = new JObject()
            {
                ["model"] = modelId,
                ["messages"] = new JArray()
                {
                    new JObject()
                    {
                        ["role"] = "system",
                        ["content"] = systemPrompt
                    },
                    new JObject()
                    {
                        ["role"] = "user",
                        ["content"] = sourceText
                    }
                },
                ["max_tokens"] = 500,
                ["temperature"] = 0.7
            };

            using HttpRequestMessage request = new(HttpMethod.Post, "https://openrouter.ai/api/v1/chat/completions");
            request.Headers.Add("Authorization", $"Bearer {apiKey}");
            request.Headers.Add("HTTP-Referer", "https://swarmui.net");
            request.Headers.Add("X-Title", "SwarmUI");
            request.Content = new StringContent(requestBody.ToString(), Encoding.UTF8, "application/json");

            HttpResponseMessage response = await httpClient.SendAsync(request);
            string content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Logs.Error($"OpenRouter API error: {response.StatusCode} - {content}");
                return new JObject() { ["error"] = $"Failed to refine prompt: {response.StatusCode}" };
            }

            JObject result = JObject.Parse(content);
            string refinedPrompt = result["choices"]?[0]?["message"]?["content"]?.ToString();

            if (string.IsNullOrWhiteSpace(refinedPrompt))
            {
                return new JObject() { ["error"] = "Invalid response from OpenRouter API" };
            }

            return new JObject() { ["refined_prompt"] = refinedPrompt.Trim() };
        }
        catch (Exception ex)
        {
            Logs.Error($"Error refining prompt with OpenRouter: {ex}");
            return new JObject() { ["error"] = $"Error refining prompt: {ex.Message}" };
        }
    }
}
