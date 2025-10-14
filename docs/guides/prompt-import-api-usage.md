# Prompt Import API - Usage Guide

This guide explains how to use the Prompt Import API to import prompts/workflows and automatically resolve their model dependencies.

## Overview

The Prompt Import API allows you to:
1. Import prompts from SwarmUI, ComfyUI, or A1111 formats
2. Automatically detect and extract model dependencies (checkpoints, LoRAs, VAEs, etc.)
3. Resolve dependencies from local catalog, remote nodes, or CivitAI
4. Track progress in real-time via WebSocket or polling

## Quick Start

### 1. Import a Prompt

```http
POST /API/ImportPrompt
Content-Type: application/json

{
  "payload": "{\"sui_image_params\":{\"model\":\"model.safetensors\",\"loras\":\"lora1,lora2\"}}",
  "format": "swarmui"
}
```

**Response:**
```json
{
  "job_id": "abc-123-def-456",
  "status": "analyzing",
  "message": "Import job created and processing started."
}
```

### 2. Check Job Status

```http
GET /API/GetImportJobStatus?jobId=abc-123-def-456
```

## API Endpoints

- POST /API/ImportPrompt - Import a prompt and create a job
- GET /API/GetImportJobStatus - Get job status by ID
- WebSocket /API/GetImportEventsWS - Real-time progress updates

## Supported Formats

### SwarmUI Format
Extracts from `sui_image_params` and `sui_models`.

### ComfyUI Format
Parses workflow nodes (CheckpointLoader, LoraLoader, VAELoader, etc.).

### A1111 Format
Extracts from `sd_model_checkpoint`, prompt LoRAs, and `override_settings`.

## Model Reference Formats

- **SHA256 Hash**: `sha256:abc123...` (recommended)
- **CivitAI Version ID**: `civitai:version:123456`
- **Filename/Key**: `folder/model.safetensors`

## Configuration

Edit server settings:
```
CivitAI:
  AllowedLicenses: ["commercial", "noncommercial"]
  AllowTosAutoAccept: false
  MaxDownloadSizeBytes: 10737418240
```

For full documentation, see: `docs/rfcs/0002-prompt-import-api.md`
