# Prompt Import API - Test Cases

This document outlines test cases for the Prompt Import API functionality. These can be executed manually or converted to automated tests when test infrastructure is added.

## Test Data Setup

### Sample SwarmUI Prompt

```json
{
  "sui_image_params": {
    "model": "OfficialStableDiffusion/sd_xl_base_1.0",
    "loras": "detail-tweaker,style-lora",
    "vae": "sdxl_vae",
    "prompt": "a beautiful landscape"
  },
  "sui_models": [
    {
      "name": "OfficialStableDiffusion/sd_xl_base_1.0.safetensors",
      "param": "model",
      "hash": "sha256:abc123def456"
    }
  ]
}
```

### Sample ComfyUI Workflow

```json
{
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "sd_xl_base_1.0.safetensors"
    }
  },
  "2": {
    "class_type": "LoraLoader",
    "inputs": {
      "lora_name": "detail-tweaker.safetensors"
    }
  },
  "3": {
    "class_type": "VAELoader",
    "inputs": {
      "vae_name": "sdxl_vae.safetensors"
    }
  }
}
```

### Sample A1111 Parameters

```json
{
  "sd_model_checkpoint": "sd_xl_base_1.0.safetensors",
  "prompt": "a beautiful landscape, <lora:style:1.0>, <lora:quality:0.8>",
  "override_settings": {
    "sd_vae": "sdxl_vae.safetensors"
  }
}
```

## Test Cases

### 1. Format Detection

#### Test 1.1: SwarmUI Format Detection
**Input:** SwarmUI metadata with `sui_image_params`  
**Expected:** Format detected as "swarmui"  
**Verification:** `PromptParser.DetectFormat()` returns "swarmui"

#### Test 1.2: ComfyUI Format Detection
**Input:** ComfyUI workflow with node structure  
**Expected:** Format detected as "comfyui"  
**Verification:** `PromptParser.DetectFormat()` returns "comfyui"

#### Test 1.3: A1111 Format Detection
**Input:** A1111 parameters with `sd_model_checkpoint`  
**Expected:** Format detected as "a1111"  
**Verification:** `PromptParser.DetectFormat()` returns "a1111"

### 2. Dependency Extraction

#### Test 2.1: SwarmUI Checkpoint Extraction
**Input:** SwarmUI prompt with model parameter  
**Expected:** Dependency created with type="checkpoint"  
**Verification:** 
- `dependencies[0].Type == "checkpoint"`
- `dependencies[0].Reference == "OfficialStableDiffusion/sd_xl_base_1.0"`

#### Test 2.2: SwarmUI LoRA Extraction
**Input:** SwarmUI prompt with comma-separated LoRAs  
**Expected:** Multiple LoRA dependencies  
**Verification:**
- Count of dependencies with type="lora" == 2
- References include "detail-tweaker" and "style-lora"

#### Test 2.3: SwarmUI SHA256 Hash Extraction
**Input:** SwarmUI prompt with `sui_models` array containing hash  
**Expected:** Dependency with SHA256 populated  
**Verification:**
- `dependencies[0].Sha256 == "abc123def456"`

#### Test 2.4: ComfyUI Checkpoint Extraction
**Input:** ComfyUI workflow with CheckpointLoaderSimple node  
**Expected:** Dependency with type="checkpoint"  
**Verification:**
- `dependencies[0].Type == "checkpoint"`
- `dependencies[0].Filename == "sd_xl_base_1.0.safetensors"`

#### Test 2.5: ComfyUI Multiple Node Types
**Input:** ComfyUI workflow with Checkpoint, LoRA, and VAE loaders  
**Expected:** Three dependencies with correct types  
**Verification:**
- Dependency types include "checkpoint", "lora", and "vae"
- Each has correct filename

#### Test 2.6: A1111 LoRA Extraction from Prompt
**Input:** A1111 prompt with `<lora:name:weight>` syntax  
**Expected:** LoRA dependencies extracted from prompt text  
**Verification:**
- Dependencies with type="lora" found
- References include "style" and "quality"

### 3. Model Resolution

#### Test 3.1: Local Resolution by Exact Name
**Setup:** Model exists in local catalog with exact name match  
**Expected:** Dependency resolved locally  
**Verification:**
- `dependency.Status == DependencyStatus.Resolved`
- `dependency.ResolvedSource == "local"`
- `dependency.ResolvedPath` points to model file

#### Test 3.2: Local Resolution with .safetensors Extension
**Setup:** Model exists without extension in reference  
**Expected:** Resolved with extension added  
**Verification:**
- Dependency resolved successfully
- ResolvedPath includes ".safetensors"

#### Test 3.3: Local Resolution by SHA256
**Setup:** Model with matching SHA256 hash in metadata  
**Expected:** Dependency resolved by hash  
**Verification:**
- Dependency resolved even if filename differs
- Hash match logged

#### Test 3.4: Local Resolution by Partial Name
**Setup:** Model with similar name in catalog  
**Expected:** Resolved via case-insensitive partial match  
**Verification:**
- Dependency resolved
- Warning logged about partial match

#### Test 3.5: Failed Local Resolution
**Setup:** Model not in local catalog  
**Expected:** Proceeds to remote/CivitAI resolution  
**Verification:**
- Local resolution returns false
- Next resolution step attempted

### 4. CivitAI Resolution

#### Test 4.1: CivitAI Lookup by SHA256
**Setup:** Mock CivitAI API returning model info for hash  
**Expected:** Model info retrieved successfully  
**Verification:**
- API called with correct hash
- Model info parsed correctly

#### Test 4.2: CivitAI Lookup by Version ID
**Setup:** Mock CivitAI API returning model info for version ID  
**Expected:** Model info retrieved successfully  
**Verification:**
- API called with correct version ID
- Download URL extracted

#### Test 4.3: License Policy Enforcement
**Setup:** Model with non-commercial license, policy set to commercial-only  
**Expected:** Download blocked due to license mismatch  
**Verification:**
- `dependency.Status == DependencyStatus.Failed`
- Error message mentions license restriction

#### Test 4.4: ToS Auto-Accept Disabled
**Setup:** `AllowTosAutoAccept == false`  
**Expected:** Conservative behavior (currently allows if no other restrictions)  
**Verification:**
- Check logged decision
- Future: Should block if ToS required

#### Test 4.5: CivitAI API Key Missing
**Setup:** User has no CivitAI API key configured  
**Expected:** CivitAI resolution skipped  
**Verification:**
- Debug log indicates no API key
- Returns false without API call

### 5. Import Job Workflow

#### Test 5.1: Complete Job Flow
**Setup:** Import prompt with all dependencies locally available  
**Expected:** Job completes successfully  
**Verification:**
- Job status progresses: Analyzing → Resolving → Completed
- `job.Progress == 1.0`
- All dependencies resolved

#### Test 5.2: Partial Completion
**Setup:** Import prompt with mix of local and unavailable models  
**Expected:** Job completes with partial status  
**Verification:**
- `job.Status == ImportJobStatus.PartiallyCompleted`
- Some dependencies resolved, others failed

#### Test 5.3: Job Status Retrieval
**Setup:** Create import job  
**Expected:** Status retrievable via job ID  
**Verification:**
- `GET /v1/prompts/import/{job_id}` returns job data
- JSON includes dependencies array

#### Test 5.4: WebSocket Progress Updates
**Setup:** Subscribe to job events via WebSocket  
**Expected:** Real-time updates received  
**Verification:**
- Initial status sent on subscription
- Updates sent when job progresses
- Final status sent on completion

### 6. API Endpoints

#### Test 6.1: Import Prompt Success
**Request:** POST /v1/prompts/import with valid payload  
**Expected:** Job created, job_id returned  
**Verification:**
- Response contains valid job_id
- Status is "analyzing"

#### Test 6.2: Import Prompt Invalid JSON
**Request:** POST /v1/prompts/import with malformed JSON  
**Expected:** Error response  
**Verification:**
- Response contains error message
- No job created

#### Test 6.3: Get Job Status - Valid ID
**Request:** GET /v1/prompts/import/{valid_job_id}  
**Expected:** Job details returned  
**Verification:**
- Response contains job data
- Dependencies array present

#### Test 6.4: Get Job Status - Invalid ID
**Request:** GET /v1/prompts/import/{invalid_id}  
**Expected:** Error response  
**Verification:**
- Response contains "Job not found" error

#### Test 6.5: Get Job Status - Permission Check
**Setup:** User tries to access another user's job  
**Expected:** Permission denied (unless admin)  
**Verification:**
- Non-admin users get error
- Admin users with ViewOthersOutputs can access

### 7. Configuration

#### Test 7.1: Default Configuration Values
**Setup:** Fresh configuration  
**Expected:** Safe defaults applied  
**Verification:**
- `AllowTosAutoAccept == false`
- `AllowedLicenses` is empty (allow all)
- `MaxDownloadSizeBytes == 10737418240` (10GB)

#### Test 7.2: Custom License Restrictions
**Setup:** Set `AllowedLicenses = ["commercial"]`  
**Expected:** Only commercial models allowed  
**Verification:**
- Commercial models pass license check
- Non-commercial models fail

## Manual Testing Procedure

### Prerequisites
1. SwarmUI server running
2. At least one model in local catalog
3. CivitAI API key configured (for CivitAI tests)

### Test 1: SwarmUI Format Import
```bash
curl -X POST http://localhost:7801/API/ImportPrompt \
  -H "Content-Type: application/json" \
  -d '{
    "payload": "{\"sui_image_params\":{\"model\":\"your-model-name\"}}",
    "format": "swarmui"
  }'
```

Expected: Job ID returned, check status with GET endpoint.

### Test 2: ComfyUI Format Import
```bash
curl -X POST http://localhost:7801/API/ImportPrompt \
  -H "Content-Type: application/json" \
  -d '{
    "payload": "{\"1\":{\"class_type\":\"CheckpointLoaderSimple\",\"inputs\":{\"ckpt_name\":\"model.safetensors\"}}}",
    "format": "comfyui"
  }'
```

Expected: Checkpoint dependency detected and resolved if model exists.

### Test 3: Check Job Status
```bash
curl http://localhost:7801/API/GetImportJobStatus?jobId=<job-id-from-previous>
```

Expected: JSON with job status, dependencies array, and progress.

### Test 4: WebSocket Events (using wscat or browser)
```bash
wscat -c ws://localhost:7801/API/GetImportEventsWS
# After connection, send:
{"subscribe_job": "<job-id>"}
```

Expected: Real-time status updates as job progresses.

## Notes for Future Test Automation

When implementing automated tests:

1. **Mock CivitAI API**: Use a test HTTP server or mocking library
2. **Test Model Catalog**: Create temporary test models or use fixtures
3. **Async Handling**: Use appropriate async test patterns
4. **Cleanup**: Remove test jobs after execution
5. **Integration Tests**: Test full API flow end-to-end
6. **Performance Tests**: Test with large workflows (100+ nodes)

## Success Criteria

- All format detection tests pass
- All dependency extraction tests pass
- Local resolution works for hash, name, and partial matches
- CivitAI resolution respects license policies
- Jobs progress through all states correctly
- API endpoints return expected responses
- WebSocket provides real-time updates
