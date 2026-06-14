use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::mcp::JsonRpcError;
use crate::mcp::McpErrorCode;

/// A single generate-tab instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub session_id: String,
    pub created_at: DateTime<Utc>,
    pub state: SessionState,
    pub prompt: Vec<String>,
    pub negative_prompt: Vec<String>,
    pub standard: StandardParams,
    pub advanced: AdvancedParams,
    pub init_image: Option<InitImage>,
    pub jobs: Vec<GenerationJob>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SessionState {
    Idle,
    Modified,
    Generating,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StandardParams {
    pub model: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub aspect_ratio: Option<String>,
    pub steps: Option<u32>,
    pub cfg_scale: Option<f64>,
    pub sampler: Option<String>,
    pub scheduler: Option<String>,
    pub seed: Option<i64>,
    pub images: Option<u32>,
    pub batch_size: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AdvancedParams {
    #[serde(flatten)]
    pub values: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitImage {
    pub local_path: String,
    pub creativity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationJob {
    pub job_id: String,
    pub created_at: DateTime<Utc>,
    pub state: JobState,
    pub output_directory: String,
    pub results: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum JobState {
    Pending,
    Running,
    Done,
    Failed,
}

/// Snapshot of defaults returned by `create_instance`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultsSnapshot {
    pub prompt: Vec<String>,
    pub negative_prompt: Vec<String>,
    pub standard: StandardParams,
    pub advanced: AdvancedParams,
}

/// Holds defaults and all active sessions.
pub struct SessionManager {
    defaults: DefaultsSnapshot,
    sessions: HashMap<String, Session>,
}

impl SessionManager {
    pub fn new(defaults: DefaultsSnapshot) -> Self {
        Self {
            defaults,
            sessions: HashMap::new(),
        }
    }

    pub fn defaults(&self) -> &DefaultsSnapshot {
        &self.defaults
    }

    pub fn create(&mut self) -> Session {
        let session_id = random_session_id();
        let session = Session {
            session_id: session_id.clone(),
            created_at: Utc::now(),
            state: SessionState::Idle,
            prompt: self.defaults.prompt.clone(),
            negative_prompt: self.defaults.negative_prompt.clone(),
            standard: self.defaults.standard.clone(),
            advanced: self.defaults.advanced.clone(),
            init_image: None,
            jobs: Vec::new(),
        };
        self.sessions.insert(session_id, session.clone());
        session
    }

    pub fn get(&self, session_id: &str) -> Option<&Session> {
        self.sessions.get(session_id)
    }

    pub fn get_mut(&mut self, session_id: &str) -> Option<&mut Session> {
        self.sessions.get_mut(session_id)
    }

    pub fn close(&mut self, session_id: &str) -> bool {
        self.sessions.remove(session_id).is_some()
    }

    pub fn list(&self) -> Vec<&Session> {
        self.sessions.values().collect()
    }

    pub fn list_filtered(&self, ids: &[String]) -> Vec<&Session> {
        let set: HashSet<&str> = ids.iter().map(String::as_str).collect();
        self.sessions
            .values()
            .filter(|s| set.contains(s.session_id.as_str()))
            .collect()
    }
}

fn random_session_id() -> String {
    format!("{:08x}", rand::random::<u32>())
}

/// Operations that can be applied to a prompt array.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct PromptOps {
    pub set: Option<Vec<String>>,
    pub append: Option<String>,
    pub prepend: Option<String>,
    pub insert: Option<InsertOp>,
    pub delete: Option<Vec<usize>>,
    pub replace: Option<Vec<ReplaceOp>>,
    pub find_replace: Option<Vec<FindReplaceOp>>,
    pub move_items: Option<Vec<MoveOp>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InsertOp {
    pub index: usize,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReplaceOp {
    pub index: usize,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FindReplaceOp {
    pub find: String,
    pub replace: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MoveOp {
    pub from: usize,
    pub to: usize,
}

/// Applies prompt operations to a mutable vector.
pub fn apply_prompt_ops(target: &mut Vec<String>, ops: &PromptOps) -> Result<(), JsonRpcError> {
    if let Some(set) = &ops.set {
        *target = set.clone();
    }
    if let Some(prepend) = &ops.prepend {
        target.insert(0, prepend.clone());
    }
    if let Some(append) = &ops.append {
        target.push(append.clone());
    }
    if let Some(insert) = &ops.insert {
        if insert.index > target.len() {
            return Err(JsonRpcError::new(
                McpErrorCode::InvalidParams as i32,
                format!("Insert index {} out of bounds (len {})", insert.index, target.len()),
                None,
            ));
        }
        target.insert(insert.index, insert.text.clone());
    }
    if let Some(delete) = &ops.delete {
        let mut indices = delete.clone();
        indices.sort_unstable_by(|a, b| b.cmp(a));
        for idx in indices {
            if idx >= target.len() {
                return Err(JsonRpcError::new(
                    McpErrorCode::InvalidParams as i32,
                    format!("Delete index {} out of bounds (len {})", idx, target.len()),
                    None,
                ));
            }
            target.remove(idx);
        }
    }
    if let Some(replace) = &ops.replace {
        for op in replace {
            if op.index >= target.len() {
                return Err(JsonRpcError::new(
                    McpErrorCode::InvalidParams as i32,
                    format!("Replace index {} out of bounds (len {})", op.index, target.len()),
                    None,
                ));
            }
            target[op.index] = op.text.clone();
        }
    }
    if let Some(find_replace) = &ops.find_replace {
        for item in target.iter_mut() {
            for op in find_replace {
                *item = item.replace(&op.find, &op.replace);
            }
        }
    }
    if let Some(moves) = &ops.move_items {
        for op in moves {
            if op.from >= target.len() || op.to > target.len() {
                return Err(JsonRpcError::new(
                    McpErrorCode::InvalidParams as i32,
                    format!(
                        "Move indices from={} to={} out of bounds (len {})",
                        op.from,
                        op.to,
                        target.len()
                    ),
                    None,
                ));
            }
            let item = target.remove(op.from);
            target.insert(op.to, item);
        }
    }
    Ok(())
}

/// Builds a JSON object suitable for SwarmUI's `GenerateText2Image` endpoint.
pub fn build_swarm_request(session: &Session) -> Value {
    let mut req = serde_json::Map::new();
    let prompt = session.prompt.join(", ");
    let negative = session.negative_prompt.join(", ");

    req.insert("prompt".to_string(), json!(prompt));
    req.insert("negativeprompt".to_string(), json!(negative));
    req.insert("model".to_string(), json!(session.standard.model.clone()));

    if let Some(width) = session.standard.width {
        req.insert("width".to_string(), json!(width));
    }
    if let Some(height) = session.standard.height {
        req.insert("height".to_string(), json!(height));
    }
    if let Some(ar) = &session.standard.aspect_ratio {
        req.insert("aspectratio".to_string(), json!(ar));
    }
    if let Some(steps) = session.standard.steps {
        req.insert("steps".to_string(), json!(steps));
    }
    if let Some(cfg) = session.standard.cfg_scale {
        req.insert("cfgscale".to_string(), json!(cfg));
    }
    if let Some(sampler) = &session.standard.sampler {
        req.insert("sampler".to_string(), json!(sampler));
    }
    if let Some(scheduler) = &session.standard.scheduler {
        req.insert("scheduler".to_string(), json!(scheduler));
    }
    if let Some(seed) = session.standard.seed {
        req.insert("seed".to_string(), json!(seed));
    }
    if let Some(batch) = session.standard.batch_size {
        req.insert("batchsize".to_string(), json!(batch));
    }

    for (k, v) in &session.advanced.values {
        req.insert(k.clone(), v.clone());
    }

    if let Some(init) = &session.init_image {
        req.insert("initimagecreativity".to_string(), json!(init.creativity));
    }

    Value::Object(req)
}

/// Computes a delta view of a session against defaults.
pub fn delta_view(session: &Session, defaults: &DefaultsSnapshot) -> Value {
    let mut delta = serde_json::Map::new();
    if session.prompt != defaults.prompt {
        delta.insert("prompt".to_string(), json!(session.prompt));
    }
    if session.negative_prompt != defaults.negative_prompt {
        delta.insert("negative_prompt".to_string(), json!(session.negative_prompt));
    }
    if session.standard.model != defaults.standard.model {
        delta.insert("model".to_string(), json!(session.standard.model));
    }
    macro_rules! diff_std {
        ($field:ident, $key:expr) => {
            if session.standard.$field != defaults.standard.$field {
                delta.insert($key.to_string(), json!(session.standard.$field));
            }
        };
    }
    diff_std!(width, "width");
    diff_std!(height, "height");
    diff_std!(aspect_ratio, "aspect_ratio");
    diff_std!(steps, "steps");
    diff_std!(cfg_scale, "cfg_scale");
    diff_std!(sampler, "sampler");
    diff_std!(scheduler, "scheduler");
    diff_std!(seed, "seed");
    diff_std!(images, "images");
    diff_std!(batch_size, "batch_size");

    if session.advanced.values != defaults.advanced.values {
        delta.insert("advanced".to_string(), json!(session.advanced.values));
    }
    if let Some(init) = &session.init_image {
        delta.insert("init_image".to_string(), json!(init));
    }
    delta.insert("state".to_string(), json!(session.state));
    Value::Object(delta)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_ops_set_and_append() {
        let mut target = vec!["old".to_string()];
        let ops = PromptOps {
            set: Some(vec!["a".to_string(), "b".to_string()]),
            append: Some("c".to_string()),
            ..Default::default()
        };
        apply_prompt_ops(&mut target, &ops).unwrap();
        assert_eq!(target, vec!["a", "b", "c"]);
    }

    #[test]
    fn prompt_ops_find_replace_and_move() {
        let mut target = vec!["red car".to_string(), "red hat".to_string()];
        let ops = PromptOps {
            find_replace: Some(vec![FindReplaceOp {
                find: "red".to_string(),
                replace: "blue".to_string(),
            }]),
            move_items: Some(vec![MoveOp { from: 0, to: 1 }]),
            ..Default::default()
        };
        apply_prompt_ops(&mut target, &ops).unwrap();
        assert_eq!(target, vec!["blue hat", "blue car"]);
    }

    #[test]
    fn random_session_id_is_eight_hex_chars() {
        let id = super::random_session_id();
        assert_eq!(id.len(), 8);
        assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
    }
}

/// Built-in fallback defaults when SwarmUI cannot be reached.
pub fn fallback_defaults() -> DefaultsSnapshot {
    DefaultsSnapshot {
        prompt: vec!["a beautiful, highly detailed digital artwork".to_string()],
        negative_prompt: vec!["blurry, low quality, watermark, signature".to_string()],
        standard: StandardParams {
            model: "OfficialStableDiffusion/sd_xl_base_1.0".to_string(),
            width: Some(1024),
            height: Some(1024),
            aspect_ratio: Some("1:1".to_string()),
            steps: Some(20),
            cfg_scale: Some(7.0),
            sampler: Some("euler".to_string()),
            scheduler: Some("normal".to_string()),
            seed: Some(-1),
            images: Some(1),
            batch_size: Some(1),
        },
        advanced: AdvancedParams::default(),
    }
}
