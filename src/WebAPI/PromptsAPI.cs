using FreneticUtilities.FreneticExtensions;
using Newtonsoft.Json.Linq;
using SwarmUI.Accounts;
using SwarmUI.Core;
using SwarmUI.Services;
using SwarmUI.Utils;
using System.Collections.Concurrent;
using System.Net.WebSockets;

namespace SwarmUI.WebAPI;

/// <summary>API routes for prompt import and model resolution capabilities.</summary>
[API.APIClass("API routes for importing prompts and auto-resolving model dependencies.")]
public static class PromptsAPI
{
    /// <summary>Active import jobs, keyed by job ID.</summary>
    public static ConcurrentDictionary<string, ImportJob> ActiveJobs = new();

    public static void Register()
    {
        API.RegisterAPICall(ImportPrompt, false, Permissions.DownloadModels);
        API.RegisterAPICall(GetImportJobStatus, false, Permissions.FundamentalModelAccess);
        API.RegisterAPICall(GetImportEventsWS, true, Permissions.FundamentalModelAccess);
    }

    [API.APIDescription("Imports a prompt/workflow and analyzes its model dependencies for auto-download.",
        """
            "job_id": "unique-job-id",
            "status": "analyzing",
            "dependencies": [
                {
                    "type": "checkpoint",
                    "reference": "sha256:abc123...",
                    "status": "pending",
                    "resolution_plan": ["local_check", "remote_check", "civitai_download"]
                }
            ]
        """
        )]
    public static async Task<JObject> ImportPrompt(Session session,
        [API.APIParameter("JSON payload containing the prompt/workflow data.")] string payload,
        [API.APIParameter("Source format hint: 'swarmui', 'comfyui', or 'a1111'.")] string format = "auto")
    {
        try
        {
            JObject promptData = JObject.Parse(payload);
            
            // Create a new import job
            string jobId = Guid.NewGuid().ToString();
            ImportJob job = new()
            {
                JobId = jobId,
                UserId = session.User.UserID,
                Status = ImportJobStatus.Analyzing,
                CreatedAt = DateTime.UtcNow,
                PromptData = promptData,
                Format = format
            };

            ActiveJobs[jobId] = job;

            // Start async processing
            _ = Task.Run(async () =>
            {
                try
                {
                    await ProcessImportJob(job, session);
                }
                catch (Exception ex)
                {
                    Logs.Error($"Error processing import job {jobId}: {ex}");
                    job.Status = ImportJobStatus.Failed;
                    job.ErrorMessage = ex.Message;
                }
            });

            return new JObject()
            {
                ["job_id"] = jobId,
                ["status"] = job.Status.ToString().ToLowerFast(),
                ["message"] = "Import job created and processing started."
            };
        }
        catch (Exception ex)
        {
            Logs.Error($"Error creating import job: {ex}");
            return new JObject()
            {
                ["error"] = $"Failed to create import job: {ex.Message}"
            };
        }
    }

    [API.APIDescription("Gets the status of a prompt import job.",
        """
            "job_id": "unique-job-id",
            "status": "resolving",
            "dependencies": [
                {
                    "type": "checkpoint",
                    "reference": "sha256:abc123...",
                    "status": "resolved",
                    "resolved_path": "/path/to/model.safetensors"
                }
            ],
            "progress": 0.5
        """
        )]
    public static async Task<JObject> GetImportJobStatus(Session session,
        [API.APIParameter("The import job ID to query.")] string jobId)
    {
        if (!ActiveJobs.TryGetValue(jobId, out ImportJob job))
        {
            return new JObject() { ["error"] = "Job not found." };
        }

        if (job.UserId != session.User.UserID && !session.User.HasPermission(Permissions.ViewOthersOutputs))
        {
            return new JObject() { ["error"] = "Permission denied." };
        }

        return job.ToJson();
    }

    [API.APIDescription("WebSocket endpoint for real-time import job progress updates via Server-Sent Events style messages.", "null")]
    public static async Task<JObject> GetImportEventsWS(Session session, WebSocket ws)
    {
        try
        {
            // Send initial connection confirmation
            await ws.SendJson(new JObject() { ["status"] = "connected" }, API.WebsocketTimeout);

            while (ws.State == WebSocketState.Open)
            {
                // Listen for job IDs to subscribe to
                JObject request = await ws.ReceiveJson(1024 * 1024, true);
                if (request is null)
                {
                    await Task.Delay(100);
                    continue;
                }

                if (request.TryGetValue("subscribe_job", out JToken jobIdToken))
                {
                    string jobId = jobIdToken.ToString();
                    if (ActiveJobs.TryGetValue(jobId, out ImportJob job))
                    {
                        if (job.UserId != session.User.UserID && !session.User.HasPermission(Permissions.ViewOthersOutputs))
                        {
                            await ws.SendJson(new JObject() { ["error"] = "Permission denied." }, API.WebsocketTimeout);
                            continue;
                        }

                        // Send current status
                        await ws.SendJson(job.ToJson(), API.WebsocketTimeout);

                        // Monitor for updates
                        DateTime lastUpdate = DateTime.UtcNow;
                        while (ws.State == WebSocketState.Open && job.Status != ImportJobStatus.Completed && job.Status != ImportJobStatus.Failed)
                        {
                            await Task.Delay(500);
                            if (job.LastUpdated > lastUpdate)
                            {
                                await ws.SendJson(job.ToJson(), API.WebsocketTimeout);
                                lastUpdate = job.LastUpdated;
                            }
                        }

                        // Send final status
                        if (ws.State == WebSocketState.Open)
                        {
                            await ws.SendJson(job.ToJson(), API.WebsocketTimeout);
                        }
                    }
                    else
                    {
                        await ws.SendJson(new JObject() { ["error"] = "Job not found." }, API.WebsocketTimeout);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Logs.Error($"Error in import events WebSocket: {ex}");
        }

        return null;
    }

    /// <summary>Process an import job asynchronously.</summary>
    private static async Task ProcessImportJob(ImportJob job, Session session)
    {
        // Parse the prompt to extract model dependencies
        List<ModelDependency> dependencies = PromptParser.ParseDependencies(job.PromptData, job.Format);
        job.Dependencies = dependencies;
        job.Status = ImportJobStatus.Resolving;
        job.LastUpdated = DateTime.UtcNow;

        Logs.Info($"Import job {job.JobId}: Found {dependencies.Count} model dependencies");

        // Resolve each dependency
        ModelDependencyResolver resolver = new(session);
        int resolved = 0;
        foreach (ModelDependency dep in dependencies)
        {
            try
            {
                await resolver.ResolveDependency(dep);
                resolved++;
                job.Progress = (double)resolved / dependencies.Count;
                job.LastUpdated = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                Logs.Error($"Failed to resolve dependency {dep.Reference}: {ex}");
                dep.Status = DependencyStatus.Failed;
                dep.ErrorMessage = ex.Message;
            }
        }

        // Check if all dependencies are resolved
        bool allResolved = dependencies.All(d => d.Status == DependencyStatus.Resolved);
        job.Status = allResolved ? ImportJobStatus.Completed : ImportJobStatus.PartiallyCompleted;
        job.Progress = 1.0;
        job.CompletedAt = DateTime.UtcNow;
        job.LastUpdated = DateTime.UtcNow;

        Logs.Info($"Import job {job.JobId}: {job.Status} - {resolved}/{dependencies.Count} dependencies resolved");
    }
}
