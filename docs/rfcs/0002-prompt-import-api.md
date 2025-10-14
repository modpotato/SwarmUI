# RFC 0002: Prompt Import API with Automatic Model Resolution

Status: Draft  
Author: modpotato  
Created: 2025-10-14  
Target Version: vNext  
Depends On: RFC 0001

## Summary

Introduces a prompt import API that accepts prompts/workflows in various formats (SwarmUI, ComfyUI, A1111) and automatically resolves their model dependencies. The system checks local catalogs first, then remote SwarmUI nodes (via RFC 0001 manifests), and finally CivitAI for on-demand download.

## Goals

- Enable users to import prompts with automatic model dependency resolution
- Support common prompt formats: SwarmUI metadata, ComfyUI workflows, A1111 parameters
- Recognize model references by SHA256 hash, CivitAI version ID, or filename
- Provide transparent progress tracking through job status and SSE
- Respect license policies and ToS requirements for CivitAI downloads

## Non-Goals

- UI implementation (backend-only; UI can be added in follow-up PR)
- Automatic execution of imported prompts (resolution only)
- Recursive dependency resolution (e.g., LoRAs that require specific checkpoints)

## API Endpoints

### POST /v1/prompts/import

Import a prompt/workflow and analyze its model dependencies.

**Request:**
```json
{
  "payload": "{...}",  // JSON string containing prompt data
  "format": "auto"     // Optional: "swarmui", "comfyui", "a1111", or "auto"
}
```

**Response:**
```json
{
  "job_id": "unique-job-id",
  "status": "analyzing",
  "message": "Import job created and processing started."
}
```

### GET /v1/prompts/import/{job_id}

Get the current status of an import job.

**Response:**
```json
{
  "job_id": "unique-job-id",
  "status": "resolving",
  "progress": 0.5,
  "created_at": "2025-10-14T04:00:00Z",
  "last_updated": "2025-10-14T04:00:05Z",
  "dependencies": [
    {
      "type": "checkpoint",
      "reference": "sha256:abc123...",
      "sha256": "abc123...",
      "status": "resolved",
      "resolved_path": "/path/to/model.safetensors",
      "resolved_source": "local"
    },
    {
      "type": "lora",
      "reference": "my-lora.safetensors",
      "filename": "my-lora.safetensors",
      "status": "download_scheduled",
      "resolved_source": "civitai"
    }
  ]
}
```

### GET /v1/prompts/import/events (WebSocket)

Subscribe to real-time progress updates for import jobs.

**Request (after connection):**
```json
{
  "subscribe_job": "unique-job-id"
}
```

**Progress Messages:**
```json
{
  "job_id": "unique-job-id",
  "status": "downloading",
  "progress": 0.75,
  "dependencies": [...]
}
```

## Prompt Format Support

### SwarmUI Format

Extracts dependencies from `sui_image_params` and `sui_models`:

```json
{
  "sui_image_params": {
    "model": "OfficialStableDiffusion/sd_xl_base_1.0",
    "loras": "lora1,lora2",
    "vae": "sdxl_vae"
  },
  "sui_models": [
    {
      "name": "model/path.safetensors",
      "param": "model",
      "hash": "sha256:abc123..."
    }
  ]
}
```

### ComfyUI Format

Parses workflow nodes with `class_type` and `inputs`:

```json
{
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "model.safetensors"
    }
  },
  "2": {
    "class_type": "LoraLoader",
    "inputs": {
      "lora_name": "lora.safetensors"
    }
  }
}
```

Supported node types:
- CheckpointLoader* → checkpoint
- LoraLoader* → lora
- VAELoader* → vae
- ControlNet* → controlnet
- Embedding* → embedding

### A1111 Format

Extracts from standard A1111 parameters:

```json
{
  "sd_model_checkpoint": "model.safetensors",
  "prompt": "1girl, <lora:style:1.0>",
  "override_settings": {
    "sd_vae": "vae.safetensors"
  }
}
```

## Model Reference Formats

### SHA256 Hash (Preferred)

```
sha256:a1b2c3d4e5f6...
```

Provides content-addressed lookup with integrity verification. Checked against:
1. Local model catalog (via `T2IModel.Metadata.Hash`)
2. Remote SwarmUI manifests
3. CivitAI hash endpoint (`/v1/model-versions/by-hash/{hash}`)

### CivitAI Version ID

```
civitai:version:123456
```

Direct lookup via CivitAI API (`/v1/model-versions/{id}`).

### Filename/Model Key

```
model/path/name.safetensors
```

Fallback for local-only resolution. Matches against:
- Exact model name in catalog
- Name + `.safetensors` extension
- Partial case-insensitive match

## Resolution Flow

```
1. Local Catalog Check
   ├─ Match by SHA256 hash → RESOLVED
   ├─ Match by filename/key → RESOLVED
   └─ Not found → Continue

2. Remote SwarmUI Nodes (RFC 0001)
   ├─ Query manifests for hash match
   ├─ Schedule HTTP download
   └─ Not available → Continue

3. CivitAI Resolution
   ├─ Lookup by SHA256 or versionId
   ├─ Check license policy
   ├─ Schedule download → DOWNLOAD_SCHEDULED
   └─ Not found/not allowed → FAILED
```

## Configuration

New settings in `Settings.CivitAI`:

```json
{
  "CivitAI": {
    "AllowedLicenses": ["commercial", "noncommercial"],
    "AllowTosAutoAccept": false,
    "MaxDownloadSizeBytes": 10737418240,
    "AllowedRemoteNodes": "https://node1.example.com,https://node2.example.com"
  }
}
```

**AllowedLicenses**: Whitelist of acceptable licenses for auto-download. Empty = allow all.

**AllowTosAutoAccept**: If false, models requiring ToS acceptance are blocked (fail-safe default).

**MaxDownloadSizeBytes**: Size limit for auto-downloads (default 10GB).

**AllowedRemoteNodes**: Comma-separated list of trusted remote SwarmUI node URLs for manifest queries.

## Security Considerations

### License Compliance

- Enforces `AllowedLicenses` policy before scheduling CivitAI downloads
- Requires explicit ToS auto-accept setting (defaults to false)
- Logs all download decisions for audit trail

### Content Verification

- SHA256 hashes verified on download (when available)
- Failed hash verification aborts import
- Users notified of verification failures

### Permission Model

- Import API requires `Permissions.DownloadModels`
- Job status requires `Permissions.FundamentalModelAccess` or ownership
- CivitAI API key stored per-user (existing `UserUpstreamApiKeys`)

### Resource Limits

- Job status tracked in-memory (consider disk persistence for production)
- Download size limits prevent resource exhaustion
- Concurrent download limits inherit from existing orchestrator

## Implementation Notes

### Component Structure

```
Services/
├─ ImportJob.cs           # Job state and status tracking
├─ PromptParser.cs        # Format detection and parsing
├─ ModelDependencyResolver.cs  # Resolution orchestration
└─ CivitAIResolver.cs     # CivitAI API integration

WebAPI/
└─ PromptsAPI.cs         # HTTP/WebSocket endpoints
```

### Job Lifecycle

1. **Analyzing**: Parsing prompt to extract dependencies
2. **Resolving**: Checking local/remote catalogs
3. **Downloading**: Active downloads in progress
4. **Completed**: All dependencies resolved
5. **PartiallyCompleted**: Some dependencies failed
6. **Failed**: Critical error during processing

### Future Enhancements

- Persistent job storage (database)
- Webhook notifications on completion
- Batch import for multiple prompts
- Dependency graph visualization
- Automatic prompt execution after resolution

## Testing

Basic unit tests should cover:

1. **Prompt Parsing**
   - SwarmUI metadata extraction
   - ComfyUI workflow node parsing
   - A1111 parameter extraction
   - Format auto-detection

2. **Local Resolution**
   - SHA256 hash matching
   - Filename/key matching
   - Partial name matching

3. **CivitAI Integration**
   - Hash lookup (mocked)
   - Version ID lookup (mocked)
   - License policy enforcement

## Migration Path

For existing users:
- No breaking changes to existing APIs
- New endpoints are additive
- Configuration options default to safe/conservative values
- Per-user CivitAI API keys already supported

## Related Work

- RFC 0001: Remote model auto-download (manifest & HTTP transfer)
- Existing `DoModelDownloadWS`: WebSocket-based download with progress
- `UserUpstreamApiKeys`: Per-user API key storage (CivitAI, HuggingFace, etc.)

## References

- CivitAI API: https://github.com/civitai/civitai/wiki/REST-API-Reference
- SwarmUI Image Metadata Format: docs/Image Metadata Format.md
