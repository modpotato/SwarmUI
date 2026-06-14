use std::io::{self, Write};
use std::sync::Arc;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

mod mcp;
mod session;
mod swarm_client;
mod tools;

use mcp::{JsonRpcError, JsonRpcRequest, JsonRpcResponse, McpErrorCode};
use session::SessionManager;
use swarm_client::SwarmClient;

/// Runtime configuration for the MCP server.
#[derive(Clone, Debug)]
pub struct Config {
    /// Base URL of the SwarmUI server, e.g. `http://127.0.0.1:7801`.
    pub swarm_base_url: String,
    /// API session key used to authenticate with SwarmUI.
    pub swarm_session: String,
    /// Optional SwarmUI login username for automatic session acquisition.
    pub swarm_username: String,
    /// Optional SwarmUI login password for automatic session acquisition.
    pub swarm_password: String,
    /// Optional fixed set of defaults. When omitted the server fetches them from SwarmUI.
    pub default_overrides: Option<Value>,
}

impl Config {
    fn from_env() -> Self {
        let swarm_base_url = std::env::var("SWARMUI_URL").unwrap_or_else(|_| "http://127.0.0.1:7801".to_string());
        let swarm_session = std::env::var("SWARMUI_SESSION").unwrap_or_default();
        let swarm_username = std::env::var("SWARMUI_USERNAME").unwrap_or_default();
        let swarm_password = std::env::var("SWARMUI_PASSWORD").unwrap_or_default();
        let default_overrides = std::env::var("SWARM_DEFAULTS")
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok());
        Self {
            swarm_base_url,
            swarm_session,
            swarm_username,
            swarm_password,
            default_overrides,
        }
    }
}

/// Shared server state.
pub struct ServerState {
    pub config: Config,
    pub sessions: SessionManager,
    pub swarm: SwarmClient,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(io::stderr)
        .init();

    let config = Config::from_env();
    info!("SwarmUI Generate Tab MCP server starting");
    info!("SwarmUI base URL: {}", config.swarm_base_url);

    let swarm = SwarmClient::new(&config.swarm_base_url, &config.swarm_session, &config.swarm_username, &config.swarm_password);
    let defaults = swarm.fetch_defaults(config.default_overrides.clone()).await.unwrap_or_else(|err| {
        warn!("Failed to fetch defaults from SwarmUI ({}). Using built-in fallback defaults.", err);
        session::fallback_defaults()
    });

    let state = Arc::new(Mutex::new(ServerState {
        config,
        sessions: SessionManager::new(defaults),
        swarm,
    }));

    run_stdio_server(state).await;
    Ok(())
}

/// Reads a single line from stdin, parses it as a JSON-RPC request and dispatches it.
async fn run_stdio_server(state: Arc<Mutex<ServerState>>) {
    let stdin = tokio::io::stdin();
    let mut stdout = io::stdout();
    let reader = BufReader::new(stdin);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        debug!("Received JSON-RPC line: {}", line);
        match serde_json::from_str::<JsonRpcRequest>(&line) {
            Ok(req) => {
                let response = dispatch_request(state.clone(), req).await;
                if let Some(resp) = response {
                    let out = serde_json::to_string(&resp).unwrap();
                    let _ = stdout.write_all(out.as_bytes());
                    let _ = stdout.write_all(b"\n");
                    let _ = stdout.flush();
                }
            }
            Err(err) => {
                warn!("Failed to parse JSON-RPC request: {}", err);
                let resp = JsonRpcResponse::error(
                    Value::Null,
                    JsonRpcError::new(
                        McpErrorCode::ParseError as i32,
                        format!("Parse error: {}", err),
                        None,
                    ),
                );
                let out = serde_json::to_string(&resp).unwrap();
                let _ = stdout.write_all(out.as_bytes());
                let _ = stdout.write_all(b"\n");
                let _ = stdout.flush();
            }
        }
    }
}

/// Dispatches a JSON-RPC request to the appropriate handler.
async fn dispatch_request(
    state: Arc<Mutex<ServerState>>,
    req: JsonRpcRequest,
) -> Option<JsonRpcResponse> {
    let id = req.id.clone().unwrap_or(Value::Null);

    match req.method.as_str() {
        "initialize" => Some(handle_initialize(id, req.params.unwrap_or(Value::Null))),
        "initialized" => None,
        "notifications/initialized" => None,
        "tools/list" => Some(handle_tools_list(id)),
        "tools/call" => handle_tool_call(state, id, req.params.unwrap_or(Value::Null)).await,
        _ => Some(JsonRpcResponse::error(
            id,
            JsonRpcError::new(
                McpErrorCode::MethodNotFound as i32,
                format!("Method not found: {}", req.method),
                None,
            ),
        )),
    }
}

fn handle_initialize(id: Value, _params: Value) -> JsonRpcResponse {
    JsonRpcResponse::success(
        id,
        json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "swarm-generate-tab-mcp",
                "version": env!("CARGO_PKG_VERSION")
            }
        }),
    )
}

fn handle_tools_list(id: Value) -> JsonRpcResponse {
    JsonRpcResponse::success(id, json!({ "tools": tools::all_tool_definitions() }))
}

async fn handle_tool_call(
    state: Arc<Mutex<ServerState>>,
    id: Value,
    params: Value,
) -> Option<JsonRpcResponse> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("");
    let arguments = params.get("arguments").cloned().unwrap_or(Value::Null);

    let result = match name {
        "create_instance" => tools::create_instance(state, arguments).await,
        "modify_instance" => tools::modify_instance(state, arguments, false).await,
        "modify_instance_advanced" => tools::modify_instance(state, arguments, true).await,
        "status" => tools::status(state, arguments).await,
        "generate" => tools::generate(state, arguments).await,
        "get_generation_result" => tools::get_generation_result(state, arguments).await,
        "close_instance" => tools::close_instance(state, arguments).await,
        _ => Err(JsonRpcError::new(
            McpErrorCode::InvalidParams as i32,
            format!("Unknown tool: {}", name),
            None,
        )),
    };

    match result {
        Ok(value) => Some(JsonRpcResponse::success(id, value)),
        Err(err) => Some(JsonRpcResponse::error(id, err)),
    }
}
