# RFC 0001: Auto-download of Models from Remote SwarmUI APIs (with optional P2P)

Status: Draft  
Author: modpotato  
Created: 2025-10-14  
Target Version: vNext

## Summary

Introduce an auto-download system that:
- Discovers and fetches models from remote SwarmUI nodes via an authenticated API, using a manifest that includes content-addressed hashes and CivitAI metadata.
- Falls back to upstream registries (CivitAI, Hugging Face, etc.) when the remote peer cannot serve the binary.
- Optionally enables P2P model transfer to reduce bandwidth and improve distribution in multi-node setups.

## Goals

- Enable "pull on demand" for models referenced by workflows or remote nodes.
- Preserve model integrity via content hashing and optional signed manifests.
- Respect licensing/ToS by enforcing explicit metadata (CivitAI model/version, license) and administrator-accepted policies.
- Provide resumable, observable downloads with quotas/limits.
- Provide opt-in P2P data-plane for fast intra-org or community distribution.

## Non-Goals

- Acting as a public CDN for third-party content without license validation.
- Implementing a general torrent client UI.

## Terminology

- "Local node": the SwarmUI instance initiating downloads.
- "Remote node": another SwarmUI instance providing a model manifest and optionally serving the model.
- "Registry": upstream provider (e.g., CivitAI, Hugging Face).

## High-Level Design

### Components

1. Model Registry Manifest (Remote)
   - Endpoint on remote SwarmUI exposing a signed JSON manifest of available models:
     - Unique identifiers (e.g., `model_key`, `variant`, `precision`).
     - Content hash (SHA256) and chunk hashes (for P2P).
     - Size, updated timestamp.
     - CivitAI metadata (modelId, versionId, license, download URL template if permitted).
   - Optional signature (Ed25519) so consumers can trust the manifest.

2. Download Orchestrator (Local)
   - Given a required model, resolves source according to policy:
     1. Allowed remote node(s) with manifest match and content hash.
     2. Upstream registry (CivitAI/HF) with token/ToS acceptance recorded.
   - Creates a background job, supports resume, retries, bandwidth limits, checksum verification, and post-download indexing.

3. Transport Planes
   - HTTP(S) chunked transfer with Range support (Phase 1).
   - Optional P2P (Phase 3), e.g.:
     - WebTorrent/WebRTC data channels.
     - libtorrent (native) or libp2p streams (node/native).
     - IPFS CAR streaming with content addressing (if operationally acceptable).

4. Policy & Governance
   - Admin-controlled allowlist of sources (remote nodes/registries).
   - License guardrail: block auto-download if license requires manual acceptance unless previously accepted in settings.
   - Disk/bandwidth quotas and concurrency limits.

### Data Flow

- Local node needs `foo.safetensors`.
- Check local catalog → not present.
- Query allowed remote nodes:
  - GET /v1/models/manifest
  - Match entry for `foo.safetensors` by logical key and/or hash.
- If remote can serve:
  - Fetch via HTTP: GET /v1/models/download?hash=... (supports Range).
  - Verify SHA256; finalize to canonical store; update catalog.
- Else fallback to CivitAI:
  - Use CivitAI API via versionId; requires configured API token and license acceptance.
  - Download, verify, index.
- Emit progress via SSE/WebSocket; update UI.

## API Surface

All new endpoints are authenticated and permission-scoped. Examples below use JSON.

Remote (provider):
- GET /v1/models/manifest?include=weights,loras,vae
  - Returns a JSON manifest (optionally signed).
- GET /v1/models/download?hash={sha256}&chunk={n} (optional)  
  - Returns full stream or chunk for Range requests.
- GET /v1/models/chunks/{hash}/{chunkIndex} (if chunk-addressed; optional)
- GET /v1/p2p/offer (optional, for WebRTC signaling)
  - Returns SDP or handles offer/answer exchange.

Local (consumer):
- POST /v1/models/request-download
  - Body:
    {
      "model_key": "stable-diffusion/xl/foo",
      "prefer": ["remote", "civitai"],
      "constraints": { "license": "allow-noncommercial" }
    }
  - Response: { "job_id": "..." }
- GET /v1/models/jobs/{job_id} (status)
- GET /v1/models/events (SSE) for progress
- GET /v1/models/catalog (to show available models and their states)

### Manifest Schema (example)

```json
{
  "node": {
    "id": "swarmui-remote-01",
    "public_key": "base64-ed25519",
    "sig_algo": "ed25519"
  },
  "generated_at": "2025-10-14T03:15:13Z",
  "models": [
    {
      "model_key": "sdxl/foobar-v1",
      "filename": "foobar-v1.safetensors",
      "size": 7423912345,
      "sha256": "a1b2c3...",
      "chunks": {
        "size": 4194304,
        "count": 1772,
        "hashes": ["...", "..."]
      },
      "civitai": {
        "modelId": 12345,
        "versionId": 67890,
        "license": "openrail-nc",
        "nsfw": false
      },
      "tags": ["sdxl", "fp16"],
      "updated_at": "2025-10-10T12:34:56Z",
      "download": {
        "http": "/v1/models/download?hash=a1b2c3",
        "p2p": {
          "webtorrent": "magnet:?xt=urn:btih:...",
          "ipfs_cid": "bafy..."
        }
      }
    }
  ],
  "signature": "base64-signature-over-canonical-json"
}
```

## Configuration

```yaml
downloads:
  enabled: true
  allowed_sources:
    remote_nodes:
      - https://remote1.example.com
      - https://remote2.example.net
    registries:
      civitai: true
      huggingface: true
  civitai:
    api_key: ""
    accept_licenses:
      - openrail
      - openrail-nc
    reject_nsfw: true
  p2p:
    enabled: false
    mode: webtorrent  # or libp2p, ipfs
    max_peers: 10
    listen_port: 6881
  limits:
    max_concurrent_downloads: 2
    bandwidth_limit_mbps: 100
    disk_quota_gb: 500
```

## Security & Privacy

- All remote manifests are authenticated via bearer token or API key.
- Optional manifest signing (Ed25519) for tamper detection.
- Content integrity guaranteed via SHA256.
- License metadata required; admin must allowlist acceptable terms.
- No telemetry sent to third parties without explicit opt-in.
- P2P mode exposes local IP; document trade-offs clearly.

## Implementation Phases

### Phase 1: HTTP-only remote download
- Manifest endpoint and parser.
- Download orchestrator with retry logic.
- CivitAI fallback integration.
- UI for job tracking.

### Phase 2: Governance & Policy
- Admin settings for source allowlists.
- License verification and acceptance tracking.
- Quota enforcement.

### Phase 3: P2P (Optional)
- WebTorrent or libp2p integration.
- Chunk-based model exchange.
- DHT-based peer discovery (if applicable).

## Open Questions

1. Should we support automatic discovery of remote SwarmUI nodes (mDNS/zeroconf) or require manual configuration?
2. What's the UX for license acceptance? Toast notification? Modal?
3. Should we provide a "trust on first use" model for remote manifests, or require explicit allowlisting?
4. For P2P: do we need a tracker server, or rely on DHT?

## Alternatives Considered

- Using existing tools (aria2, wget) as subprocesses: rejected due to lack of fine-grained control and integration complexity.
- IPFS-only approach: rejected due to operational complexity and gateway reliance.
- Pure P2P without HTTP fallback: rejected due to reliability concerns.

## Success Metrics

- Time to download a 7GB model from remote SwarmUI vs. CivitAI.
- Number of models successfully auto-downloaded without manual intervention.
- User feedback on license workflow clarity.
- P2P bandwidth savings (if implemented).

## Related Work

- Docker registry v2 protocol (manifest + blob storage).
- BitTorrent/WebTorrent for content distribution.
- IPFS and content addressing.
- Hugging Face Hub's model storage and API.

## References

- [CivitAI API Documentation](https://github.com/civitai/civitai/wiki/REST-API-Reference)
- [Hugging Face Hub API](https://huggingface.co/docs/huggingface_hub/index)
- [WebTorrent Protocol](https://webtorrent.io/)
- [IPFS Specifications](https://docs.ipfs.io/)
