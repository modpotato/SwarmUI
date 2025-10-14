# RFC 0001 Implementation Guide

This guide explains how to use the implemented HTTP model transfer endpoints.

## Endpoints

### 1. Get Model Manifest

**Endpoint:** `POST /API/GetModelManifest`

**Description:** Returns a JSON manifest of all available models with their metadata and download URLs.

**Request Body:**
```json
{
  "session_id": "your-session-id",
  "subtype": "Stable-Diffusion",
  "includeImages": false
}
```

**Parameters:**
- `subtype` (optional, default: "Stable-Diffusion"): Model type (e.g., "Stable-Diffusion", "LoRA", "VAE")
- `includeImages` (optional, default: false): Whether to include full preview images in base64 format

**Response Example:**
```json
{
  "node_id": "swarmui-hostname",
  "generated_at": "2025-10-14T03:15:13Z",
  "subtype": "Stable-Diffusion",
  "models": [
    {
      "name": "stable-diffusion/xl/model-name",
      "title": "Model Title",
      "filename": "model-name.safetensors",
      "size": 7423912345,
      "sha256": "abc123def456...",
      "architecture": "stable-diffusion-xl-v1-base",
      "description": "Model description here",
      "standard_width": 1024,
      "standard_height": 1024,
      "download_url": "/DownloadModel/Stable-Diffusion/abc123.../model-name.safetensors",
      "metadata": {
        "author": "Author Name",
        "license": "openrail",
        "date": "2024-01-15",
        "tags": ["realistic", "portrait"]
      }
    }
  ]
}
```

### 2. Download Model File

**Endpoint:** `GET /DownloadModel/{subtype}/{identifier}/{filename}`

**Description:** Downloads a model file. Supports resumable downloads via HTTP Range headers.

**URL Parameters:**
- `subtype`: Model type (e.g., "Stable-Diffusion", "LoRA")
- `identifier`: Model SHA256 hash or model name
- `filename`: The target filename (for proper content-disposition)

**Examples:**
```
GET /DownloadModel/Stable-Diffusion/abc123def456.../model-name.safetensors
GET /DownloadModel/LoRA/my-lora-model/my-lora.safetensors
```

**Response Headers:**
- `Content-Type`: application/octet-stream
- `Content-Disposition`: attachment; filename="..."
- `Accept-Ranges`: bytes
- `X-Model-SHA256`: {hash} - For verification
- `Content-Range`: bytes {start}-{end}/{total} (for partial content)

**Status Codes:**
- `200 OK`: Full content returned
- `206 Partial Content`: Partial content returned (resume)
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Model not found

**Resume Support:**
To resume an interrupted download, include a Range header:
```
Range: bytes=1000000-
```

## Usage Example

### JavaScript/Fetch
```javascript
// 1. Get the manifest
const manifestResponse = await fetch('/API/GetModelManifest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionId,
    subtype: 'Stable-Diffusion',
    includeImages: false
  })
});
const manifest = await manifestResponse.json();

// 2. Download a model
const model = manifest.models[0];
const downloadUrl = model.download_url;
const response = await fetch(downloadUrl);
const blob = await response.blob();

// Verify hash
const arrayBuffer = await blob.arrayBuffer();
const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
console.assert(hash === model.sha256, 'Hash mismatch!');
```

### Python
```python
import requests
import hashlib

# 1. Get the manifest
response = requests.post('http://localhost:7801/API/GetModelManifest', json={
    'session_id': session_id,
    'subtype': 'Stable-Diffusion',
    'includeImages': False
})
manifest = response.json()

# 2. Download a model with resume support
model = manifest['models'][0]
download_url = f"http://localhost:7801{model['download_url']}"
output_path = f"models/{model['filename']}"

# Check if partially downloaded
start_byte = 0
if os.path.exists(output_path):
    start_byte = os.path.getsize(output_path)
    
headers = {}
if start_byte > 0:
    headers['Range'] = f'bytes={start_byte}-'

response = requests.get(download_url, headers=headers, stream=True)
mode = 'ab' if start_byte > 0 else 'wb'

# Download with progress
sha256_hash = hashlib.sha256()
with open(output_path, mode) as f:
    for chunk in response.iter_content(chunk_size=8192):
        f.write(chunk)
        sha256_hash.update(chunk)

# Verify
assert sha256_hash.hexdigest() == model['sha256'], 'Hash mismatch!'
```

## Security Considerations

1. **Authentication Required**: All endpoints require valid session authentication
2. **Permission-Based**: Users can only access models they have permission to view
3. **Hash Verification**: Always verify SHA256 hash after download
4. **HTTPS Recommended**: Use HTTPS in production to prevent MITM attacks

## Future Enhancements (from RFC)

Phase 2:
- Signed manifests with Ed25519 signatures
- License validation and acceptance tracking
- Bandwidth throttling and quotas

Phase 3:
- P2P transfer via WebTorrent
- Multi-source chunk downloads
- DHT-based peer discovery
