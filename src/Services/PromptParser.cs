using FreneticUtilities.FreneticExtensions;
using Newtonsoft.Json.Linq;
using SwarmUI.Utils;
using System.Text.RegularExpressions;

namespace SwarmUI.Services;

/// <summary>Parser for extracting model dependencies from prompts in various formats.</summary>
public static class PromptParser
{
    /// <summary>Parse model dependencies from a prompt/workflow payload.</summary>
    public static List<ModelDependency> ParseDependencies(JObject promptData, string formatHint)
    {
        List<ModelDependency> dependencies = new();

        try
        {
            // Auto-detect format if needed
            string format = formatHint.ToLowerFast();
            if (format == "auto")
            {
                format = DetectFormat(promptData);
            }

            switch (format)
            {
                case "swarmui":
                    dependencies = ParseSwarmUIFormat(promptData);
                    break;
                case "comfyui":
                    dependencies = ParseComfyUIFormat(promptData);
                    break;
                case "a1111":
                    dependencies = ParseA1111Format(promptData);
                    break;
                default:
                    // Try all parsers
                    dependencies = ParseSwarmUIFormat(promptData);
                    if (dependencies.Count == 0)
                    {
                        dependencies = ParseComfyUIFormat(promptData);
                    }
                    if (dependencies.Count == 0)
                    {
                        dependencies = ParseA1111Format(promptData);
                    }
                    break;
            }

            Logs.Debug($"Parsed {dependencies.Count} dependencies from {format} format");
        }
        catch (Exception ex)
        {
            Logs.Error($"Error parsing prompt dependencies: {ex}");
        }

        return dependencies;
    }

    /// <summary>Detect the format of a prompt payload.</summary>
    private static string DetectFormat(JObject data)
    {
        // Check for SwarmUI metadata
        if (data.ContainsKey("sui_image_params") || data.ContainsKey("sui_models"))
        {
            return "swarmui";
        }

        // Check for ComfyUI workflow structure
        if (data.ContainsKey("nodes") || data.ContainsKey("workflow") || 
            (data.Properties().Any(p => p.Value is JObject obj && obj.ContainsKey("class_type"))))
        {
            return "comfyui";
        }

        // Check for A1111 structure
        if (data.ContainsKey("sd_model_checkpoint") || data.ContainsKey("override_settings"))
        {
            return "a1111";
        }

        return "unknown";
    }

    /// <summary>Parse SwarmUI metadata format.</summary>
    private static List<ModelDependency> ParseSwarmUIFormat(JObject data)
    {
        List<ModelDependency> dependencies = new();

        try
        {
            // Parse from sui_image_params
            if (data.TryGetValue("sui_image_params", out JToken paramsToken) && paramsToken is JObject imageParams)
            {
                // Checkpoint model
                if (imageParams.TryGetValue("model", out JToken modelToken))
                {
                    dependencies.Add(CreateDependency("checkpoint", modelToken.ToString()));
                }

                // VAE
                if (imageParams.TryGetValue("vae", out JToken vaeToken))
                {
                    string vae = vaeToken.ToString();
                    if (!string.IsNullOrEmpty(vae) && vae != "Automatic")
                    {
                        dependencies.Add(CreateDependency("vae", vae));
                    }
                }

                // LoRAs (can be comma-separated list)
                if (imageParams.TryGetValue("loras", out JToken lorasToken))
                {
                    string lorasStr = lorasToken.ToString();
                    if (!string.IsNullOrEmpty(lorasStr))
                    {
                        string[] loras = lorasStr.Split(',').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToArray();
                        foreach (string lora in loras)
                        {
                            dependencies.Add(CreateDependency("lora", lora));
                        }
                    }
                }

                // Embeddings (textual inversions)
                if (imageParams.TryGetValue("embeddings", out JToken embeddingsToken))
                {
                    string embeddingsStr = embeddingsToken.ToString();
                    if (!string.IsNullOrEmpty(embeddingsStr))
                    {
                        string[] embeddings = embeddingsStr.Split(',').Select(e => e.Trim()).Where(e => !string.IsNullOrEmpty(e)).ToArray();
                        foreach (string embedding in embeddings)
                        {
                            dependencies.Add(CreateDependency("embedding", embedding));
                        }
                    }
                }
            }

            // Parse from sui_models array
            if (data.TryGetValue("sui_models", out JToken modelsToken) && modelsToken is JArray modelsArray)
            {
                foreach (JToken modelToken in modelsArray)
                {
                    if (modelToken is JObject modelObj)
                    {
                        string modelName = modelObj["name"]?.ToString();
                        string modelParam = modelObj["param"]?.ToString() ?? "checkpoint";
                        string hash = modelObj["hash"]?.ToString();

                        if (!string.IsNullOrEmpty(modelName))
                        {
                            ModelDependency dep = CreateDependency(modelParam, modelName);
                            if (!string.IsNullOrEmpty(hash) && hash.StartsWith("sha256:"))
                            {
                                dep.Sha256 = hash.Substring(7);
                            }
                            dependencies.Add(dep);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Logs.Error($"Error parsing SwarmUI format: {ex}");
        }

        return dependencies;
    }

    /// <summary>Parse ComfyUI workflow format.</summary>
    private static List<ModelDependency> ParseComfyUIFormat(JObject data)
    {
        List<ModelDependency> dependencies = new();

        try
        {
            // ComfyUI workflows can be nested under "workflow" key or directly in root
            JObject workflow = data.TryGetValue("workflow", out JToken workflowToken) && workflowToken is JObject wf ? wf : data;

            // Iterate through all nodes in the workflow
            foreach (var prop in workflow.Properties())
            {
                if (prop.Value is JObject node)
                {
                    if (node.TryGetValue("class_type", out JToken classTypeToken))
                    {
                        string classType = classTypeToken.ToString();
                        if (node.TryGetValue("inputs", out JToken inputsToken) && inputsToken is JObject inputs)
                        {
                            // Checkpoint loaders
                            if (classType.Contains("CheckpointLoader", StringComparison.OrdinalIgnoreCase))
                            {
                                if (inputs.TryGetValue("ckpt_name", out JToken ckptToken))
                                {
                                    dependencies.Add(CreateDependency("checkpoint", ckptToken.ToString()));
                                }
                            }
                            // LoRA loaders
                            else if (classType.Contains("LoraLoader", StringComparison.OrdinalIgnoreCase))
                            {
                                if (inputs.TryGetValue("lora_name", out JToken loraToken))
                                {
                                    dependencies.Add(CreateDependency("lora", loraToken.ToString()));
                                }
                            }
                            // VAE loaders
                            else if (classType.Contains("VAELoader", StringComparison.OrdinalIgnoreCase))
                            {
                                if (inputs.TryGetValue("vae_name", out JToken vaeToken))
                                {
                                    dependencies.Add(CreateDependency("vae", vaeToken.ToString()));
                                }
                            }
                            // ControlNet loaders
                            else if (classType.Contains("ControlNet", StringComparison.OrdinalIgnoreCase))
                            {
                                if (inputs.TryGetValue("control_net_name", out JToken cnToken))
                                {
                                    dependencies.Add(CreateDependency("controlnet", cnToken.ToString()));
                                }
                            }
                            // Embedding/TextualInversion
                            else if (classType.Contains("Embedding", StringComparison.OrdinalIgnoreCase))
                            {
                                if (inputs.TryGetValue("embedding_name", out JToken embToken))
                                {
                                    dependencies.Add(CreateDependency("embedding", embToken.ToString()));
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Logs.Error($"Error parsing ComfyUI format: {ex}");
        }

        return dependencies;
    }

    /// <summary>Parse A1111 format.</summary>
    private static List<ModelDependency> ParseA1111Format(JObject data)
    {
        List<ModelDependency> dependencies = new();

        try
        {
            // Checkpoint model
            if (data.TryGetValue("sd_model_checkpoint", out JToken modelToken))
            {
                dependencies.Add(CreateDependency("checkpoint", modelToken.ToString()));
            }

            // Check override_settings
            if (data.TryGetValue("override_settings", out JToken settingsToken) && settingsToken is JObject settings)
            {
                if (settings.TryGetValue("sd_model_checkpoint", out JToken overrideModelToken))
                {
                    dependencies.Add(CreateDependency("checkpoint", overrideModelToken.ToString()));
                }

                if (settings.TryGetValue("sd_vae", out JToken vaeToken))
                {
                    string vae = vaeToken.ToString();
                    if (!string.IsNullOrEmpty(vae) && vae != "Automatic")
                    {
                        dependencies.Add(CreateDependency("vae", vae));
                    }
                }
            }

            // Extract LoRAs from prompt text using <lora:name:weight> syntax
            if (data.TryGetValue("prompt", out JToken promptToken))
            {
                string prompt = promptToken.ToString();
                Regex loraRegex = new(@"<lora:([^:>]+)(?::[\d.]+)?>");
                MatchCollection matches = loraRegex.Matches(prompt);
                foreach (Match match in matches)
                {
                    if (match.Groups.Count > 1)
                    {
                        dependencies.Add(CreateDependency("lora", match.Groups[1].Value));
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Logs.Error($"Error parsing A1111 format: {ex}");
        }

        return dependencies;
    }

    /// <summary>Create a model dependency from a reference string.</summary>
    private static ModelDependency CreateDependency(string type, string reference)
    {
        ModelDependency dep = new()
        {
            Type = type,
            Reference = reference
        };

        // Parse structured references
        if (reference.StartsWith("sha256:", StringComparison.OrdinalIgnoreCase))
        {
            dep.Sha256 = reference.Substring(7);
        }
        else if (reference.StartsWith("civitai:version:", StringComparison.OrdinalIgnoreCase))
        {
            dep.CivitAIVersionId = reference.Substring(16);
        }
        else
        {
            // Treat as filename or model key
            dep.Filename = reference;
        }

        return dep;
    }
}
