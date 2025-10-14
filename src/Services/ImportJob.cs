using Newtonsoft.Json.Linq;

namespace SwarmUI.Services;

/// <summary>Represents a prompt import job with its status and dependencies.</summary>
public class ImportJob
{
    /// <summary>Unique identifier for this import job.</summary>
    public string JobId { get; set; }

    /// <summary>User ID who initiated the import.</summary>
    public string UserId { get; set; }

    /// <summary>Current status of the import job.</summary>
    public ImportJobStatus Status { get; set; }

    /// <summary>Original prompt data.</summary>
    public JObject PromptData { get; set; }

    /// <summary>Format hint for parsing (swarmui, comfyui, a1111, auto).</summary>
    public string Format { get; set; }

    /// <summary>List of detected model dependencies.</summary>
    public List<ModelDependency> Dependencies { get; set; } = new();

    /// <summary>Progress from 0.0 to 1.0.</summary>
    public double Progress { get; set; }

    /// <summary>Error message if status is Failed.</summary>
    public string ErrorMessage { get; set; }

    /// <summary>When the job was created.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>When the job was last updated.</summary>
    public DateTime LastUpdated { get; set; }

    /// <summary>When the job completed.</summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>Convert to JSON for API responses.</summary>
    public JObject ToJson()
    {
        JObject result = new()
        {
            ["job_id"] = JobId,
            ["status"] = Status.ToString().ToLowerInvariant(),
            ["progress"] = Progress,
            ["created_at"] = CreatedAt.ToString("o"),
            ["last_updated"] = LastUpdated.ToString("o")
        };

        if (CompletedAt.HasValue)
        {
            result["completed_at"] = CompletedAt.Value.ToString("o");
        }

        if (!string.IsNullOrEmpty(ErrorMessage))
        {
            result["error_message"] = ErrorMessage;
        }

        if (Dependencies != null && Dependencies.Count > 0)
        {
            result["dependencies"] = new JArray(Dependencies.Select(d => d.ToJson()));
        }

        return result;
    }
}

/// <summary>Status of an import job.</summary>
public enum ImportJobStatus
{
    /// <summary>Analyzing the prompt to extract dependencies.</summary>
    Analyzing,

    /// <summary>Resolving model dependencies.</summary>
    Resolving,

    /// <summary>Downloading missing models.</summary>
    Downloading,

    /// <summary>All dependencies resolved successfully.</summary>
    Completed,

    /// <summary>Some dependencies resolved, some failed.</summary>
    PartiallyCompleted,

    /// <summary>Job failed.</summary>
    Failed
}

/// <summary>Represents a model dependency extracted from a prompt.</summary>
public class ModelDependency
{
    /// <summary>Type of model (checkpoint, lora, vae, embedding, controlnet, etc.).</summary>
    public string Type { get; set; }

    /// <summary>Original reference string (sha256:..., civitai:version:..., filename, etc.).</summary>
    public string Reference { get; set; }

    /// <summary>Parsed SHA256 hash if available.</summary>
    public string Sha256 { get; set; }

    /// <summary>CivitAI version ID if available.</summary>
    public string CivitAIVersionId { get; set; }

    /// <summary>Filename if available.</summary>
    public string Filename { get; set; }

    /// <summary>Current resolution status.</summary>
    public DependencyStatus Status { get; set; } = DependencyStatus.Pending;

    /// <summary>Resolved local path if found.</summary>
    public string ResolvedPath { get; set; }

    /// <summary>Source where the model was found/downloaded from.</summary>
    public string ResolvedSource { get; set; }

    /// <summary>Error message if resolution failed.</summary>
    public string ErrorMessage { get; set; }

    /// <summary>Download job ID if a download was triggered.</summary>
    public string DownloadJobId { get; set; }

    /// <summary>Convert to JSON for API responses.</summary>
    public JObject ToJson()
    {
        JObject result = new()
        {
            ["type"] = Type,
            ["reference"] = Reference,
            ["status"] = Status.ToString().ToLowerInvariant()
        };

        if (!string.IsNullOrEmpty(Sha256))
        {
            result["sha256"] = Sha256;
        }

        if (!string.IsNullOrEmpty(CivitAIVersionId))
        {
            result["civitai_version_id"] = CivitAIVersionId;
        }

        if (!string.IsNullOrEmpty(Filename))
        {
            result["filename"] = Filename;
        }

        if (!string.IsNullOrEmpty(ResolvedPath))
        {
            result["resolved_path"] = ResolvedPath;
        }

        if (!string.IsNullOrEmpty(ResolvedSource))
        {
            result["resolved_source"] = ResolvedSource;
        }

        if (!string.IsNullOrEmpty(ErrorMessage))
        {
            result["error_message"] = ErrorMessage;
        }

        if (!string.IsNullOrEmpty(DownloadJobId))
        {
            result["download_job_id"] = DownloadJobId;
        }

        return result;
    }
}

/// <summary>Status of a model dependency.</summary>
public enum DependencyStatus
{
    /// <summary>Not yet processed.</summary>
    Pending,

    /// <summary>Found in local catalog.</summary>
    Resolved,

    /// <summary>Found on remote SwarmUI node, download scheduled.</summary>
    DownloadScheduled,

    /// <summary>Currently downloading.</summary>
    Downloading,

    /// <summary>Failed to resolve.</summary>
    Failed
}
