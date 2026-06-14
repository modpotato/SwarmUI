use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::{Client, Url};
use serde_json::{json, Value};
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::session::{AdvancedParams, DefaultsSnapshot, StandardParams};

/// HTTP client for talking to SwarmUI.
#[derive(Clone)]
pub struct SwarmClient {
    client: Client,
    base_url: String,
    session: Arc<Mutex<String>>,
    username: String,
    password: String,
}

impl SwarmClient {
    pub fn new(base_url: &str, session: &str, username: &str, password: &str) -> Self {
        Self {
            client: Client::builder()
                .cookie_store(true)
                .build()
                .expect("Failed to build HTTP client"),
            base_url: base_url.trim_end_matches('/').to_string(),
            session: Arc::new(Mutex::new(session.to_string())),
            username: username.to_string(),
            password: password.to_string(),
        }
    }

    fn build_url(&self, path: &str) -> Result<Url> {
        let path = path.trim_start_matches('/');
        Url::parse(&format!("{}/{}", self.base_url, path))
            .with_context(|| format!("Invalid SwarmUI base URL: {}", self.base_url))
    }

    /// Returns the current session id, acquiring one automatically if needed.
    pub async fn session_id(&self) -> String {
        self.ensure_session().await.unwrap_or_default()
    }

    async fn ensure_session(&self) -> Result<String> {
        {
            let session = self.session.lock().await;
            if !session.is_empty() {
                return Ok(session.clone());
            }
        }

        let new_session = self.acquire_session().await?;
        let mut session = self.session.lock().await;
        *session = new_session.clone();
        info!("Acquired SwarmUI session id automatically");
        Ok(new_session)
    }

    async fn acquire_session(&self) -> Result<String> {
        // Try anonymous/new session first. This works when AuthorizationRequired is false.
        if let Ok(sess) = self.call_get_new_session().await
            && !sess.is_empty()
        {
            return Ok(sess);
        }

        // If credentials are available, log in and then create a session.
        if !self.username.is_empty() && !self.password.is_empty() {
            warn!("Anonymous session acquisition failed; attempting login with supplied credentials");
            self.login().await.context("Login failed")?;
            let sess = self.call_get_new_session().await.context("GetNewSession failed after login")?;
            if !sess.is_empty() {
                return Ok(sess);
            }
        }

        anyhow::bail!(
            "Unable to acquire a SwarmUI session id. Provide SWARMUI_SESSION, or SWARMUI_USERNAME/SWARMUI_PASSWORD if authorization is enabled."
        )
    }

    async fn call_get_new_session(&self) -> Result<String> {
        let url = self.build_url("/API/GetNewSession")?;
        let resp = self
            .client
            .post(url)
            .json(&json!({}))
            .send()
            .await
            .context("Failed to contact SwarmUI for new session")?;
        let status = resp.status();
        let body = resp.text().await.context("Failed to read GetNewSession response")?;
        if !status.is_success() {
            anyhow::bail!("SwarmUI returned HTTP {}: {}", status, body);
        }
        let data: Value = serde_json::from_str(&body).context("SwarmUI returned invalid JSON for new session")?;
        if let Some(err) = data.get("error").and_then(Value::as_str) {
            anyhow::bail!("GetNewSession error: {}", err);
        }
        data.get("session_id")
            .and_then(Value::as_str)
            .map(String::from)
            .context("GetNewSession response missing session_id")
    }

    async fn login(&self) -> Result<()> {
        let url = self.build_url("/API/Login")?;
        let payload = json!({
            "username": self.username,
            "password": self.password
        });
        let resp = self
            .client
            .post(url)
            .json(&payload)
            .send()
            .await
            .context("Failed to contact SwarmUI for login")?;
        let status = resp.status();
        let body = resp.text().await.context("Failed to read login response")?;
        if !status.is_success() {
            anyhow::bail!("SwarmUI returned HTTP {}: {}", status, body);
        }
        let data: Value = serde_json::from_str(&body).context("SwarmUI returned invalid JSON for login")?;
        if let Some(err) = data.get("error").and_then(Value::as_str) {
            anyhow::bail!("Login error: {}", err);
        }
        Ok(())
    }

    /// Low-level POST helper that injects the current session id.
    async fn post(&self, path: &str, payload: Value) -> Result<Value> {
        let session_id = self.ensure_session().await?;
        let url = self.build_url(path)?;
        let mut body_obj = match payload {
            Value::Object(obj) => obj,
            _ => serde_json::Map::new(),
        };
        body_obj.insert("session_id".to_string(), json!(session_id));

        debug!("POST {} with session {}", path, session_id);
        let resp = self
            .client
            .post(url)
            .json(&Value::Object(body_obj))
            .send()
            .await
            .with_context(|| format!("Failed to contact SwarmUI at {}", path))?;
        let status = resp.status();
        let body = resp.text().await.with_context(|| format!("Failed to read response from {}", path))?;
        if !status.is_success() {
            anyhow::bail!("SwarmUI returned HTTP {} for {}: {}", status, path, body);
        }
        serde_json::from_str(&body).with_context(|| format!("SwarmUI returned invalid JSON from {}", path))
    }

    /// Fetches parameter defaults from SwarmUI's `ListT2IParams` endpoint.
    /// Falls back to the provided overrides for individual keys.
    pub async fn fetch_defaults(&self, overrides: Option<Value>) -> Result<DefaultsSnapshot> {
        let data = self.post("/API/ListT2IParams", json!({})).await?;
        let mut defaults = Self::parse_defaults(&data)?;

        if let Some(overrides) = overrides {
            apply_overrides(&mut defaults, &overrides)?;
        }
        Ok(defaults)
    }

    fn parse_defaults(data: &Value) -> Result<DefaultsSnapshot> {
        let list = data
            .get("list")
            .and_then(Value::as_array)
            .context("Missing 'list' in SwarmUI defaults response")?;

        let mut standard = StandardParams {
            model: String::new(),
            ..Default::default()
        };
        let mut advanced = AdvancedParams::default();

        for param in list {
            let id = param.get("id").and_then(Value::as_str).unwrap_or("");
            let is_advanced = param.get("advanced").and_then(Value::as_bool).unwrap_or(false);
            let default_val = param.get("default").cloned();

            if is_advanced {
                if let Some(v) = default_val {
                    advanced.values.insert(id.to_string(), v);
                }
                continue;
            }

            match id {
                "model" => {
                    if let Some(v) = default_val.and_then(|v| v.as_str().map(String::from)) {
                        standard.model = v;
                    }
                }
                "width" => standard.width = default_val.and_then(|v| as_u32(&v)),
                "height" => standard.height = default_val.and_then(|v| as_u32(&v)),
                "aspectratio" => standard.aspect_ratio = default_val.and_then(|v| as_string(&v)),
                "steps" => standard.steps = default_val.and_then(|v| as_u32(&v)),
                "cfgscale" => standard.cfg_scale = default_val.and_then(|v| as_f64(&v)),
                "sampler" => standard.sampler = default_val.and_then(|v| as_string(&v)),
                "scheduler" => standard.scheduler = default_val.and_then(|v| as_string(&v)),
                "seed" => standard.seed = default_val.and_then(|v| as_i64(&v)),
                "images" => standard.images = default_val.and_then(|v| as_u32(&v)),
                "batchsize" => standard.batch_size = default_val.and_then(|v| as_u32(&v)),
                _ => {}
            }
        }

        // Try to pick the first available SD model if no default model was provided.
        if standard.model.is_empty()
            && let Some(models) = data.get("models").and_then(Value::as_object)
            && let Some(sd_models) = models.get("Stable-Diffusion").and_then(Value::as_array)
            && let Some(first) = sd_models.first().and_then(|m| m.as_array())
            && let Some(name) = first.first().and_then(Value::as_str)
        {
            standard.model = name.to_string();
        }

        if standard.model.is_empty() {
            standard.model = "OfficialStableDiffusion/sd_xl_base_1.0".to_string();
        }

        Ok(DefaultsSnapshot {
            prompt: vec!["a beautiful, highly detailed digital artwork".to_string()],
            negative_prompt: vec!["blurry, low quality, watermark, signature".to_string()],
            standard,
            advanced,
        })
    }

    /// Calls SwarmUI's synchronous `GenerateText2Image` route.
    pub async fn generate(&self, images: u32, raw_input: Value) -> Result<GenerateResponse> {
        let payload = json!({
            "images": images,
            "rawInput": raw_input
        });
        info!("Sending generation request to SwarmUI");
        debug!("Generation payload: {}", payload);
        let data = self.post("/API/GenerateText2Image", payload).await?;
        if let Some(err) = data.get("error").and_then(Value::as_str) {
            anyhow::bail!("SwarmUI generation error: {}", err);
        }
        let files: Vec<String> = data
            .get("images")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        Ok(GenerateResponse { files })
    }

    /// Downloads an image from SwarmUI's local server path.
    pub async fn download_image(&self, path: &str) -> Result<Vec<u8>> {
        let url = self.build_url(path)?;
        let resp = self
            .client
            .get(url)
            .send()
            .await
            .context("Failed to download generated image")?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("SwarmUI returned HTTP {} for image download: {}", status, body);
        }
        resp.bytes().await.map(|b| b.to_vec()).context("Failed to read image bytes")
    }

    /// Reads a local image file and encodes it as a SwarmUI-compatible data URL.
    pub fn encode_local_image(path: &str) -> Result<String> {
        let path = Path::new(path);
        let bytes = std::fs::read(path)
            .with_context(|| format!("Failed to read init image at {}", path.display()))?;
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png")
            .to_lowercase();
        let mime = match ext.as_str() {
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "gif" => "image/gif",
            _ => "image/png",
        };
        Ok(format!("data:{};base64,{}", mime, BASE64.encode(&bytes)))
    }
}

pub struct GenerateResponse {
    pub files: Vec<String>,
}

fn apply_overrides(defaults: &mut DefaultsSnapshot, overrides: &Value) -> Result<()> {
    if let Some(obj) = overrides.as_object() {
        if let Some(prompt) = obj.get("prompt").and_then(Value::as_array) {
            defaults.prompt = strings_from_array(prompt);
        }
        if let Some(neg) = obj.get("negative_prompt").and_then(Value::as_array) {
            defaults.negative_prompt = strings_from_array(neg);
        }
        if let Some(model) = obj.get("model").and_then(Value::as_str) {
            defaults.standard.model = model.to_string();
        }
        if let Some(width) = obj.get("width").and_then(as_u32) {
            defaults.standard.width = Some(width);
        }
        if let Some(height) = obj.get("height").and_then(as_u32) {
            defaults.standard.height = Some(height);
        }
        if let Some(steps) = obj.get("steps").and_then(as_u32) {
            defaults.standard.steps = Some(steps);
        }
        if let Some(cfg) = obj.get("cfg_scale").and_then(as_f64) {
            defaults.standard.cfg_scale = Some(cfg);
        }
        if let Some(sampler) = obj.get("sampler").and_then(Value::as_str) {
            defaults.standard.sampler = Some(sampler.to_string());
        }
        if let Some(scheduler) = obj.get("scheduler").and_then(Value::as_str) {
            defaults.standard.scheduler = Some(scheduler.to_string());
        }
        if let Some(seed) = obj.get("seed").and_then(as_i64) {
            defaults.standard.seed = Some(seed);
        }
        if let Some(images) = obj.get("images").and_then(as_u32) {
            defaults.standard.images = Some(images);
        }
        if let Some(batch) = obj.get("batch_size").and_then(as_u32) {
            defaults.standard.batch_size = Some(batch);
        }
        if let Some(adv) = obj.get("advanced").and_then(Value::as_object) {
            defaults.advanced.values.extend(adv.iter().map(|(k, v)| (k.clone(), v.clone())));
        }
    }
    Ok(())
}

fn strings_from_array(arr: &[Value]) -> Vec<String> {
    arr.iter()
        .filter_map(|v| v.as_str().map(String::from))
        .collect()
}

fn as_u32(v: &Value) -> Option<u32> {
    v.as_u64().and_then(|n| n.try_into().ok())
}

fn as_i64(v: &Value) -> Option<i64> {
    v.as_i64()
}

fn as_f64(v: &Value) -> Option<f64> {
    v.as_f64()
}

fn as_string(v: &Value) -> Option<String> {
    v.as_str().map(String::from)
}
