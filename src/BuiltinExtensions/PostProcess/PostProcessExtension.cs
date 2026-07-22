using FreneticUtilities.FreneticExtensions;
using Newtonsoft.Json.Linq;
using SwarmUI.Accounts;
using SwarmUI.Core;
using SwarmUI.Utils;
using SwarmUI.WebAPI;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using System.IO;

namespace SwarmUI.Builtin_PostProcessExtension;

/// <summary>Post-processing extension: watermarking, tag generation, and workflow-based post-processing.</summary>
public class PostProcessExtension : Extension
{
    /// <inheritdoc/>
    public override void OnPreInit()
    {
        ScriptFiles.Add("Assets/postprocess.js");
        StyleSheetFiles.Add("Assets/postprocess.css");
    }

    /// <inheritdoc/>
    public override void OnInit()
    {
        API.RegisterAPICall(ApplyWatermark, true, Permissions.BasicImageGeneration);
        API.RegisterAPICall(GenerateTagsWithLLM, true, Permissions.BasicImageGeneration);
        API.RegisterAPICall(SaveTextFile, true, Permissions.BasicImageGeneration);
        API.RegisterAPICall(PostProcessAndSave, true, Permissions.BasicImageGeneration);
    }

    /// <summary>Applies a lighten-blend watermark overlay to a base image at the given opacity.</summary>
    private static void ApplyLightenOverlay(Image<Rgba32> baseImg, Image<Rgba32> wmImg, int originX, int originY, float opacity)
    {
        for (int wy = 0; wy < wmImg.Height; wy++)
        {
            for (int wx = 0; wx < wmImg.Width; wx++)
            {
                int px = originX + wx;
                int py = originY + wy;
                Rgba32 basePixel = baseImg[px, py];
                Rgba32 wmPixel = wmImg[wx, wy];
                byte r = Math.Max(basePixel.R, wmPixel.R);
                byte g = Math.Max(basePixel.G, wmPixel.G);
                byte b = Math.Max(basePixel.B, wmPixel.B);
                baseImg[px, py] = new Rgba32(
                    (byte)(basePixel.R + (r - basePixel.R) * opacity),
                    (byte)(basePixel.G + (g - basePixel.G) * opacity),
                    (byte)(basePixel.B + (b - basePixel.B) * opacity),
                    basePixel.A);
            }
        }
    }

    /// <summary>Computes the overlay origin for a given corner placement.</summary>
    private static (int, int) ComputeOrigin(int baseW, int baseH, int wmW, int wmH, string corner)
    {
        return corner switch
        {
            "top-left" => (0, 0),
            "top-right" => (baseW - wmW, 0),
            "bottom-left" => (0, baseH - wmH),
            _ => (baseW - wmW, baseH - wmH)
        };
    }

    /// <summary>Applies a transparent lighten-blend watermark to an image.</summary>
    public static async Task<JObject> ApplyWatermark(Session session, string image, int alpha = 10, string corner = "bottom-right")
    {
        string watermarkPath = Path.Combine(Utilities.DataDirectory, "watermark.png");
        if (!File.Exists(watermarkPath))
        {
            return new JObject() { ["error"] = "No watermark image found. Place a PNG at Data/watermark.png." };
        }
        byte[] imageBytes = Convert.FromBase64String(image.After("base64,"));
        using Image<Rgba32> baseImg = Image.Load<Rgba32>(imageBytes);
        using Image<Rgba32> wmImg = Image.Load<Rgba32>(watermarkPath);
        if (wmImg.Width > baseImg.Width || wmImg.Height > baseImg.Height)
        {
            return new JObject() { ["error"] = "Watermark image is larger than the source image." };
        }
        (int originX, int originY) = ComputeOrigin(baseImg.Width, baseImg.Height, wmImg.Width, wmImg.Height, corner);
        ApplyLightenOverlay(baseImg, wmImg, originX, originY, Math.Clamp(alpha, 1, 255) / 255f);
        using MemoryStream ms = new();
        await baseImg.SaveAsPngAsync(ms);
        string base64 = Convert.ToBase64String(ms.ToArray());
        return new JObject() { ["image"] = $"data:image/png;base64,{base64}" };
    }

    /// <summary>Generates tags for an image using an LLM with vision, given generation context.</summary>
    public static async Task<JObject> GenerateTagsWithLLM(Session session, string imageData, string generationTags, string loraNames, string inferredTags, bool includeArtistNames, string modelId)
    {
        string apiKey = session.User.GetGenericData("openrouter_api", "key");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new JObject() { ["error"] = "No OpenRouter API key configured. Set it in User Settings." };
        }
        string artistInstruction = includeArtistNames
            ? $"Include artist names as tags if identifiable from the LoRAs or image. LoRAs used: {loraNames}. Derive artist tags from LoRA names where applicable."
            : "Do NOT include any artist names, artist tags, or creator attributions in the output. Remove any artist-related tags entirely. Even if LoRAs reference an artist, omit those tags.";
        string systemPrompt = $"""
            You are an expert image tagger specializing in Danbooru-format tag lists for AI-generated artwork.
            You will receive an image along with context about how it was generated.
            Your task is to produce a comprehensive, accurate Danbooru-format tag list.

            Rules:
            - Output tags as a single comma-separated line
            - ALWAYS include the meta tag "ai_generated" in the output
            - Use underscores for multi-word tags (e.g., "long_hair" not "long hair")
            - Order: artist tags (if allowed), character tags, copyright/IP tags, general descriptor tags, meta tags
            - Be precise: only tag what is actually visible or strongly implied
            - Include quality tags (e.g., masterpiece, best_quality) only if the image genuinely warrants them
            - {artistInstruction}

            Generation context provided:
            - Original prompt tags: {generationTags}
            - LoRAs used: {loraNames}
            - Inferred tags from image analysis: {inferredTags}

            Use the generation context to inform your tagging, but always verify against the actual image.
            The inferred tags may contain errors - use your vision to correct them.
            """;
        JObject requestBody = new()
        {
            ["model"] = modelId,
            ["messages"] = new JArray(
                new JObject() { ["role"] = "system", ["content"] = systemPrompt },
                new JObject()
                {
                    ["role"] = "user",
                    ["content"] = new JArray(
                        new JObject() { ["type"] = "text", ["text"] = "Tag this image in Danbooru format." },
                        new JObject()
                        {
                            ["type"] = "image_url",
                            ["image_url"] = new JObject() { ["url"] = imageData }
                        }
                    )
                }
            ),
            ["max_tokens"] = 1024,
            ["temperature"] = 0.3
        };
        using HttpClient client = new();
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        HttpResponseMessage response = await client.PostAsync("https://openrouter.ai/api/v1/chat/completions",
            new StringContent(requestBody.ToString(), System.Text.Encoding.UTF8, "application/json"));
        string responseText = await response.Content.ReadAsStringAsync();
        JObject responseJson = JObject.Parse(responseText);
        string content = responseJson["choices"]?[0]?["message"]?["content"]?.ToString();
        if (string.IsNullOrWhiteSpace(content))
        {
            return new JObject() { ["error"] = $"LLM returned empty response. Raw: {responseText[..Math.Min(500, responseText.Length)]}" };
        }
        return new JObject() { ["tags"] = content.Trim() };
    }

    /// <summary>Saves a text file alongside an output image (e.g. a .txt sidecar for tags).</summary>
    public static async Task<JObject> SaveTextFile(Session session, string path, string content)
    {
        string outputPath = Program.ServerSettings.Paths.OutputPath;
        if (Program.ServerSettings.Paths.AppendUserNameToOutputPath)
        {
            outputPath = Path.Combine(outputPath, session.User.UserName);
        }
        string fullPath = Path.GetFullPath(Path.Combine(outputPath, path));
        if (!fullPath.StartsWith(Path.GetFullPath(outputPath)))
        {
            return new JObject() { ["error"] = "Invalid path." };
        }
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath));
        await File.WriteAllTextAsync(fullPath, content);
        return new JObject() { ["success"] = true };
    }

    /// <summary>Full post-process pipeline: watermark, EXIF strip, save to post-process directory with tag sidecar.</summary>
    public static async Task<JObject> PostProcessAndSave(Session session, string image, string tags, int alpha = 10, string corner = "bottom-right", string filename = "")
    {
        byte[] imageBytes = Convert.FromBase64String(image.After("base64,"));
        using Image<Rgba32> baseImg = Image.Load<Rgba32>(imageBytes);
        string watermarkPath = Path.Combine(Utilities.DataDirectory, "watermark.png");
        if (File.Exists(watermarkPath))
        {
            using Image<Rgba32> wmImg = Image.Load<Rgba32>(watermarkPath);
            if (wmImg.Width <= baseImg.Width && wmImg.Height <= baseImg.Height)
            {
                (int originX, int originY) = ComputeOrigin(baseImg.Width, baseImg.Height, wmImg.Width, wmImg.Height, corner);
                ApplyLightenOverlay(baseImg, wmImg, originX, originY, Math.Clamp(alpha, 1, 255) / 255f);
            }
        }
        string outputPath = Program.ServerSettings.Paths.OutputPath;
        if (Program.ServerSettings.Paths.AppendUserNameToOutputPath)
        {
            outputPath = Path.Combine(outputPath, session.User.UserName);
        }
        string postProcessDir = Path.Combine(outputPath, "postprocess");
        Directory.CreateDirectory(postProcessDir);
        if (string.IsNullOrWhiteSpace(filename))
        {
            filename = $"postprocess_{DateTimeOffset.UtcNow:yyyy-MM-dd_HH-mm-ss}";
        }
        filename = Utilities.StrictFilenameClean(filename);
        string imgPath = Path.Combine(postProcessDir, $"{filename}.png");
        string txtPath = Path.Combine(postProcessDir, $"{filename}.txt");
        await baseImg.SaveAsPngAsync(imgPath);
        string finalTags = tags.Trim();
        if (!finalTags.Contains("ai_generated"))
        {
            finalTags = $"ai_generated, {finalTags}";
        }
        await File.WriteAllTextAsync(txtPath, finalTags);
        string viewPrefix = Program.ServerSettings.Paths.AppendUserNameToOutputPath ? $"View/{session.User.UserName}" : "Output";
        return new JObject()
        {
            ["success"] = true,
            ["image_path"] = $"{viewPrefix}/postprocess/{filename}.png",
            ["tags"] = finalTags
        };
    }
}
