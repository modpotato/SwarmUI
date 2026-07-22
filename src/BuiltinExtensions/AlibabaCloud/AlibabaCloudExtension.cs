using FreneticUtilities.FreneticDataSyntax;
using FreneticUtilities.FreneticExtensions;
using Newtonsoft.Json.Linq;
using SwarmUI.Accounts;
using SwarmUI.Backends;
using SwarmUI.Core;
using SwarmUI.Media;
using SwarmUI.Text2Image;
using SwarmUI.Utils;
using SwarmUI.WebAPI;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.WebSockets;
using Image = SwarmUI.Utils.Image;

namespace SwarmUI.Builtin_AlibabaCloudExtension;

/// <summary>Alibaba Cloud Model Studio remote image generation backend and video generation UI.</summary>
public class AlibabaCloudExtension : Extension
{
    /// <summary>The automatically available Alibaba image backend type.</summary>
    public static BackendHandler.BackendType BackendType;

    /// <summary>Alibaba model IDs exposed through SwarmUI's standard image model selector.</summary>
    public static readonly string[] ImageModels = ["alibaba-cloud/wan2.7-image", "alibaba-cloud/wan2.7-image-pro"];

    /// <inheritdoc/>
    public override void OnPreInit()
    {
        ScriptFiles.Add("Assets/alibaba_video.js");
        StyleSheetFiles.Add("Assets/alibaba_video.css");
    }

    /// <inheritdoc/>
    public override void OnInit()
    {
        BackendType = Program.Backends.RegisterBackendType<AlibabaCloudBackend>("alibaba_cloud", "Alibaba Cloud Model Studio",
            "Remote Wan 2.7 image generation through Alibaba Cloud Model Studio, including Token Plan endpoints.", true);
        ModelsAPI.ExtraModelProviders["alibaba_cloud"] = ProvideModels;
        API.RegisterAPICall(GenerateAlibabaVideoWS, true, Permissions.BasicImageGeneration);
    }

    /// <inheritdoc/>
    public override void OnPreLaunch()
    {
        Program.Backends.AddNewNonrealBackend(BackendType, null, preModify: data =>
        {
            data.AbstractBackend.Title = "Alibaba Cloud";
        });
    }

    /// <summary>Provides virtual remote Wan image models to the standard model list.</summary>
    public static Dictionary<string, JObject> ProvideModels(string subtype)
    {
        if (subtype != "Stable-Diffusion")
        {
            return [];
        }
        Dictionary<string, JObject> result = [];
        foreach (string name in ImageModels)
        {
            bool isPro = name.EndsWith("-pro");
            result[name] = new JObject()
            {
                ["name"] = name,
                ["title"] = isPro ? "Alibaba Wan 2.7 Image Pro" : "Alibaba Wan 2.7 Image",
                ["description"] = isPro
                    ? "Remote Alibaba Cloud Wan 2.7 image generation with up to 4K text-to-image output."
                    : "Remote Alibaba Cloud Wan 2.7 image generation optimized for speed.",
                ["preview_image"] = "",
                ["loaded"] = Program.Backends.RunningBackendsOfType<AlibabaCloudBackend>().Any(),
                ["architecture"] = null,
                ["class"] = "Alibaba Cloud",
                ["compat_class"] = null,
                ["standard_width"] = 1024,
                ["standard_height"] = 1024,
                ["is_supported_model_format"] = true,
                ["local"] = false,
                ["time_created"] = 0,
                ["time_modified"] = 0
            };
        }
        return result;
    }

    /// <summary>Generates a HappyHorse video, streams task state, saves the MP4, and returns its permanent SwarmUI URL.</summary>
    public static async Task<JObject> GenerateAlibabaVideoWS(WebSocket socket, Session session,
        [API.APIParameter("Prompt describing the requested video.")] string prompt,
        [API.APIParameter("HappyHorse model ID: happyhorse-1.1-t2v, happyhorse-1.1-i2v, or happyhorse-1.1-r2v.")] string model,
        [API.APIParameter("Reference images encoded as data URLs.")] string[] reference_images = null,
        [API.APIParameter("Output resolution: 720P or 1080P.")] string resolution = "720P",
        [API.APIParameter("Output aspect ratio.")] string ratio = "16:9",
        [API.APIParameter("Output duration in seconds, from 3 through 15.")] int duration = 5)
    {
        HashSet<string> allowedModels = ["happyhorse-1.1-t2v", "happyhorse-1.1-i2v", "happyhorse-1.1-r2v"];
        if (!allowedModels.Contains(model))
        {
            throw new SwarmReadableErrorException("Unsupported Alibaba video model.");
        }
        if (string.IsNullOrWhiteSpace(prompt))
        {
            throw new SwarmReadableErrorException("A video prompt is required.");
        }
        reference_images ??= [];
        if (model.EndsWith("-t2v") && reference_images.Length != 0)
        {
            throw new SwarmReadableErrorException("Text-to-video does not accept reference images.");
        }
        if (model.EndsWith("-i2v") && reference_images.Length != 1)
        {
            throw new SwarmReadableErrorException("Image-to-video requires exactly one first-frame image.");
        }
        if (model.EndsWith("-r2v") && (reference_images.Length < 1 || reference_images.Length > 9))
        {
            throw new SwarmReadableErrorException("Reference-to-video requires between one and nine reference images.");
        }
        if (resolution != "720P" && resolution != "1080P")
        {
            throw new SwarmReadableErrorException("Resolution must be 720P or 1080P.");
        }
        HashSet<string> allowedRatios = ["16:9", "9:16", "3:4", "4:3", "4:5", "5:4", "1:1", "9:21", "21:9"];
        if (!allowedRatios.Contains(ratio))
        {
            throw new SwarmReadableErrorException("Unsupported HappyHorse aspect ratio.");
        }
        duration = Math.Clamp(duration, 3, 15);
        using Session.GenClaim claim = session.Claim(gens: 1, liveGens: 1);
        AlibabaCloudAPI.Config config = AlibabaCloudAPI.ResolveConfig(session);
        JArray media = [];
        string mediaType = model.EndsWith("-i2v") ? "first_frame" : "reference_image";
        foreach (string image in reference_images)
        {
            if (!image.StartsWith("data:image/"))
            {
                throw new SwarmReadableErrorException("Alibaba reference images must be uploaded image files.");
            }
            media.Add(new JObject() { ["type"] = mediaType, ["url"] = image });
        }
        JObject input = new() { ["prompt"] = prompt };
        if (media.Count > 0)
        {
            input["media"] = media;
        }
        JObject request = new()
        {
            ["model"] = model,
            ["input"] = input,
            ["parameters"] = new JObject()
            {
                ["resolution"] = resolution,
                ["ratio"] = ratio,
                ["duration"] = duration,
                ["watermark"] = false
            }
        };
        (string taskID, string videoURL) = await AlibabaCloudAPI.GenerateVideo(config, request, async status =>
        {
            await socket.SendJson(status, API.WebsocketTimeout);
        }, claim.InterruptToken);
        byte[] videoBytes = await AlibabaCloudAPI.Download(videoURL, claim.InterruptToken);
        VideoFile video = new(videoBytes, MediaType.VideoMp4);
        T2IParamInput userInput = new(session);
        userInput.Set(T2IParamTypes.Prompt, prompt);
        userInput.Set(T2IParamTypes.Model, new T2IModel(null, null, null, $"alibaba-cloud/{model}"));
        userInput.ExtraMeta["model"] = model;
        userInput.ExtraMeta["alibaba_task_id"] = taskID;
        userInput.ExtraMeta["video_resolution"] = resolution;
        userInput.ExtraMeta["video_ratio"] = ratio;
        userInput.ExtraMeta["video_duration"] = duration;
        (Task<MediaFile> actualFile, string metadata) = session.ApplyMetadata(video, userInput, 0, true);
        T2IEngine.ImageOutput output = new() { File = video, ActualFileTask = actualFile };
        (string url, _) = session.SaveImage(output, 0, userInput, metadata);
        if (url == "ERROR")
        {
            throw new SwarmReadableErrorException("The generated video could not be saved.");
        }
        await socket.SendJson(new JObject()
        {
            ["video"] = url,
            ["task_id"] = taskID,
            ["metadata"] = metadata,
            ["status"] = "SUCCEEDED"
        }, API.WebsocketTimeout);
        return null;
    }
}

/// <summary>Automatically available T2I backend for Alibaba Wan 2.7 image models.</summary>
public class AlibabaCloudBackend : AbstractT2IBackend
{
    /// <summary>Backend-local concurrency settings.</summary>
    public class AlibabaCloudBackendSettings : AutoConfiguration
    {
        /// <summary>Maximum concurrent requests accepted by the automatic backend.</summary>
        [ConfigComment("Maximum simultaneous Alibaba image requests issued by this SwarmUI server.")]
        public int MaxSimultaneousRequests = 4;
    }

    /// <summary>Typed backend settings.</summary>
    public AlibabaCloudBackendSettings Settings => SettingsRaw as AlibabaCloudBackendSettings;

    /// <inheritdoc/>
    public override IEnumerable<string> SupportedFeatures => ["remote", "alibaba_cloud"];

    /// <inheritdoc/>
    public override async Task Init()
    {
        MaxUsages = Math.Clamp(Settings.MaxSimultaneousRequests, 1, 32);
        Models = new ConcurrentDictionary<string, List<string>>();
        Models["Stable-Diffusion"] = [.. AlibabaCloudExtension.ImageModels];
        CurrentModelName = AlibabaCloudExtension.ImageModels[0];
        Status = BackendStatus.RUNNING;
    }

    /// <inheritdoc/>
    public override async Task Shutdown()
    {
        Status = BackendStatus.DISABLED;
    }

    /// <inheritdoc/>
    public override bool IsValidForThisBackend(T2IParamInput input)
    {
        T2IModel model = input.Get(T2IParamTypes.Model);
        if (model is null || !AlibabaCloudExtension.ImageModels.Contains(model.Name))
        {
            input.RefusalReasons.Add("Alibaba Cloud only accepts its Wan 2.7 remote image models.");
            return false;
        }
        return true;
    }

    /// <inheritdoc/>
    public override async Task<bool> LoadModel(T2IModel model, T2IParamInput input)
    {
        if (!AlibabaCloudExtension.ImageModels.Contains(model.Name))
        {
            return false;
        }
        CurrentModelName = model.Name;
        return true;
    }

    /// <inheritdoc/>
    public override async Task<Image[]> Generate(T2IParamInput user_input)
    {
        List<Image> images = [];
        await GenerateLive(user_input, "0", output =>
        {
            if (output is Image image)
            {
                images.Add(image);
            }
        });
        return [.. images];
    }

    /// <inheritdoc/>
    public override async Task GenerateLive(T2IParamInput user_input, string batchId, Action<object> takeOutput)
    {
        AlibabaCloudAPI.Config config = AlibabaCloudAPI.ResolveConfig(user_input.SourceSession);
        T2IModel selectedModel = user_input.Get(T2IParamTypes.Model);
        string model = selectedModel.Name.After("alibaba-cloud/");
        JArray content = [new JObject() { ["text"] = user_input.Get(T2IParamTypes.Prompt, "") }];
        if (user_input.TryGet(T2IParamTypes.InitImage, out Image initImage))
        {
            content.Insert(0, new JObject() { ["image"] = initImage.AsDataString() });
        }
        JObject request = new()
        {
            ["model"] = model,
            ["input"] = new JObject()
            {
                ["messages"] = new JArray(new JObject()
                {
                    ["role"] = "user",
                    ["content"] = content
                })
            },
            ["parameters"] = new JObject()
            {
                ["size"] = $"{user_input.GetImageWidth(1024)}*{user_input.GetImageHeight(1024)}",
                ["n"] = 1,
                ["watermark"] = false
            }
        };
        List<string> urls = await AlibabaCloudAPI.GenerateImages(config, request, user_input.InterruptToken);
        foreach (string url in urls)
        {
            byte[] bytes = await AlibabaCloudAPI.Download(url, user_input.InterruptToken);
            takeOutput(new Image(bytes, MediaType.ImagePng));
        }
    }
}

/// <summary>Shared Alibaba Cloud direct API client and hierarchical configuration resolver.</summary>
public static class AlibabaCloudAPI
{
    /// <summary>Resolved credentials and endpoint for one request.</summary>
    public record class Config(string APIKey, string BaseURL, int PollIntervalSeconds, int TimeoutMinutes);

    /// <summary>Shared HTTP client for Alibaba requests and expiring result downloads.</summary>
    public static readonly HttpClient Client = NetworkBackendUtils.MakeHttpClient(20);

    /// <summary>Resolves user, server, and environment configuration in descending priority.</summary>
    public static Config ResolveConfig(Session session)
    {
        string userKey = session?.User?.Settings?.AlibabaCloud?.APIKey;
        string serverKey = Program.ServerSettings.AlibabaCloud.APIKey;
        string key = !string.IsNullOrWhiteSpace(userKey) ? userKey
            : !string.IsNullOrWhiteSpace(serverKey) ? serverKey
            : Environment.GetEnvironmentVariable("ALIBABA_TOKEN_PLAN_API_KEY");
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new SwarmReadableErrorException("Alibaba Cloud API key is not configured. Set it in User or Server settings, or set ALIBABA_TOKEN_PLAN_API_KEY.");
        }
        string baseURL = Program.ServerSettings.AlibabaCloud.BaseURL;
        if (string.IsNullOrWhiteSpace(baseURL))
        {
            baseURL = "https://token-plan.ap-southeast-1.maas.aliyuncs.com";
        }
        baseURL = NormalizeBaseURL(baseURL);
        return new(key.Trim(), baseURL, Math.Clamp(Program.ServerSettings.AlibabaCloud.VideoPollIntervalSeconds, 5, 60),
            Math.Clamp(Program.ServerSettings.AlibabaCloud.VideoTimeoutMinutes, 1, 120));
    }

    /// <summary>Normalizes OpenAI-compatible or direct settings to the root host used by DashScope APIs.</summary>
    public static string NormalizeBaseURL(string url)
    {
        url = url.Trim().TrimEnd('/');
        foreach (string suffix in new[] { "/compatible-mode/v1", "/api/v1" })
        {
            if (url.EndsWith(suffix))
            {
                url = url[..^suffix.Length];
            }
        }
        if (!url.StartsWith("https://") && !url.StartsWith("http://"))
        {
            throw new SwarmReadableErrorException("Alibaba Cloud Base URL must start with https:// or http://.");
        }
        return url;
    }

    /// <summary>Sends an authenticated Alibaba JSON request and validates its error envelope.</summary>
    public static async Task<JObject> Send(Config config, HttpMethod method, string path, JObject body, bool isAsync, CancellationToken cancel)
    {
        using HttpRequestMessage request = new(method, $"{config.BaseURL}{path}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.APIKey);
        if (isAsync)
        {
            request.Headers.Add("X-DashScope-Async", "enable");
        }
        if (body is not null)
        {
            request.Content = Utilities.JSONContent(body);
        }
        using HttpResponseMessage response = await Client.SendAsync(request, cancel);
        string raw = await response.Content.ReadAsStringAsync(cancel);
        JObject result;
        try
        {
            result = JObject.Parse(raw);
        }
        catch (Exception)
        {
            throw new SwarmReadableErrorException($"Alibaba Cloud returned HTTP {(int)response.StatusCode} with an invalid response.");
        }
        string code = result["code"]?.ToString() ?? result["output"]?["code"]?.ToString();
        string message = result["message"]?.ToString() ?? result["output"]?["message"]?.ToString();
        if (!response.IsSuccessStatusCode || !string.IsNullOrWhiteSpace(code))
        {
            throw new SwarmReadableErrorException($"Alibaba Cloud request failed{(string.IsNullOrWhiteSpace(code) ? "" : $" ({code})")}: {message ?? response.ReasonPhrase}");
        }
        return result;
    }

    /// <summary>Runs a synchronous Wan multimodal image request and extracts all output URLs.</summary>
    public static async Task<List<string>> GenerateImages(Config config, JObject body, CancellationToken cancel)
    {
        JObject response = await Send(config, HttpMethod.Post, "/api/v1/services/aigc/multimodal-generation/generation", body, false, cancel);
        List<string> urls = [];
        JArray choices = response["output"]?["choices"] as JArray;
        if (choices is not null)
        {
            foreach (JObject choice in choices.OfType<JObject>())
            {
                JArray content = choice["message"]?["content"] as JArray;
                if (content is null)
                {
                    continue;
                }
                foreach (JObject item in content.OfType<JObject>())
                {
                    string url = item["image"]?.ToString();
                    if (!string.IsNullOrWhiteSpace(url))
                    {
                        urls.Add(url);
                    }
                }
            }
        }
        if (urls.Count == 0)
        {
            throw new SwarmReadableErrorException("Alibaba Cloud returned no generated images.");
        }
        return urls;
    }

    /// <summary>Submits and polls an asynchronous HappyHorse video request.</summary>
    public static async Task<(string TaskID, string VideoURL)> GenerateVideo(Config config, JObject body, Func<JObject, Task> update, CancellationToken cancel)
    {
        JObject submitted = await Send(config, HttpMethod.Post, "/api/v1/services/aigc/video-generation/video-synthesis", body, true, cancel);
        string taskID = submitted["output"]?["task_id"]?.ToString();
        if (string.IsNullOrWhiteSpace(taskID))
        {
            throw new SwarmReadableErrorException("Alibaba Cloud did not return a video task ID.");
        }
        await update(new JObject() { ["status"] = submitted["output"]?["task_status"]?.ToString() ?? "PENDING", ["task_id"] = taskID });
        DateTimeOffset expires = DateTimeOffset.UtcNow.AddMinutes(config.TimeoutMinutes);
        string priorStatus = "";
        while (DateTimeOffset.UtcNow < expires)
        {
            await Task.Delay(TimeSpan.FromSeconds(config.PollIntervalSeconds), cancel);
            JObject result = await Send(config, HttpMethod.Get, $"/api/v1/tasks/{Uri.EscapeDataString(taskID)}", null, false, cancel);
            JObject output = result["output"] as JObject;
            string status = output?["task_status"]?.ToString() ?? "UNKNOWN";
            if (status != priorStatus)
            {
                await update(new JObject() { ["status"] = status, ["task_id"] = taskID });
                priorStatus = status;
            }
            if (status == "SUCCEEDED")
            {
                string url = output?["video_url"]?.ToString();
                if (string.IsNullOrWhiteSpace(url))
                {
                    throw new SwarmReadableErrorException("Alibaba Cloud completed the task without returning a video URL.");
                }
                return (taskID, url);
            }
            if (status == "FAILED" || status == "CANCELED" || status == "UNKNOWN")
            {
                string message = output?["message"]?.ToString() ?? "The remote video task failed.";
                throw new SwarmReadableErrorException($"Alibaba Cloud video task {status}: {message}");
            }
        }
        throw new SwarmReadableErrorException($"Alibaba Cloud video task timed out after {config.TimeoutMinutes} minutes.");
    }

    /// <summary>Downloads an expiring Alibaba result URL immediately.</summary>
    public static async Task<byte[]> Download(string url, CancellationToken cancel)
    {
        using HttpResponseMessage response = await Client.GetAsync(url, cancel);
        if (!response.IsSuccessStatusCode)
        {
            throw new SwarmReadableErrorException($"Failed to download Alibaba result: HTTP {(int)response.StatusCode}.");
        }
        return await response.Content.ReadAsByteArrayAsync(cancel);
    }
}
