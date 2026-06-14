# SwarmUI Generate Tab MCP Server

A Rust-based [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes the SwarmUI Generate Tab as an instantiable, state-machine-driven virtual terminal.

## Overview

This server lets an MCP client (such as Claude Desktop or another LLM host) open multiple independent "Generate Tab" instances, modify their parameters using delta-oriented operations, and trigger image generation through SwarmUI's HTTP API.

Design goals:

- **Instantiable**: each instance has its own session id, prompt, negative prompt, model, and parameters.
- **Input-token heavy**: the model reads defaults once, then applies targeted modifications rather than rewriting full outputs.
- **Diffable prompts**: prompts and negative prompts are arrays supporting indexed insert/delete/replace/move and find/replace.
- **Deferred generation**: generation can run in the background and be polled via `get_generation_result`.
- **Init image support**: local image files can be encoded and passed as `initimage` to SwarmUI.

## Tools

| Tool | Purpose |
|------|---------|
| `create_instance` | Create a new virtual Generate Tab instance and return its id plus defaults. |
| `modify_instance` | Modify standard parameters, prompt arrays, and init image of a session. |
| `modify_instance_advanced` | Modify advanced parameters (sent verbatim to SwarmUI). |
| `status` | Query session state in `short`, `delta`, or `full` mode, optionally scoped to ids. |
| `generate` | Trigger generation for a session, optionally deferred, saving outputs to a local directory. |
| `get_generation_result` | Poll a deferred generation job. |
| `close_instance` | Close and free a session. |

## Configuration

The server reads configuration from environment variables:

- `SWARMUI_URL` — base URL of the SwarmUI server (default: `http://127.0.0.1:7801`).
- `SWARMUI_SESSION` — SwarmUI API session key. Optional; the server will acquire one automatically if omitted.
- `SWARMUI_USERNAME` — SwarmUI login username. Used only when automatic anonymous session acquisition fails.
- `SWARMUI_PASSWORD` — SwarmUI login password. Used only when automatic anonymous session acquisition fails.
- `SWARM_DEFAULTS` — optional JSON object that overrides defaults fetched from SwarmUI.

If `SWARMUI_SESSION` is empty, the server tries `/API/GetNewSession` first. If your instance requires authorization, it then logs in with `SWARMUI_USERNAME`/`SWARMUI_PASSWORD` and creates a session.

Example:

```powershell
$env:SWARMUI_URL = "http://127.0.0.1:7801"
$env:SWARMUI_SESSION = "your-session-id"
cargo run
```

## MCP Client Configuration

Add the built binary to your MCP client config. For example, for Claude Desktop on Windows:

```json
{
  "mcpServers": {
    "swarm-generate-tab": {
      "command": "F:/PROJECTS-LOCAL/SwarmUI/src/McpServers/SwarmGenerateTabMcp/target/release/SwarmGenerateTabMcp.exe",
      "env": {
        "SWARMUI_URL": "http://127.0.0.1:7801",
        "SWARMUI_SESSION": "your-session-id"
      }
    }
  }
}
```

## Typical Model Flow

1. `create_instance` → receive `session_id` and defaults.
2. `modify_instance` with `prompt_ops` / `negative_prompt_ops` to build the prompt.
3. `modify_instance` to set resolution, sampler, steps, etc.
4. Optionally `modify_instance_advanced` for advanced parameters.
5. `status` with `mode=short` to confirm sessions.
6. `generate` with `output_directory` and `deferred=true`.
7. `get_generation_result` with the returned `job_id` until completion.
8. `close_instance` when done.

## Notes

- The server communicates with SwarmUI over HTTP using the same `GenerateText2Image` and `ListT2IParams` routes used by the web UI.
- Generated images are downloaded from SwarmUI and written to the requested local `output_directory`.
- Init images are read from the local filesystem and encoded as data URLs before being forwarded to SwarmUI.
