use std::path::Path;
use std::sync::Arc;

use serde_json::{json, Value};
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::mcp::{JsonRpcError, McpErrorCode};
use crate::session::{
    apply_prompt_ops, build_swarm_request, delta_view, GenerationJob, InitImage, JobState,
    PromptOps, Session, SessionState,
};
use crate::swarm_client::{GenerateResponse, SwarmClient};
use crate::ServerState;

/// Returns the full list of tool schemas exposed by this server.
pub fn all_tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "create_instance",
            "description": "Create a new virtual Generate Tab instance. Returns the session id and the default parameters for the current setup.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }),
        json!({
            "name": "modify_instance",
            "description": "Modify standard parameters of a Generate Tab instance. Prompts and negative prompts are arrays and can be edited with prompt operations.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": { "type": "string", "description": "8-character hex session id" },
                    "prompt": { "type": "array", "items": { "type": "string" }, "description": "Replace the entire prompt array" },
                    "negative_prompt": { "type": "array", "items": { "type": "string" }, "description": "Replace the entire negative prompt array" },
                    "prompt_ops": {
                        "type": "object",
                        "description": "Diff operations on the prompt array",
                        "properties": {
                            "set": { "type": "array", "items": { "type": "string" } },
                            "append": { "type": "string" },
                            "prepend": { "type": "string" },
                            "insert": { "type": "object", "properties": { "index": { "type": "integer" }, "text": { "type": "string" } }, "required": ["index", "text"] },
                            "delete": { "type": "array", "items": { "type": "integer" } },
                            "replace": { "type": "array", "items": { "type": "object", "properties": { "index": { "type": "integer" }, "text": { "type": "string" } }, "required": ["index", "text"] } },
                            "find_replace": { "type": "array", "items": { "type": "object", "properties": { "find": { "type": "string" }, "replace": { "type": "string" } }, "required": ["find", "replace"] } },
                            "move_items": { "type": "array", "items": { "type": "object", "properties": { "from": { "type": "integer" }, "to": { "type": "integer" } }, "required": ["from", "to"] } }
                        }
                    },
                    "negative_prompt_ops": {
                        "type": "object",
                        "description": "Diff operations on the negative prompt array",
                        "properties": {
                            "set": { "type": "array", "items": { "type": "string" } },
                            "append": { "type": "string" },
                            "prepend": { "type": "string" },
                            "insert": { "type": "object", "properties": { "index": { "type": "integer" }, "text": { "type": "string" } }, "required": ["index", "text"] },
                            "delete": { "type": "array", "items": { "type": "integer" } },
                            "replace": { "type": "array", "items": { "type": "object", "properties": { "index": { "type": "integer" }, "text": { "type": "string" } }, "required": ["index", "text"] } },
                            "find_replace": { "type": "array", "items": { "type": "object", "properties": { "find": { "type": "string" }, "replace": { "type": "string" } }, "required": ["find", "replace"] } },
                            "move_items": { "type": "array", "items": { "type": "object", "properties": { "from": { "type": "integer" }, "to": { "type": "integer" } }, "required": ["from", "to"] } }
                        }
                    },
                    "model": { "type": "string" },
                    "width": { "type": "integer" },
                    "height": { "type": "integer" },
                    "aspect_ratio": { "type": "string" },
                    "steps": { "type": "integer" },
                    "cfg_scale": { "type": "number" },
                    "sampler": { "type": "string" },
                    "scheduler": { "type": "string" },
                    "seed": { "type": "integer" },
                    "images": { "type": "integer", "description": "Number of images to generate" },
                    "batch_size": { "type": "integer" },
                    "init_image_path": { "type": "string", "description": "Local filesystem path to an init image" },
                    "init_image_creativity": { "type": "number", "description": "Init image denoise strength / creativity" }
                },
                "required": ["session_id"]
            }
        }),
        json!({
            "name": "modify_instance_advanced",
            "description": "Modify advanced parameters of a Generate Tab instance. Advanced parameters are sent verbatim to SwarmUI.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": { "type": "string" },
                    "advanced": { "type": "object", "description": "Map of advanced parameter ids to values" },
                    "clear_existing": { "type": "boolean", "description": "If true, replace all advanced params instead of merging" }
                },
                "required": ["session_id", "advanced"]
            }
        }),
        json!({
            "name": "status",
            "description": "Get status of generate tab instances.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "mode": { "type": "string", "enum": ["short", "delta", "full"], "description": "short: list sessions and states; delta: non-default values per session; full: complete snapshot per session" },
                    "session_id": { "type": "string", "description": "Scope to a single session" },
                    "session_ids": { "type": "array", "items": { "type": "string" }, "description": "Scope to multiple sessions" }
                },
                "required": ["mode"]
            }
        }),
        json!({
            "name": "generate",
            "description": "Trigger image generation for a session. Optionally defer and poll later.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": { "type": "string" },
                    "output_directory": { "type": "string", "description": "Required local directory where outputs will be saved" },
                    "deferred": { "type": "boolean", "description": "If true, returns immediately with a job_id. Poll with get_generation_result." }
                },
                "required": ["session_id", "output_directory"]
            }
        }),
        json!({
            "name": "get_generation_result",
            "description": "Poll the result of a deferred generation job.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "job_id": { "type": "string" }
                },
                "required": ["job_id"]
            }
        }),
        json!({
            "name": "close_instance",
            "description": "Close and free a Generate Tab instance.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": { "type": "string" }
                },
                "required": ["session_id"]
            }
        }),
    ]
}

fn missing_param(name: &str) -> JsonRpcError {
    JsonRpcError::new(
        McpErrorCode::InvalidParams as i32,
        format!("Missing required parameter: {}", name),
        None,
    )
}

fn invalid_session(id: &str) -> JsonRpcError {
    JsonRpcError::new(
        McpErrorCode::InvalidParams as i32,
        format!("No such session: {}", id),
        None,
    )
}

pub async fn create_instance(
    state: Arc<Mutex<ServerState>>,
    _args: Value,
) -> Result<Value, JsonRpcError> {
    let mut guard = state.lock().await;
    let session = guard.sessions.create();
    info!("Created session {}", session.session_id);
    Ok(json!({
        "session_id": session.session_id,
        "defaults": guard.sessions.defaults(),
        "state": session.state
    }))
}

pub async fn modify_instance(
    state: Arc<Mutex<ServerState>>,
    args: Value,
    advanced_only: bool,
) -> Result<Value, JsonRpcError> {
    let session_id = args.get("session_id").and_then(Value::as_str).ok_or_else(|| missing_param("session_id"))?;
    let mut guard = state.lock().await;
    let defaults = guard.sessions.defaults().clone();
    let session = guard.sessions.get_mut(session_id).ok_or_else(|| invalid_session(session_id))?;

    if session.state == SessionState::Generating {
        return Err(JsonRpcError::new(
            McpErrorCode::InvalidParams as i32,
            "Cannot modify session while it is generating".to_string(),
            None,
        ));
    }

    if !advanced_only {
        if let Some(prompt) = args.get("prompt").and_then(Value::as_array) {
            session.prompt = strings_from_array(prompt);
        }
        if let Some(neg) = args.get("negative_prompt").and_then(Value::as_array) {
            session.negative_prompt = strings_from_array(neg);
        }
        if let Some(ops) = args.get("prompt_ops") {
            let ops: PromptOps = serde_json::from_value(ops.clone()).map_err(|e| JsonRpcError::new(
                McpErrorCode::InvalidParams as i32,
                format!("Invalid prompt_ops: {}", e),
                None,
            ))?;
            apply_prompt_ops(&mut session.prompt, &ops)?;
        }
        if let Some(ops) = args.get("negative_prompt_ops") {
            let ops: PromptOps = serde_json::from_value(ops.clone()).map_err(|e| JsonRpcError::new(
                McpErrorCode::InvalidParams as i32,
                format!("Invalid negative_prompt_ops: {}", e),
                None,
            ))?;
            apply_prompt_ops(&mut session.negative_prompt, &ops)?;
        }

        if let Some(v) = args.get("model").and_then(Value::as_str) {
            session.standard.model = v.to_string();
        }
        if let Some(v) = args.get("width").and_then(Value::as_u64) {
            session.standard.width = Some(v as u32);
        }
        if let Some(v) = args.get("height").and_then(Value::as_u64) {
            session.standard.height = Some(v as u32);
        }
        if let Some(v) = args.get("aspect_ratio").and_then(Value::as_str) {
            session.standard.aspect_ratio = Some(v.to_string());
        }
        if let Some(v) = args.get("steps").and_then(Value::as_u64) {
            session.standard.steps = Some(v as u32);
        }
        if let Some(v) = args.get("cfg_scale").and_then(Value::as_f64) {
            session.standard.cfg_scale = Some(v);
        }
        if let Some(v) = args.get("sampler").and_then(Value::as_str) {
            session.standard.sampler = Some(v.to_string());
        }
        if let Some(v) = args.get("scheduler").and_then(Value::as_str) {
            session.standard.scheduler = Some(v.to_string());
        }
        if let Some(v) = args.get("seed").and_then(Value::as_i64) {
            session.standard.seed = Some(v);
        }
        if let Some(v) = args.get("images").and_then(Value::as_u64) {
            session.standard.images = Some(v as u32);
        }
        if let Some(v) = args.get("batch_size").and_then(Value::as_u64) {
            session.standard.batch_size = Some(v as u32);
        }

        if let Some(path) = args.get("init_image_path").and_then(Value::as_str) {
            if path.is_empty() {
                session.init_image = None;
            } else {
                let creativity = args.get("init_image_creativity").and_then(Value::as_f64).unwrap_or(0.6);
                session.init_image = Some(InitImage {
                    local_path: path.to_string(),
                    creativity,
                });
            }
        }
    } else {
        let advanced = args.get("advanced").and_then(Value::as_object).ok_or_else(|| missing_param("advanced"))?;
        let clear = args.get("clear_existing").and_then(Value::as_bool).unwrap_or(false);
        if clear {
            session.advanced.values.clear();
        }
        for (k, v) in advanced {
            session.advanced.values.insert(k.clone(), v.clone());
        }
    }

    session.state = if delta_view(session, &defaults).as_object().map(|o| o.len()).unwrap_or(0) > 1 {
        SessionState::Modified
    } else {
        SessionState::Idle
    };

    debug!("Modified session {} -> {:?}", session_id, session.state);
    Ok(json!({
        "session_id": session.session_id,
        "state": session.state,
        "delta": delta_view(session, &defaults)
    }))
}

pub async fn status(
    state: Arc<Mutex<ServerState>>,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let mode = args.get("mode").and_then(Value::as_str).ok_or_else(|| missing_param("mode"))?;
    let single_id = args.get("session_id").and_then(Value::as_str).map(String::from);
    let multi_ids: Vec<String> = args
        .get("session_ids")
        .and_then(Value::as_array)
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let guard = state.lock().await;
    let defaults = guard.sessions.defaults().clone();
    let sessions: Vec<&Session> = if let Some(id) = single_id {
        guard.sessions.list_filtered(&[id])
    } else if !multi_ids.is_empty() {
        guard.sessions.list_filtered(&multi_ids)
    } else {
        guard.sessions.list()
    };

    match mode {
        "short" => {
            let list: Vec<Value> = sessions
                .iter()
                .map(|s| {
                    json!({
                        "session_id": s.session_id,
                        "state": s.state,
                        "prompt_summary": summarize(&s.prompt),
                        "model": s.standard.model,
                        "jobs": s.jobs.iter().map(|j| json!({"job_id": j.job_id, "state": j.state})).collect::<Vec<_>>()
                    })
                })
                .collect();
            Ok(json!({ "sessions": list }))
        }
        "delta" => {
            let map: serde_json::Map<String, Value> = sessions
                .iter()
                .map(|s| (s.session_id.clone(), delta_view(s, &defaults)))
                .collect();
            Ok(Value::Object(map))
        }
        "full" => {
            let list: Vec<Value> = sessions.iter().map(|s| json!(s)).collect();
            Ok(json!({ "sessions": list }))
        }
        _ => Err(JsonRpcError::new(
            McpErrorCode::InvalidParams as i32,
            format!("Invalid status mode: {}", mode),
            None,
        )),
    }
}

pub async fn generate(
    state: Arc<Mutex<ServerState>>,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let session_id = args.get("session_id").and_then(Value::as_str).ok_or_else(|| missing_param("session_id"))?;
    let output_directory = args.get("output_directory").and_then(Value::as_str).ok_or_else(|| missing_param("output_directory"))?;
    let deferred = args.get("deferred").and_then(Value::as_bool).unwrap_or(false);

    let images = {
        let mut guard = state.lock().await;
        let session = guard.sessions.get_mut(session_id).ok_or_else(|| invalid_session(session_id))?;
        if session.state == SessionState::Generating {
            return Err(JsonRpcError::new(
                McpErrorCode::InvalidParams as i32,
                "Session is already generating".to_string(),
                None,
            ));
        }
        session.state = SessionState::Generating;
        session.standard.images.unwrap_or(1)
    };

    let job_id = Uuid::new_v4().to_string();
    let job = GenerationJob {
        job_id: job_id.clone(),
        created_at: chrono::Utc::now(),
        state: JobState::Pending,
        output_directory: output_directory.to_string(),
        results: Vec::new(),
        error: None,
    };

    {
        let mut guard = state.lock().await;
        if let Some(session) = guard.sessions.get_mut(session_id) {
            session.jobs.push(job);
        }
    }

    if deferred {
        let state_clone = state.clone();
        let session_id_spawn = session_id.to_string();
        let output_directory_spawn = output_directory.to_string();
        let job_id_spawn = job_id.clone();
        tokio::spawn(async move {
            let _ = run_generation(state_clone, &session_id_spawn, &output_directory_spawn, &job_id_spawn, images).await;
        });
        Ok(json!({
            "session_id": session_id,
            "job_id": job_id,
            "status": "deferred",
            "message": "Generation started. Poll with get_generation_result."
        }))
    } else {
        let result = run_generation(state.clone(), session_id, output_directory, &job_id, images).await;
        match result {
            Ok(paths) => Ok(json!({
                "session_id": session_id,
                "job_id": job_id,
                "status": "completed",
                "outputs": paths
            })),
            Err(err) => Err(err),
        }
    }
}

pub async fn get_generation_result(
    state: Arc<Mutex<ServerState>>,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let job_id = args.get("job_id").and_then(Value::as_str).ok_or_else(|| missing_param("job_id"))?;
    let guard = state.lock().await;
    for session in guard.sessions.list() {
        if let Some(job) = session.jobs.iter().find(|j| j.job_id == job_id) {
            return Ok(json!({
                "job_id": job_id,
                "session_id": session.session_id,
                "state": job.state,
                "outputs": job.results,
                "error": job.error
            }));
        }
    }
    Err(JsonRpcError::new(
        McpErrorCode::InvalidParams as i32,
        format!("No such job: {}", job_id),
        None,
    ))
}

pub async fn close_instance(
    state: Arc<Mutex<ServerState>>,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let session_id = args.get("session_id").and_then(Value::as_str).ok_or_else(|| missing_param("session_id"))?;
    let mut guard = state.lock().await;
    let closed = guard.sessions.close(session_id);
    if closed {
        info!("Closed session {}", session_id);
        Ok(json!({ "closed": true, "session_id": session_id }))
    } else {
        Err(invalid_session(session_id))
    }
}

async fn run_generation(
    state: Arc<Mutex<ServerState>>,
    session_id: &str,
    output_directory: &str,
    job_id: &str,
    images: u32,
) -> Result<Vec<String>, JsonRpcError> {
    let state_for_fail = state.clone();
    set_job_state(state.clone(), session_id, job_id, JobState::Running, None).await;

    let (request, swarm) = {
        let guard = state.lock().await;
        let session = guard.sessions.get(session_id).ok_or_else(|| invalid_session(session_id))?;
        let mut request = build_swarm_request(session);
        if let Some(init) = &session.init_image {
            match SwarmClient::encode_local_image(&init.local_path) {
                Ok(data_url) => {
                    if let Some(obj) = request.as_object_mut() {
                        obj.insert("initimage".to_string(), json!(data_url));
                    }
                }
                Err(err) => {
                    return fail_generation(state_for_fail, session_id, job_id, err.to_string()).await;
                }
            }
        }
        (request, guard.swarm.clone())
    };

    let out_dir = Path::new(output_directory);
    if let Err(err) = tokio::fs::create_dir_all(out_dir).await {
        return fail_generation(
            state_for_fail,
            session_id,
            job_id,
            format!("Failed to create output directory: {}", err),
        )
        .await;
    }

    let gen_result: anyhow::Result<GenerateResponse> = swarm.generate(images, request).await;
    if let Err(ref err) = gen_result {
        return fail_generation(state_for_fail, session_id, job_id, err.to_string()).await;
    }
    let response = gen_result.unwrap();

    let mut local_paths = Vec::new();
    for (idx, path) in response.files.iter().enumerate() {
        let filename = format!("{}_{}.png", session_id, idx);
        let dest = out_dir.join(filename);
        match swarm.download_image(path).await {
            Ok(bytes) => {
                if let Err(err) = tokio::fs::write(&dest, bytes).await {
                    warn!("Failed to write {}: {}", dest.display(), err);
                    local_paths.push(format!("error:{}", err));
                    continue;
                }
                info!("Saved output to {}", dest.display());
                local_paths.push(dest.to_string_lossy().to_string());
            }
            Err(err) => {
                warn!("Failed to download {}: {}", path, err);
                local_paths.push(format!("error:{}", err));
            }
        }
    }

    {
        let mut guard = state.lock().await;
        if let Some(session) = guard.sessions.get_mut(session_id) {
            session.state = if local_paths.iter().any(|p| p.starts_with("error:")) {
                SessionState::Failed
            } else {
                SessionState::Completed
            };
            if let Some(job) = session.jobs.iter_mut().find(|j| j.job_id == job_id) {
                job.state = JobState::Done;
                job.results = local_paths.clone();
            }
        }
    }

    Ok(local_paths)
}

async fn fail_generation(
    state: Arc<Mutex<ServerState>>,
    session_id: &str,
    job_id: &str,
    message: String,
) -> Result<Vec<String>, JsonRpcError> {
    error!("Generation failed for session {} job {}: {}", session_id, job_id, message);
    set_job_state(state, session_id, job_id, JobState::Failed, Some(message.clone())).await;
    Err(JsonRpcError::new(
        McpErrorCode::InternalError as i32,
        message,
        None,
    ))
}

async fn set_job_state(
    state: Arc<Mutex<ServerState>>,
    session_id: &str,
    job_id: &str,
    job_state: JobState,
    error: Option<String>,
) {
    let mut guard = state.lock().await;
    if let Some(session) = guard.sessions.get_mut(session_id)
        && let Some(job) = session.jobs.iter_mut().find(|j| j.job_id == job_id)
    {
        job.state = job_state;
        job.error = error;
    }
}

fn strings_from_array(arr: &[Value]) -> Vec<String> {
    arr.iter()
        .filter_map(|v| v.as_str().map(String::from))
        .collect()
}

fn summarize(parts: &[String]) -> String {
    let joined = parts.join(", ");
    if joined.chars().count() > 80 {
        format!("{}...", joined.chars().take(80).collect::<String>())
    } else {
        joined
    }
}
