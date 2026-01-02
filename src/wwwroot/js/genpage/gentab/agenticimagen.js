/** 
 * Agentic Imagen - Image-guided, two-agent LLM orchestration for iterative prompt refinement
 */
class AgenticImagen {
    // Constants
    static MIN_RESOLUTION = 64;
    static MAX_RESOLUTION = 2048;
    static ERROR_DISPLAY_TIMEOUT_MS = 5000;
    static TOOL_ARG_DISPLAY_LIMIT = 100;

    constructor() {
        this.status = 'idle'; // 'idle' | 'running' | 'completed' | 'error'
        this.targetImage = null; // { type: 'upload' | 'url', src: string, dataUrl: string }
        this.tags = '';
        this.maxIterations = 5;
        this.iterations = [];
        this.finalConfig = null;
        this.currentTurn = null; // 'A' | 'B' | null
        this.currentIteration = 0;
        this.abortController = null;
        this.models = [];
        this.turnAModel = null;
        this.turnBModel = null;

        // Configurable system prompts (loaded from user settings)
        this.turnASystemPrompt = null;
        this.turnBSystemPrompt = null;

        // UI state
        this.isVisible = false;
        this.isMinimized = false;
        this.dragState = null;

        // Widget position
        this.position = { x: 100, y: 100 };
        this.size = { width: 600, height: 700 };

        // Bind drag handlers once to avoid memory leaks
        this.boundOnDrag = this.onDrag.bind(this);
        this.boundStopDrag = this.stopDrag.bind(this);

        this.mode = 'match'; // 'match' | 'simplify'
        this.queue = [];
        this.isQueueRunning = false;

        this.pendingUserFeedback = null;

        // Load queue from localStorage
        try {
            let savedQueue = localStorage.getItem('agentic_imagen_queue');
            if (savedQueue) {
                this.queue = JSON.parse(savedQueue);
            }
        } catch (e) {
            console.error('Failed to load queue from localStorage:', e);
            this.queue = [];
        }
    }

    /**
     * Initialize the Agentic Imagen feature
     */
    async init() {
        console.log('Initializing Agentic Imagen...');

        // Load configurable system prompts from user data
        try {
            let userData = await new Promise((resolve, reject) => {
                genericRequest('GetMyUserData', {}, resolve, 0, reject);
            });

            if (userData.agentic_imagen_prompts) {
                this.turnASystemPrompt = userData.agentic_imagen_prompts.turn_a || this.getDefaultTurnAPrompt();
                this.turnBSystemPrompt = userData.agentic_imagen_prompts.turn_b || this.getDefaultTurnBPrompt();
            } else {
                // Fallback to defaults if not available
                this.turnASystemPrompt = this.getDefaultTurnAPrompt();
                this.turnBSystemPrompt = this.getDefaultTurnBPrompt();
            }
        } catch (error) {
            console.error('Error loading Agentic Imagen prompts:', error);
            // Use defaults on error
            this.turnASystemPrompt = this.getDefaultTurnAPrompt();
            this.turnBSystemPrompt = this.getDefaultTurnBPrompt();
        }

        // Load available models from OpenRouter (with caching)
        try {
            let cachedModels = null;
            try {
                cachedModels = localStorage.getItem('agentic_imagen_models');
                if (cachedModels) {
                    this.models = JSON.parse(cachedModels);
                    this.populateModelDropdowns();
                    console.log('Agentic Imagen: Loaded models from cache');
                }
            } catch (e) {
                console.error('Failed to load models from cache:', e);
            }

            // Always fetch fresh models if cache is empty or > 1 hour old
            let shouldFetch = !cachedModels;
            if (cachedModels) {
                let cacheTime = localStorage.getItem('agentic_imagen_models_time');
                if (cacheTime) {
                    let age = Date.now() - parseInt(cacheTime);
                    shouldFetch = age > 3600000; // 1 hour
                }
            }

            if (shouldFetch) {
                let data = await new Promise((resolve, reject) => {
                    genericRequest('GetOpenRouterModels', {}, resolve, 0, reject);
                });

                if (data.error) {
                    console.error('OpenRouter API error:', data.error);
                    return;
                }

                this.models = data.models || [];
                this.populateModelDropdowns();

                // Cache the models
                localStorage.setItem('agentic_imagen_models', JSON.stringify(this.models));
                localStorage.setItem('agentic_imagen_models_time', Date.now().toString());
                console.log('Agentic Imagen: Fetched and cached models');
            }
        } catch (error) {
            console.error('Error loading models for Agentic Imagen:', error);
        }

        // Restore LoRA toggle state if saved
        let enableLoras = localStorage.getItem('agentic_imagen_enable_loras') === 'true';
        let loraToggle = document.getElementById('agentic_imagen_enable_loras');
        if (loraToggle) {
            loraToggle.checked = enableLoras;
            loraToggle.addEventListener('change', () => {
                localStorage.setItem('agentic_imagen_enable_loras', loraToggle.checked);
            });
        }
    }

    /**
     * Populate model selection dropdowns
     */
    populateModelDropdowns() {
        let turnASelect = document.getElementById('agentic_imagen_turn_a_model');
        let turnBSelect = document.getElementById('agentic_imagen_turn_b_model');

        if (!turnASelect || !turnBSelect) {
            return;
        }

        [turnASelect, turnBSelect].forEach(select => {
            select.innerHTML = '';

            if (this.models.length === 0) {
                select.innerHTML = '<option value="">No models available</option>';
                return;
            }

            let defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select a model...';
            select.appendChild(defaultOption);

            // Recommended models for vision tasks
            let recommendedModels = [
                'anthropic/claude-3.5-sonnet',
                'anthropic/claude-3-opus',
                'openai/gpt-4-turbo',
                'openai/gpt-4o',
                'google/gemini-pro-vision'
            ];

            let recommended = this.models.filter(m =>
                recommendedModels.some(r => m.id.includes(r)) && m.supportsVision
            );
            let others = this.models.filter(m =>
                !recommendedModels.some(r => m.id.includes(r))
            );

            if (recommended.length > 0) {
                let optgroup = document.createElement('optgroup');
                optgroup.label = 'Recommended (Vision-capable)';
                recommended.forEach(model => {
                    let option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            }

            if (others.length > 0) {
                let optgroup = document.createElement('optgroup');
                optgroup.label = 'Other Models';
                others.slice(0, 50).forEach(model => {
                    let option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            }
        });
    }

    /**
     * Show the Agentic Imagen widget
     */
    show() {
        let widget = document.getElementById('agentic_imagen_widget');
        if (!widget) {
            console.error('Agentic Imagen widget not found in DOM');
            return;
        }

        this.isVisible = true;
        widget.style.display = 'block';

        // Initialize if first time showing
        if (this.models.length === 0) {
            this.init();
        }
    }

    /**
     * Hide the Agentic Imagen widget
     */
    hide() {
        let widget = document.getElementById('agentic_imagen_widget');
        if (widget) {
            this.isVisible = false;
            widget.style.display = 'none';
        }
    }

    /**
     * Toggle widget visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Minimize/expand the widget
     */
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        let widget = document.getElementById('agentic_imagen_widget');
        let body = document.getElementById('agentic_imagen_body');
        let footer = document.getElementById('agentic_imagen_footer');

        if (this.isMinimized) {
            widget.classList.add('minimized');
            body.style.display = 'none';
            footer.style.display = 'none';
        } else {
            widget.classList.remove('minimized');
            body.style.display = 'block';
            footer.style.display = 'block';
        }
    }

    /**
     * Start drag operation
     */
    startDrag(e) {
        e.preventDefault();

        let widget = document.getElementById('agentic_imagen_widget');
        let rect = widget.getBoundingClientRect();

        this.dragState = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: rect.left,
            initialY: rect.top
        };

        document.addEventListener('mousemove', this.boundOnDrag);
        document.addEventListener('mouseup', this.boundStopDrag);
    }

    /**
     * Handle drag movement
     */
    onDrag(e) {
        if (!this.dragState) return;

        e.preventDefault();

        let deltaX = e.clientX - this.dragState.startX;
        let deltaY = e.clientY - this.dragState.startY;

        // Constrain to viewport bounds
        let newX = this.dragState.initialX + deltaX;
        let newY = this.dragState.initialY + deltaY;

        // Keep widget visible
        let maxWidth = window.innerWidth - this.size.width;
        let maxHeight = window.innerHeight - 50; // 50px = minimized height

        this.position.x = Math.max(0, Math.min(maxWidth, newX));
        this.position.y = Math.max(0, Math.min(maxHeight, newY));

        this.updatePosition();
    }

    /**
     * Stop drag operation
     */
    stopDrag() {
        this.dragState = null;
        document.removeEventListener('mousemove', this.boundOnDrag);
        document.removeEventListener('mouseup', this.boundStopDrag);
    }

    /**
     * Update widget position
     */
    updatePosition() {
        let widget = document.getElementById('agentic_imagen_widget');
        if (widget) {
            widget.style.left = this.position.x + 'px';
            widget.style.top = this.position.y + 'px';
        }
    }

    /**
     * Handle target image file upload
     */
    handleImageUpload(e) {
        let file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }

        let reader = new FileReader();
        reader.onload = (event) => {
            this.targetImage = {
                type: 'upload',
                src: file.name,
                dataUrl: event.target.result
            };
            this.updateImagePreview();
        };
        reader.onerror = () => {
            this.showError('Failed to read image file.');
        };
        reader.readAsDataURL(file);
    }

    /**
     * Handle target image URL input
     */
    handleImageUrl() {
        let urlInput = document.getElementById('agentic_imagen_image_url');
        let url = urlInput?.value.trim();

        if (!url) {
            this.targetImage = null;
            this.updateImagePreview();
            return;
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            this.showError('Please enter a valid URL.');
            return;
        }

        this.targetImage = {
            type: 'url',
            src: url,
            dataUrl: url // For URL type, src and dataUrl are the same
        };
        this.updateImagePreview();
    }

    /**
     * Update image preview display
     */
    updateImagePreview() {
        let preview = document.getElementById('agentic_imagen_image_preview');
        let clearBtn = document.getElementById('agentic_imagen_clear_image');

        if (!preview) return;

        if (this.targetImage) {
            preview.innerHTML = `<img src="${this.targetImage.dataUrl}" alt="Target image" style="max-width: 100%; height: auto; border-radius: 4px;">`;
            if (clearBtn) clearBtn.style.display = 'inline-block';
        } else {
            preview.innerHTML = '<div style="color: #888; font-style: italic;">No image selected</div>';
            if (clearBtn) clearBtn.style.display = 'none';
        }
    }

    /**
     * Clear target image
     */
    clearImage() {
        this.targetImage = null;

        let fileInput = document.getElementById('agentic_imagen_image_upload');
        let urlInput = document.getElementById('agentic_imagen_image_url');

        if (fileInput) fileInput.value = '';
        if (urlInput) urlInput.value = '';

        this.updateImagePreview();
    }

    /**
     * Execute a refinement job (single run or queue item)
     */
    async executeRefinementJob(job) {
        // Use job properties if provided, otherwise trust current instance state (legacy/single mode)
        if (job) {
            this.turnAModel = job.turnAModel;
            this.turnBModel = job.turnBModel;
            this.tags = job.tags;
            this.maxIterations = job.maxIterations;
            this.runningMode = job.mode || 'match';
            this.targetImage = job.targetImage;

            // For non-dependent jobs, validate targetImage now
            // For dependent jobs (with parentJobId), validation happens after hydration below
            if (!job.parentJobId) {
                if (!this.targetImage || (!this.targetImage.src && !this.targetImage.dataUrl)) {
                    throw new Error('Job has no valid target image. Please ensure an image is selected before adding to queue.');
                }
            }
        } else {
            // Validate inputs (legacy)
            if (!this.targetImage) {
                this.showError('Please provide a target image.');
                return;
            }
            let turnASelect = document.getElementById('agentic_imagen_turn_a_model');
            let turnBSelect = document.getElementById('agentic_imagen_turn_b_model');
            let tagsInput = document.getElementById('agentic_imagen_tags');
            let maxIterInput = document.getElementById('agentic_imagen_max_iterations');

            this.turnAModel = turnASelect?.value;
            this.turnBModel = turnBSelect?.value;
            this.tags = tagsInput?.value.trim() || '';
            this.maxIterations = parseInt(maxIterInput?.value) || 5;
            this.runningMode = this.mode || 'match';

            if (!this.turnAModel || !this.turnBModel) {
                this.showError('Please select models for both Turn A and Turn B.');
                return;
            }
        }

        // Check for parent job dependency - hydrate targetImage from completed parent
        if (job && job.parentJobId) {
            this.addTranscriptMessage('system', 'Resolving dependent job from parent...');

            // Find parent
            let parent = this.queue.find(j => j.id === job.parentJobId);

            if (!parent) {
                throw new Error("Parent job not found in queue.");
            }

            if (parent.status === 'error') {
                throw new Error("Parent job failed, cannot proceed.");
            }

            if (parent.status !== 'completed') {
                throw new Error(`Parent job is not complete (Status: ${parent.status}).`);
            }

            if (!parent.result || !parent.result.image) {
                throw new Error("Parent job did not produce an image result.");
            }

            // Hydrate from parent result
            this.targetImage = {
                type: 'url',
                src: parent.result.image,
                dataUrl: parent.result.image
            };
            this.tags = parent.result.positive;

            // Update the job object for UI status
            job.tags = this.tags;
            job.targetImage = this.targetImage; // Also update job so re-runs work
            job.parentJobId = null;

            this.addTranscriptMessage('system', 'Parent job resolved. Starting dependent task.');
        }

        // Safety cap
        this.maxIterations = Math.min(Math.max(1, this.maxIterations), 20);

        // Reset state
        this.status = 'running';
        this.iterations = [];
        this.currentIteration = 0;
        this.finalConfig = null;
        this.abortController = new AbortController();

        // Ensure target image has a usable URL for the API
        // For external URLs (http/https), we can pass them directly to OpenRouter
        // For local images (View/, Output/, file uploads), we need to convert to data URL
        if (this.targetImage && this.targetImage.src) {
            let url = this.targetImage.src;

            // Validate src is not empty
            if (!url || url.trim() === '') {
                throw new Error('Target image source is empty.');
            }

            const isExternalUrl = url.startsWith('http://') || url.startsWith('https://');
            const isDataUrl = url.startsWith('data:');

            if (isExternalUrl) {
                // External URLs can be passed directly to OpenRouter - no need to fetch
                this.addTranscriptMessage('system', `Using external image URL directly...`);
                this.targetImage.dataUrl = url; // Just use the URL as-is
            } else if (!isDataUrl) {
                // Local image - need to convert to data URL
                try {
                    this.addTranscriptMessage('system', `Preprocessing local image: ${url.substring(0, 80)}...`);

                    let fetchUrl = url;
                    if (!url.startsWith('View/') && !url.startsWith('Output/')) {
                        fetchUrl = 'View/' + url;
                    }

                    console.log('[Agentic Imagen] Fetching local image from:', fetchUrl);
                    let dataUrl = await this.imagePathToDataURL(fetchUrl);
                    if (dataUrl) {
                        this.targetImage.dataUrl = dataUrl;
                    } else {
                        throw new Error(`Failed to load local image from: ${fetchUrl}`);
                    }
                } catch (e) {
                    console.error("Error preparing local image:", e);
                    if (!this.isQueueRunning) {
                        this.showError('Failed to prepare target image: ' + e.message);
                        return;
                    }
                    throw e;
                }
            }
            // If already a data URL, nothing to do
        }

        this.updateUI(); // Update UI again after loading image

        this.clearTranscript();

        let startMsg = this.runningMode === 'simplify'
            ? 'Starting Prompt Simplification...'
            : this.runningMode === 'variation'
                ? 'Starting Variation Generation...'
                : 'Starting Agentic Imagen refinement...';

        this.addTranscriptMessage('system', startMsg);

        // If there was pending feedback, log it
        if (this.pendingUserFeedback) {
            this.addTranscriptMessage('user', this.pendingUserFeedback);
        }

        try {
            await this.runIterationLoop();
        } catch (error) {
            console.error('Error in refinement loop:', error);

            // Check for 412 Precondition Failed
            let errorMsg = error.message || error.toString();
            if (errorMsg.includes('412')) {
                errorMsg += "\n(This usually means the request was blocked by the server. Check if your payload is too large or if the server has specific restrictions.)";
            }

            // Only show error if we are not in a queue (queue handles its own errors)
            if (!this.isQueueRunning) {
                this.showError('Refinement failed: ' + errorMsg);
                this.status = 'error';
                this.updateUI();
            }
            throw error; // Re-throw for queue to catch
        }
    }

    /**
     * Main iteration loop
     */
    async runIterationLoop() {
        while (this.currentIteration < this.maxIterations && this.status === 'running') {
            this.currentIteration++;
            this.addTranscriptMessage('system', `--- Iteration ${this.currentIteration} / ${this.maxIterations} ---`);

            let iteration = {
                id: this.currentIteration,
                turnA: null,
                turnB: null,
                generatedImages: [],
                decision: 'continue'
            };

            // Turn A: Prompt Engineer
            this.currentTurn = 'A';
            this.updateUI();
            this.showThinking('A');

            try {
                iteration.turnA = await this.executeTurnA();
            } catch (error) {
                this.addTranscriptMessage('error', `Turn A failed: ${error.message || error}`);
                throw error;
            } finally {
                this.hideThinking();
            }

            // Generate image if Turn A made changes
            if (iteration.turnA.toolCalls && iteration.turnA.toolCalls.length > 0) {
                let hasGenerate = iteration.turnA.toolCalls.some(tc => tc.name === 'generate_image');
                if (hasGenerate) {
                    try {
                        iteration.generatedImages = await this.generateImages();
                    } catch (error) {
                        this.addTranscriptMessage('error', `Image generation failed: ${error.message || error}`);
                        throw error;
                    }
                }
            }

            // Turn B: Critic
            this.currentTurn = 'B';
            this.updateUI();
            this.showThinking('B');

            try {
                iteration.turnB = await this.executeTurnB(iteration.generatedImages);
                iteration.decision = iteration.turnB.decision;
            } catch (error) {
                this.addTranscriptMessage('error', `Turn B failed: ${error.message || error}`);
                throw error;
            } finally {
                this.hideThinking();
            }

            this.iterations.push(iteration);

            // Check if Turn B decided to stop
            if (iteration.decision === 'stop') {
                if (this.runningMode === 'simplify') {
                    this.addTranscriptMessage('system', 'Turn B decided the simplification is complete (or went too far).');
                } else if (this.runningMode === 'variation') {
                    this.addTranscriptMessage('system', 'Turn B found an excellent variation! Stopping.');
                } else {
                    this.addTranscriptMessage('system', 'Turn B decided the refinement is complete!');
                }
                break;
            }
        }

        // Finalize
        this.status = 'completed';
        this.currentTurn = null;
        this.captureFinalConfig();
        // Capture final image from last iteration if available
        if (this.iterations.length > 0) {
            let lastIter = this.iterations[this.iterations.length - 1];
            if (lastIter.generatedImages && lastIter.generatedImages.length > 0) {
                this.finalConfig.image = lastIter.generatedImages[lastIter.generatedImages.length - 1];
            } else if (this.targetImage && this.targetImage.src) {
                // If no new image generated (e.g. just prompt refinement), use target
                this.finalConfig.image = this.targetImage.src;
            }
        }
        this.updateUI();
        this.addTranscriptMessage('system', 'Job complete! Review the results below.');
    }

    /**
     * Execute Turn A (Prompt Engineer)
     */
    async executeTurnA() {
        this.addTranscriptMessage('turn-a', 'Analyzing target and crafting prompts...');

        let systemPrompt = this.buildTurnASystemPrompt();
        let userMessage = this.buildTurnAUserMessage();

        let response = await this.callLLMWithTools(
            this.turnAModel,
            systemPrompt,
            userMessage,
            this.getTurnATools()
        );

        if (response.content) {
            this.addTranscriptMessage('turn-a', response.content);
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
            for (let toolCall of response.toolCalls) {
                this.addTranscriptMessage('tool', `Tool: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
                await this.executeToolCall(toolCall);
            }
        }

        return {
            content: response.content,
            toolCalls: response.toolCalls || []
        };
    }

    /**
     * Convert image URL to Data URL
     */
    async imagePathToDataURL(url) {
        try {
            let response = await fetch(url);
            if (!response.ok) {
                console.error(`Failed to fetch image ${url}: ${response.status} ${response.statusText}`);
                return null;
            }
            let blob = await response.blob();

            // Compress image to reduce size for LLM (JPEG 50%)
            let imgBitmap = await createImageBitmap(blob);
            let canvas = document.createElement('canvas');
            canvas.width = imgBitmap.width;
            canvas.height = imgBitmap.height;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(imgBitmap, 0, 0);

            let dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            imgBitmap.close();
            return dataUrl;
        } catch (e) {
            console.error("Failed to convert image to data URL:", e);
            return null;
        }
    }

    /**
     * Execute Turn B (Critic)
     */
    async executeTurnB(generatedImages) {
        this.addTranscriptMessage('turn-b', 'Evaluating generated images...');

        let systemPrompt = this.buildTurnBSystemPrompt();
        let userMessage = this.buildTurnBUserMessage(generatedImages);

        // Convert generated images to Data URLs
        let additionalImages = [];
        if (generatedImages && generatedImages.length > 0) {
            // Only take the last generated image to avoid payload issues and focus on the most recent result
            // The user requested: "the one were comparing to is the most recent one"
            let lastImage = generatedImages[generatedImages.length - 1];
            let imagesToProcess = [lastImage];

            for (let imgPath of imagesToProcess) {
                // Ensure path is accessible
                let url = imgPath;
                if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('View/') && !url.startsWith('Output/')) {
                    url = 'View/' + url;
                }

                let dataUrl = await this.imagePathToDataURL(url);
                if (dataUrl) {
                    additionalImages.push(dataUrl);
                }
            }
        }

        let response = await this.callLLM(
            this.turnBModel,
            systemPrompt,
            userMessage,
            additionalImages
        );

        if (response.content) {
            this.addTranscriptMessage('turn-b', response.content);
        }

        // Parse decision
        let decision = this.parseTurnBDecision(response.content);

        return {
            content: response.content,
            decision: decision
        };
    }

    /**
     * Get default Turn A system prompt (fallback)
     */
    getDefaultTurnAPrompt() {
        if (this.runningMode === 'simplify') {
            return `You are an expert prompt SIMPLIFIER. Your goal is to reduce the complexity of the prompt while maintaining the core visual concept.
            
Available tools:
- set_positive_prompt(text): Set the positive prompt (SIMPLIFIED version)
- set_negative_prompt(text): Set the negative prompt
- set_aspect_ratio(ratio): Set the aspect ratio
- set_param(name, value): Set parameters
- use_lora(name, strength): Use LoRA
- generate_image(): Test the simplified prompt

Guidelines:
1. Identify the core subject and style.
2. Remove excessive adjectives, "filler" quality tags (like "best quality, masterpice, 8k"), and redundant terms.
3. Simplify sentence structure.
4. Try to remove LoRAs if they are not essential to the core concept.
5. Call generate_image() to verify if the simplified prompt still works.`;
        }

        if (this.runningMode === 'variation') {
            return `You are a Creative Variation Engineer. Your goal is to take the target image concept and create INTERESTING VARIATIONS of it.
            
Available tools:
- set_positive_prompt(text): Set the positive prompt (VARIATION version)
- set_negative_prompt(text): Set the negative prompt
- set_aspect_ratio(ratio): Set the aspect ratio
- set_param(name, value): Set parameters
- use_lora(name, strength): Use LoRA
- generate_image(): Test the variation

Guidelines:
1. Identify the core subject and concept of the target. KEEP the main subject.
2. INTENTIONALLY CHANGE secondary elements like:
   - Lighting (e.g. sunset, neon, studio)
   - Art Styles (e.g. oil painting, sketch, 3d render, anime)
   - Backgrounds / Settings
   - Color Palettes
3. Each iteration, try a DIFFERENT direction or refine the current interesting direction.
4. Do NOT just match the target. Diverge creatively while keeping the subject recognizable.`;
        }

        return `You are an expert AI image generation prompt engineer. Your role is to iteratively refine prompts and parameters to match a target image.

Available tools:
- set_positive_prompt(text): Set the positive prompt for image generation
- set_negative_prompt(text): Set the negative prompt
- set_aspect_ratio(ratio): Set the aspect ratio for the image (options: 1:1, 4:3, 3:2, 8:5, 16:9, 21:9, 3:4, 2:3, 5:8, 9:16, 9:21)
- set_param(name, value): Set other parameters like steps, CFG, sampler
- use_lora(name, strength): Enable a LoRA model (strength 0.1 to 1.0)
- generate_image(): Trigger an image generation with current settings

Guidelines:
1. Make modest, purposeful changes each iteration - avoid changing everything at once
2. Use clear, descriptive tags in Danbooru/image-board style
3. Include quality tags and composition details
4. Be specific about subjects, lighting, and mood
5. Do NOT ask for text to be written in the image (e.g. "text 'hello'", watermarks, signed). Only describe visual elements.
6. After making changes, call generate_image() to test them

Your goal is to match the target image as closely as possible through iterative refinement.`;
    }

    /**
     * Get default Turn B system prompt (fallback)
     */
    getDefaultTurnBPrompt() {
        if (this.runningMode === 'simplify') {
            return `You are a Visual Consistency Judge. You are comparing a simplified image (Generated) to a baseline image (Target).
            
CRITICAL: You must start your response with a clear decision marker:
- "DECISION: CONTINUE" if the generated image STILL MATCHES the target concept/quality. This means Turn A can try to simplify even more.
- "DECISION: STOP" if the generated image has LOST important details or quality. This means simplification went too far.

Guidelines:
1. Ignore minor pixel-level differences. Focus on concept, composition, and style.
2. If the prompt was simplified but the image looks just as good, encourage MORE simplification (CONTINUE).
3. If the image looks broken, wrong style, or missing subject, STOP.`;
        }

        if (this.runningMode === 'variation') {
            return `You are a Creativity Judge. You are evaluating if the Generated image is a good VARIATION of the Target.
            
CRITICAL: You must start your response with a clear decision marker:
- "DECISION: CONTINUE" if the variation is boring, too similar to target, or broken.
- "DECISION: STOP" if the variation is EXCELLENT, CREATIVE, and High Quality.

Guidelines:
1. The generated image MUST keep the core subject of the target.
2. But it MUST differ significantly in style, lighting, or composition.
3. If it looks exactly like the target -> Fail (CONTINUE and ask for more changes).
4. If it looks like a completely random image (lost subject) -> Fail (CONTINUE and ask to fix subject).
5. If it is a cool reimagining -> Success (STOP).`;
        }

        return `You are a strict visual critic for AI image generation. Your role is to compare generated images against a target image and decide whether the refinement process should continue or stop.

CRITICAL: You must start your response with a clear decision marker:
- "DECISION: CONTINUE" if more refinement is needed
- "DECISION: STOP" if the current result is satisfactory

After the decision, explain your reasoning and provide specific feedback for the next iteration (if continuing).

Guidelines:
1. Compare composition, style, subjects, lighting, and overall quality
2. Be constructive but honest about gaps
3. Only STOP when the generated image adequately matches the target
4. Provide actionable feedback for Turn A to improve`;
    }

    /**
     * Get available LoRAs formatted for the prompt
     */
    getLoraListForPrompt() {
        if (!gen_param_types) return '';

        let loraParam = gen_param_types.find(p => p.id === 'loras');
        if (!loraParam || !loraParam.values) return '';

        let loras = loraParam.values;
        if (loras.length === 0) return '';

        // Limit to avoid token overflow if there are too many
        let displayLoras = loras.slice(0, 200);

        let list = displayLoras.map(lora => {
            return `- ${lora}`;
        }).join('\n');

        if (loras.length > 200) {
            list += `\n... and ${loras.length - 200} more LoRAs available.`;
        }

        return list;
    }

    /**
     * Build Turn A system prompt
     */
    buildTurnASystemPrompt() {
        let prompt = this.turnASystemPrompt || this.getDefaultTurnAPrompt();
        // If system prompt is user-provided (not default), we might need to inject simplify instructions? 
        // For now, assume default for simplify mode, or trust user set it up.
        // But if mode is complicate, users might not have a "simplify" custom prompt.
        if (this.runningMode === 'simplify' && !this.turnASystemPrompt) {
            prompt = this.getDefaultTurnAPrompt(); // Force default simplify prompt
        }

        // Add shared knowledge if enabled
        if (getUserSetting('sharedknowledge.enablesharedknowledge', false)) {
            let knowledgeText = getUserSetting('sharedknowledge.knowledgetext', '');
            if (knowledgeText.trim()) {
                prompt += '\n\n**Shared Knowledge:**\nConsider the following shared knowledge when refining the prompt:\n' + knowledgeText.trim();
            }
        }

        // Add LoRA knowledge if enabled
        let enableLoras = document.getElementById('agentic_imagen_enable_loras')?.checked;
        if (enableLoras) {
            let loraList = this.getLoraListForPrompt();
            if (loraList) {
                prompt += `\n\n**Available LoRAs:**\nThe following LoRAs are available. You may use them if they fit the style or subject. Use the \`use_lora(name, strength)\` tool to apply them.\n${loraList}`;
            }
        }

        return prompt;
    }    /**
     * Build Turn A user message
     */
    buildTurnAUserMessage() {
        let message = `Target image and tags: ${this.tags || 'No tags provided'} \n\n`;

        if (this.iterations.length > 0) {
            let lastIter = this.iterations[this.iterations.length - 1];
            message += `Previous iteration feedback from Turn B: \n${lastIter.turnB.content} \n\n`;
        }

        if (this.pendingUserFeedback) {
            message += `USER FEEDBACK / GUIDANCE: ${this.pendingUserFeedback} \n\n`;
            this.pendingUserFeedback = null; // Clear after using
        }

        message += 'Please analyze the target image and provide your next refinement step.';

        return message;
    }

    /**
     * Build Turn B system prompt
     */
    buildTurnBSystemPrompt() {
        let prompt = this.turnBSystemPrompt || this.getDefaultTurnBPrompt();
        if (this.runningMode === 'simplify' && !this.turnBSystemPrompt) {
            prompt = this.getDefaultTurnBPrompt();
        }

        // Add shared knowledge if enabled
        if (getUserSetting('sharedknowledge.enablesharedknowledge', false)) {
            let knowledgeText = getUserSetting('sharedknowledge.knowledgetext', '');
            if (knowledgeText.trim()) {
                prompt += '\n\n**Shared Knowledge:**\n' + knowledgeText.trim();
            }
        }

        return prompt;
    }

    /**
     * Build Turn B user message
     */
    buildTurnBUserMessage(generatedImages) {
        let currentPrompt = document.getElementById('alt_prompt_textbox')?.value || '(empty)';
        let currentNegPrompt = document.getElementById('alt_negativeprompt_textbox')?.value || '(empty)';
        let width = document.getElementById('input_width')?.value || 'unknown';
        let height = document.getElementById('input_height')?.value || 'unknown';

        let message = `Target image tags: ${this.tags || 'No tags provided'} \n\n`;
        message += `Current settings: \n`;
        message += `- Positive prompt: ${currentPrompt} \n`;
        message += `- Negative prompt: ${currentNegPrompt} \n`;
        message += `- Resolution: ${width}x${height} \n\n`;

        if (generatedImages && generatedImages.length > 0) {
            message += `Generated ${generatedImages.length} image(s) this iteration.\n\n`;
        }

        message += `Please compare the generated images to the target and decide whether to CONTINUE or STOP refinement.`;

        return message;
    }

    /**
     * Parse Turn B decision from response
     */
    parseTurnBDecision(content) {
        let upperContent = content.toUpperCase();

        if (upperContent.includes('DECISION: STOP') || upperContent.includes('DECISION:STOP')) {
            return 'stop';
        }

        if (upperContent.includes('DECISION: CONTINUE') || upperContent.includes('DECISION:CONTINUE')) {
            return 'continue';
        }

        // Default to continue if unclear
        console.warn('Could not parse clear decision from Turn B, defaulting to continue');
        return 'continue';
    }

    /**
     * Get available tools for Turn A
     */
    getTurnATools() {
        return [
            {
                name: 'set_positive_prompt',
                description: 'Set the positive prompt for image generation',
                parameters: {
                    type: 'object',
                    properties: {
                        text: { type: 'string', description: 'The positive prompt text' }
                    },
                    required: ['text']
                }
            },
            {
                name: 'set_negative_prompt',
                description: 'Set the negative prompt',
                parameters: {
                    type: 'object',
                    properties: {
                        text: { type: 'string', description: 'The negative prompt text' }
                    },
                    required: ['text']
                }
            },
            {
                name: 'set_aspect_ratio',
                description: 'Set the aspect ratio for the image',
                parameters: {
                    type: 'object',
                    properties: {
                        ratio: {
                            type: 'string',
                            description: 'The aspect ratio to use. Options: 1:1, 4:3, 3:2, 8:5, 16:9, 21:9, 3:4, 2:3, 5:8, 9:16, 9:21',
                            enum: ["1:1", "4:3", "3:2", "8:5", "16:9", "21:9", "3:4", "2:3", "5:8", "9:16", "9:21"]
                        }
                    },
                    required: ['ratio']
                }
            },
            {
                name: 'set_param',
                description: 'Set other generation parameters',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Parameter name (e.g., steps, cfgscale, sampler)' },
                        value: { description: 'Parameter value' }
                    },
                    required: ['name', 'value']
                }
            },
            {
                name: 'use_lora',
                description: 'Enable a LoRA model',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'The name of the LoRA to use' },
                        strength: { type: 'number', description: 'The LoRA strength (default 1.0)' }
                    },
                    required: ['name', 'strength']
                }
            },
            {
                name: 'generate_image',
                description: 'Trigger an image generation with current settings',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            }
        ];
    }

    /**
     * Call LLM with function calling support
     */
    async callLLMWithTools(modelId, systemPrompt, userMessage, tools) {
        try {
            // Format tools for OpenRouter API
            let formattedTools = tools.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }
            }));

            // Collect image data if target image is available
            let imageData = null;
            if (this.targetImage && this.targetImage.dataUrl) {
                imageData = [this.targetImage.dataUrl];
            }

            // Make the API call
            let requestBody = {
                modelId: modelId,
                systemPrompt: systemPrompt,
                userMessage: userMessage,
                tools: formattedTools,
                imageData: imageData,
                temperature: 0.7,
                maxTokens: 1000
            };

            let data = await new Promise((resolve, reject) => {
                genericRequest('CallOpenRouterWithTools', requestBody, resolve, 0, reject);
            });

            if (data.error) {
                throw new Error(data.error);
            }

            return {
                content: data.content || '',
                toolCalls: data.tool_calls || []
            };
        } catch (error) {
            console.error('Error calling LLM with tools:', error);
            throw error;
        }
    }

    /**
     * Call LLM without tools
     */
    async callLLM(modelId, systemPrompt, userMessage, additionalImages = null) {
        try {
            // Collect image data for Turn B (target + generated images)
            let imageData = [];
            if (this.targetImage && this.targetImage.dataUrl) {
                imageData.push(this.targetImage.dataUrl);
            }

            if (additionalImages && additionalImages.length > 0) {
                imageData = imageData.concat(additionalImages);
            }

            // Make the API call
            let requestBody = {
                modelId: modelId,
                systemPrompt: systemPrompt,
                userMessage: userMessage,
                imageData: imageData.length > 0 ? imageData : null,
                temperature: 0.7,
                maxTokens: 1000
            };

            let data = await new Promise((resolve, reject) => {
                genericRequest('CallOpenRouterWithTools', requestBody, resolve, 0, reject);
            });

            if (data.error) {
                throw new Error(data.error);
            }

            return {
                content: data.content || 'DECISION: CONTINUE\n\nNo response from model.'
            };
        } catch (error) {
            console.error('Error calling LLM:', error);
            throw error;
        }
    }

    /**
     * Execute a tool call
     */
    async executeToolCall(toolCall) {
        let { name, arguments: args } = toolCall;

        switch (name) {
            case 'set_positive_prompt':
                this.setPositivePrompt(args.text);
                break;
            case 'set_negative_prompt':
                this.setNegativePrompt(args.text);
                break;
            case 'set_aspect_ratio':
                this.setAspectRatio(args.ratio);
                break;
            case 'set_param':
                this.setParam(args.name, args.value);
                break;
            case 'use_lora':
                this.useLora(args.name, args.strength);
                break;
            case 'generate_image':
                // Image generation handled separately in iteration loop
                break;
            default:
                console.warn('Unknown tool:', name);
        }
    }

    /**
     * Set positive prompt in Generate tab
     */
    setPositivePrompt(text) {
        let promptBox = document.getElementById('alt_prompt_textbox');
        if (promptBox) {
            promptBox.value = text;
            triggerChangeFor(promptBox);
        }
    }

    /**
     * Set negative prompt in Generate tab
     */
    setNegativePrompt(text) {
        let negPromptBox = document.getElementById('alt_negativeprompt_textbox');
        if (negPromptBox) {
            negPromptBox.value = text;
            triggerChangeFor(negPromptBox);
        }
    }

    /**
     * Use a LoRA model (append to prompt)
     */
    useLora(name, strength) {
        let promptBox = document.getElementById('alt_prompt_textbox');
        if (!promptBox) return;

        let currentPrompt = promptBox.value;
        // Clean existing LoRA tag for this LoRA if present to avoid duplicates
        // Escape special chars in name just in case
        let escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Regex to find <lora:NAME:...> or <lora:NAME> case insensitive
        let regex = new RegExp(`<lora:${escapedName}(:[^>]+)?>`, 'gi');
        currentPrompt = currentPrompt.replace(regex, '');

        // Append new tag
        strength = strength !== undefined ? strength : 1.0;
        let tag = `<lora:${name}:${strength}>`;
        currentPrompt = (currentPrompt.trim() + ' ' + tag).trim();

        promptBox.value = currentPrompt;
        triggerChangeFor(promptBox);
    }

    /**
     * Set aspect ratio in Generate tab
     */
    setAspectRatio(ratio) {
        let aspectInput = document.getElementById('input_aspectratio');
        if (aspectInput) {
            aspectInput.value = ratio;
            triggerChangeFor(aspectInput);
        }
    }

    /**
     * Set generic parameter in Generate tab
     */
    setParam(name, value) {
        let input = document.getElementById('input_' + name);
        if (input) {
            input.value = value;
            triggerChangeFor(input);
        }
    }

    /**
     * Generate images using current Generate tab settings
     */
    async generateImages() {
        this.addTranscriptMessage('system', 'Generating image...');

        // Capture self to ensure proper context in callbacks
        const self = this;

        return new Promise((resolve, reject) => {
            // Use the main generation handler
            if (!mainGenHandler) {
                reject(new Error('Generation handler not available'));
                return;
            }

            // Track when generation completes
            let completedImages = [];
            let originalHandleData = mainGenHandler.internalHandleData;

            // Temporarily override the internal data handler to track progress
            mainGenHandler.internalHandleData = function (data, images, discardable, timeLastGenHit, actualInput, socketId, socket, isPreview) {
                // Call original handler first to ensure UI updates
                try {
                    originalHandleData.apply(this, arguments);
                } catch (e) {
                    console.error("Error in original handle data:", e);
                }

                // Check for completion (socket close intention)
                if ('socket_intention' in data && data.socket_intention == 'close') {
                    // Restore original handler
                    mainGenHandler.internalHandleData = originalHandleData;

                    // Resolve our promise
                    self.addTranscriptMessage('system', `Generated ${completedImages.length} image(s)`);
                    resolve(completedImages);
                }
                // Check for successful image result (not preview)
                else if (data.image && !isPreview) {
                    completedImages.push(data.image);
                }
            };

            // Trigger generation
            try {
                mainGenHandler.doGenerate();
            } catch (error) {
                mainGenHandler.internalHandleData = originalHandleData;
                reject(error);
            }
        });
    }

    /**
     * Capture final configuration
     */
    captureFinalConfig() {
        this.finalConfig = {
            positive: document.getElementById('alt_prompt_textbox')?.value || '',
            negative: document.getElementById('alt_negativeprompt_textbox')?.value || '',
            width: parseInt(document.getElementById('input_width')?.value) || 512,
            height: parseInt(document.getElementById('input_height')?.value) || 512
        };
    }

    /**
     * Apply final config to Generate tab (already applied during iteration)
     */
    applyToGenerateTab() {
        // Config is already applied during iteration
        // Just show confirmation
        this.addTranscriptMessage('system', 'Settings are already applied to the Generate tab!');
    }

    /**
     * Apply and trigger generation
     */
    async applyAndGenerate() {
        this.applyToGenerateTab();

        // Trigger generation
        if (mainGenHandler) {
            mainGenHandler.doGenerate();
        }
    }

    /**
     * Cancel running refinement
     */
    cancel() {
        if (this.status === 'running') {
            if (this.abortController) {
                this.abortController.abort();
            }
            this.status = 'idle';
            this.currentTurn = null;
            this.isQueueRunning = false; // Stop the queue!
            this.addTranscriptMessage('system', 'Refinement cancelled by user.');
            this.updateUI();
            this.renderQueue(); // Update queue UI to show cancelled state
        }
    }

    /**
     * Show thinking indicator
     */
    showThinking(turn) {
        let transcript = document.getElementById('agentic_imagen_transcript');
        if (!transcript) return;

        // Remove existing thinking bubble if any
        this.hideThinking();

        let thinkingDiv = document.createElement('div');
        thinkingDiv.id = 'agentic_imagen_thinking';
        thinkingDiv.className = 'agentic-imagen-message agentic-imagen-message-thinking';

        let label = turn === 'A' ? 'Prompt Engineer is thinking...' : 'Critic is reviewing...';

        thinkingDiv.innerHTML = `
            <div class="agentic-imagen-message-header">
                <span class="agentic-imagen-message-icon">🤔</span>
                <span class="agentic-imagen-message-label">${label}</span>
            </div>
            <div class="agentic-imagen-thinking-dots">
                <span style="animation-delay: 0s">.</span><span style="animation-delay: 0.2s">.</span><span style="animation-delay: 0.4s">.</span>
            </div>
        `;

        transcript.appendChild(thinkingDiv);
        transcript.scrollTop = transcript.scrollHeight;
    }

    /**
     * Hide thinking indicator
     */
    hideThinking() {
        let thinkingDiv = document.getElementById('agentic_imagen_thinking');
        if (thinkingDiv) {
            thinkingDiv.remove();
        }
    }

    /**
     * Add message to chat transcript
     */
    addTranscriptMessage(type, content) {
        let transcript = document.getElementById('agentic_imagen_transcript');
        if (!transcript) return;

        let messageDiv = document.createElement('div');
        messageDiv.className = 'agentic-imagen-message agentic-imagen-message-' + type;

        let typeLabel = {
            'system': 'System',
            'turn-a': 'Prompt Engineer',
            'turn-b': 'Critic',
            'tool': 'Tool Use',
            'error': 'Error',
            'user': 'User Feedback'
        }[type] || type;

        let icon = {
            'system': '⚙️',
            'turn-a': '🎨',
            'turn-b': '🧐',
            'tool': '🛠️',
            'error': '❌',
            'user': '👤'
        }[type] || '💬';

        // Handle tool calls specially
        if (type === 'tool') {
            let match = content.match(/^Tool: (\w+)\((.*)?\)$/s);
            if (match) {
                let toolName = match[1];
                let toolArgs = match[2] || '';

                messageDiv.innerHTML = `
                    <div class="agentic-imagen-message-header">
                        <span class="agentic-imagen-message-icon">${icon}</span>
                        <span class="agentic-imagen-message-label">${typeLabel}</span>
                        <span class="agentic-imagen-message-time">${new Date().toLocaleTimeString()}</span>
                    </div>
                    <details class="agentic-imagen-tool-details">
                        <summary>Used tool: <strong>${escapeHtml(toolName)}</strong></summary>
                        <div class="agentic-imagen-tool-args"><code>${escapeHtml(toolArgs)}</code></div>
                    </details>
                `;
            } else {
                messageDiv.innerHTML = `
                    <div class="agentic-imagen-message-header">
                        <span class="agentic-imagen-message-icon">${icon}</span>
                        <span class="agentic-imagen-message-label">${typeLabel}</span>
                        <span class="agentic-imagen-message-time">${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div class="agentic-imagen-message-content">${escapeHtml(content)}</div>
                `;
            }
        } else {
            // Regular messages
            messageDiv.innerHTML = `
                <div class="agentic-imagen-message-header">
                    <span class="agentic-imagen-message-icon">${icon}</span>
                    <span class="agentic-imagen-message-label">${typeLabel}</span>
                    <span class="agentic-imagen-message-time">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="agentic-imagen-message-content">${escapeHtml(content)}</div>
            `;
        }

        transcript.appendChild(messageDiv);

        // Only auto-scroll if user is at bottom (allows reading while running)
        let isAtBottom = (transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight) < 50;
        if (isAtBottom || type === 'system') {
            transcript.scrollTop = transcript.scrollHeight;
        }
    }

    /**
     * Clear chat transcript
     */
    clearTranscript() {
        let transcript = document.getElementById('agentic_imagen_transcript');
        if (transcript) {
            transcript.innerHTML = '';
        }
    }

    /**
     * Update UI based on current state
     */
    updateUI() {
        let statusText = document.getElementById('agentic_imagen_status_text');
        let progressText = document.getElementById('agentic_imagen_progress_text');
        let startBtn = document.getElementById('agentic_imagen_start_btn');
        let cancelBtn = document.getElementById('agentic_imagen_cancel_btn');
        let applyBtn = document.getElementById('agentic_imagen_apply_btn');
        let applyGenBtn = document.getElementById('agentic_imagen_apply_gen_btn');
        let configSection = document.getElementById('agentic_imagen_config_section');
        let resultsSection = document.getElementById('agentic_imagen_results_section');
        let userInputSection = document.getElementById('agentic_imagen_user_input_section');

        // Always keep config section visible so users easier queue up next jobs/fix settings
        if (configSection) configSection.style.display = 'block';

        if (this.status === 'idle') {
            if (statusText) statusText.textContent = 'Ready to start';
            if (progressText) progressText.textContent = '';
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (applyBtn) applyBtn.style.display = 'none';
            if (applyGenBtn) applyGenBtn.style.display = 'none';
            if (resultsSection) resultsSection.style.display = 'none';
            if (userInputSection) userInputSection.style.display = 'block';
        } else if (this.status === 'running') {
            let turnText = this.currentTurn === 'A' ? 'Turn A thinking' :
                this.currentTurn === 'B' ? 'Turn B reviewing' : 'Processing';
            if (statusText) statusText.textContent = 'Running';
            if (progressText) progressText.textContent = `Iteration ${this.currentIteration} / ${this.maxIterations} - ${turnText}`;
            if (startBtn) startBtn.disabled = true;
            if (cancelBtn) cancelBtn.style.display = 'inline-block';
            if (applyBtn) applyBtn.style.display = 'none';
            if (applyGenBtn) applyGenBtn.style.display = 'none';
            if (userInputSection) userInputSection.style.display = 'block';
        } else if (this.status === 'completed') {
            if (statusText) statusText.textContent = 'Completed';
            if (progressText) progressText.textContent = `Finished after ${this.currentIteration} iterations`;
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (applyBtn) applyBtn.style.display = 'inline-block';
            if (applyGenBtn) applyGenBtn.style.display = 'inline-block';
            if (resultsSection) resultsSection.style.display = 'block';
            if (userInputSection) userInputSection.style.display = 'block';
            this.displayResults();
        } else if (this.status === 'error') {
            if (statusText) statusText.textContent = 'Error';
            if (progressText) progressText.textContent = '';
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (userInputSection) userInputSection.style.display = 'block';
        }
    }

    /**
     * Display final results
     */
    displayResults() {
        let resultsDiv = document.getElementById('agentic_imagen_results_content');
        if (!resultsDiv || !this.finalConfig) return;

        resultsDiv.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>Final Positive Prompt:</strong><br>
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; margin-top: 4px;">${escapeHtml(this.finalConfig.positive)}</div>
            </div>
            <div style="margin-bottom: 10px;">
                <strong>Final Negative Prompt:</strong><br>
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; margin-top: 4px;">${escapeHtml(this.finalConfig.negative || '(empty)')}</div>
            </div>
            <div style="margin-bottom: 10px;">
                <strong>Resolution:</strong> ${this.finalConfig.width} x ${this.finalConfig.height}
            </div>
        `;
    }

    /**
     * Show error message
     */
    showError(message, options = {}) {
        let errorDiv = document.getElementById('agentic_imagen_error');
        if (!errorDiv) return;

        errorDiv.innerHTML = message;
        errorDiv.style.display = 'block';

        // Auto-hide unless keepVisible is true
        if (!options.keepVisible) {
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, AgenticImagen.ERROR_DISPLAY_TIMEOUT_MS);
        }
    }

    /**
     * Hide error message
     */
    hideError() {
        let errorDiv = document.getElementById('agentic_imagen_error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    /**
     * Reset Agentic Imagen state
     */
    reset(full = false) {
        if (this.status === 'running') {
            this.cancel();
        }

        this.status = 'idle';
        this.iterations = [];
        this.currentIteration = 0;
        this.finalConfig = null;
        this.currentTurn = null;

        // Full reset clears everything
        if (full) {
            this.queue = [];
            this.isQueueRunning = false;
            this.targetImage = null;
            this.tags = '';
            this.turnAModel = null;
            this.turnBModel = null;
            this.saveQueue();

            // Clear image inputs
            let fileInput = document.getElementById('agentic_imagen_image_upload');
            let urlInput = document.getElementById('agentic_imagen_image_url');
            let tagsInput = document.getElementById('agentic_imagen_tags');
            if (fileInput) fileInput.value = '';
            if (urlInput) urlInput.value = '';
            if (tagsInput) tagsInput.value = '';

            this.updateImagePreview();
            this.renderQueue();
        }

        // Do not clear pendingUserFeedback here, as user might have just typed it

        // Clear UI
        this.clearTranscript();

        let resultsDiv = document.getElementById('agentic_imagen_results_content');
        if (resultsDiv) resultsDiv.innerHTML = '';

        // Do not clear feedback input here

        this.updateUI();
        this.hideError();
        this.addTranscriptMessage('system', 'Session reset. Ready to start new refinement.');
    }

    /**
     * Send user feedback
     */
    sendUserFeedback() {
        let input = document.getElementById('agentic_imagen_user_feedback');
        if (!input || !input.value.trim()) return;

        let feedback = input.value.trim();
        this.pendingUserFeedback = feedback;

        this.addTranscriptMessage('user', feedback);
        input.value = '';

        // If idle or completed, start the process immediately
        if (this.status === 'idle' || this.status === 'completed' || this.status === 'error') {
            // Check if we can start (we need a target image and models)
            if (this.targetImage && document.getElementById('agentic_imagen_turn_a_model')?.value && document.getElementById('agentic_imagen_turn_b_model')?.value) {
                this.startRefinement(true);
            } else {
                this.addTranscriptMessage('system', 'Feedback queued. Please configure Target Image and Models then click Start.');
            }
        } else {
            this.addTranscriptMessage('system', 'Feedback queued for next iteration.');
        }
    }

    /**
     * Handle mode change
     */
    handleModeChange() {
        let modeSelect = document.getElementById('agentic_imagen_mode');
        if (modeSelect) {
            this.mode = modeSelect.value;
        }
    }

    /**
     * Add current configuration to queue
     */
    addToQueue() {
        if (!this.targetImage) {
            this.showError('Please provide a target image.');
            return;
        }

        let turnASelect = document.getElementById('agentic_imagen_turn_a_model');
        let turnBSelect = document.getElementById('agentic_imagen_turn_b_model');
        let tagsInput = document.getElementById('agentic_imagen_tags');
        let maxIterInput = document.getElementById('agentic_imagen_max_iterations');

        let turnAModel = turnASelect?.value;
        let turnBModel = turnBSelect?.value;
        let tags = tagsInput?.value.trim() || '';
        let maxIterations = parseInt(maxIterInput?.value) || 5;

        if (!turnAModel || !turnBModel) {
            this.showError('Please select models for both Turn A and Turn B.');
            return;
        }

        let job = {
            id: Date.now(),
            targetImage: this.targetImage,
            tags: tags,
            turnAModel: turnAModel,
            turnBModel: turnBModel,
            maxIterations: maxIterations,
            mode: this.mode,
            status: 'pending', // pending, running, completed, error
            result: null
        };

        this.queue.push(job);
        this.saveQueue();
        this.renderQueue();

        // Visual feedback
        let addBtn = document.getElementById('agentic_imagen_add_queue_btn');
        if (addBtn) {
            let originalText = addBtn.textContent;
            addBtn.textContent = 'Added!';
            setTimeout(() => addBtn.textContent = originalText, 1000);
        }
    }

    /**
     * Save queue to localStorage
     */
    saveQueue() {
        try {
            localStorage.setItem('agentic_imagen_queue', JSON.stringify(this.queue));
        } catch (e) {
            console.error('Failed to save queue to localStorage:', e);
        }
    }

    /**
     * Clear the queue
     */
    clearQueue(force = false) {
        if (this.isQueueRunning && !force) {
            this.showError('Cannot clear queue while it is running. <br><button onclick="agenticImagen.clearQueue(true)" class="btn btn-danger btn-sm mt-2">Force Clear</button>', { keepVisible: true });
            return;
        }
        this.queue = [];
        this.isQueueRunning = false; // Always reset running state
        this.saveQueue();
        this.renderQueue();
        this.hideError(); // Clear any error messages
    }

    /**
     * Render the queue list
     */
    /**
     * Render the queue list
     */
    renderQueue() {
        let listContainer = document.getElementById('agentic_imagen_queue_list');
        let countLabel = document.getElementById('agentic_imagen_queue_count');
        if (!listContainer) return;

        if (countLabel) countLabel.textContent = `${this.queue.length} items`;

        if (this.queue.length === 0) {
            listContainer.innerHTML = '<div style="color: #888; font-style: italic; text-align: center; padding: 10px;" class="translate">Queue is empty</div>';
            return;
        }

        listContainer.innerHTML = '';

        let activeItemElement = null;

        this.queue.forEach((job, index) => {
            let item = document.createElement('div');
            item.className = 'agentic-imagen-queue-item';

            // Base style
            item.style.borderBottom = '1px solid #444';
            item.style.padding = '5px';
            item.style.marginTop = '5px';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '8px';

            // Dynamic style based on status
            if (job.status === 'running') {
                item.style.backgroundColor = 'rgba(0, 100, 0, 0.4)';
                item.style.borderLeft = '4px solid #4CAF50';
                activeItemElement = item;
            } else if (job.status === 'completed') {
                item.style.opacity = '0.8';
            } else if (job.status === 'error') {
                item.style.borderLeft = '4px solid #F44336';
            } else {
                item.style.backgroundColor = 'transparent';
                item.style.borderLeft = '4px solid transparent';
            }

            let statusIcon = job.status === 'completed' ? '✅' : job.status === 'error' ? '❌' : job.status === 'running' ? '▶️' : '⏳';
            let modeIcon = job.mode === 'simplify' ? '📉' : job.mode === 'variation' ? '🎨' : '🎯';

            let buttons = '';

            // Remove button
            if (!(this.isQueueRunning && job.status === 'running')) {
                buttons += `<button class="btn btn-sm btn-danger basic-button" onclick="agenticImagen.removeFromQueue(${index})" title="Remove">🗑️</button>`;
            }

            // Actions for all items (if they have a result OR are pending/running)
            // We allow queuing a simplify/variation on a pending job -> it becomes a dependent job

            // "Redo" is only for completed/error
            if (job.status === 'completed' || job.status === 'error') {
                buttons = `<button class="btn btn-sm btn-secondary basic-button" onclick="agenticImagen.redoQueueItem(${index})" title="Redo/Retry" style="margin-right: 5px;">↻</button>` + buttons;
            }

            // "Chain" (Simplify/Variation)
            let canChain = job.status === 'pending' || job.status === 'running' || (job.status === 'completed' && job.result && job.result.image);

            if (canChain) {
                buttons = `
                    <button class="btn btn-sm btn-info basic-button" onclick="agenticImagen.simplifyQueueItem(${index})" title="Simplify this result (or queue it)" style="margin-right: 5px;">📉</button>
                    <button class="btn btn-sm btn-primary basic-button" onclick="agenticImagen.variationQueueItem(${index})" title="Make variations of this result (or queue it)" style="margin-right: 5px;">🎨</button>
                    ${buttons}
                `;
            }

            let tagsDisplay = escapeHtml(job.tags || 'Untitled');
            if (job.parentJobId) {
                let parentIdx = this.queue.findIndex(j => j.id === job.parentJobId);
                let parentRef = parentIdx >= 0 ? `#${parentIdx + 1}` : 'Unknown';
                tagsDisplay = `<span style="opacity: 0.7; font-size: 0.9em;">(Wait ${parentRef})</span> ` + tagsDisplay;
            }

            // Thumbnail
            let thumbnailHtml = '';
            if (job.targetImage && (job.targetImage.dataUrl || job.targetImage.src)) {
                let src = job.targetImage.dataUrl || job.targetImage.src;
                thumbnailHtml = `<div style="width: 40px; height: 40px; min-width: 40px; background-color: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 3px;">
                    <img src="${src}" style="max-width: 100%; max-height: 100%; object-fit: cover;" onerror="this.style.display='none'">
                </div>`;
            } else {
                thumbnailHtml = `<div style="width: 40px; height: 40px; min-width: 40px; background-color: #333; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 20px;">❓</div>`;
            }

            item.innerHTML = `
                ${thumbnailHtml}
                <div style="flex-grow: 1; overflow: hidden;">
                    <div style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(job.tags)}">
                        ${statusIcon} ${modeIcon} ${tagsDisplay}
                    </div>
                    <div style="font-size: 0.75em; color: #aaa;">
                        ${job.mode} | Iters: ${job.maxIterations}
                    </div>
                </div>
                <div style="white-space: nowrap;">
                    ${buttons}
                </div>
            `;
            listContainer.appendChild(item);
        });

        // Auto-scroll to active item if running
        if (activeItemElement && this.isQueueRunning) {
            activeItemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Redo/Retry a queue item
     */
    redoQueueItem(index) {
        let job = this.queue[index];
        if (!job) return;

        // Clone the job
        let newJob = { ...job };
        newJob.id = Date.now();
        newJob.status = 'pending';
        newJob.result = null;
        newJob.error = null;

        this.queue.push(newJob);
        this.renderQueue();

        // Auto-start if not running
        if (!this.isQueueRunning) {
            this.processQueue();
        }
    }

    /**
     * Create a Simplify task from a completed job
     */
    simplifyQueueItem(index) {
        this.reuseJob(index, 'simplify');
    }

    /**
     * Create a Variation task from a completed job
     */
    variationQueueItem(index) {
        this.reuseJob(index, 'variation');
    }

    /**
     * Reuse a job result for a new task
     */
    reuseJob(index, newMode) {
        let job = this.queue[index];
        if (!job) return;

        let newJob = {
            id: Date.now(),
            turnAModel: job.turnAModel,
            turnBModel: job.turnBModel,
            maxIterations: job.maxIterations,
            mode: newMode,
            status: 'pending',
            result: null
        };

        // If job is already completed and has a result, use it immediately (Snapshot)
        if (job.status === 'completed' && job.result && job.result.image) {
            newJob.targetImage = {
                type: 'url',
                src: job.result.image,
                dataUrl: job.result.image
            };
            newJob.tags = job.result.positive;

            // Check for valid image src
            if (!newJob.targetImage.src.startsWith('data:') && !newJob.targetImage.src.startsWith('http')) {
                // Assume logic handles relative paths
            }
        }
        else {
            // Dependent Job
            newJob.parentJobId = job.id;
            newJob.tags = `(Dependent on '${job.tags || 'Untitled'}')`;
        }

        this.queue.push(newJob);
        this.renderQueue();

        // User requested to NOT auto-start these, so they can queue up multiple or manage them first.
        // if (!this.isQueueRunning) {
        //    this.processQueue();
        // }

        // Provide visual confirmation (optional but nice since we aren't starting)
        this.addTranscriptMessage('system', `Added '${newMode}' task to queue.`);
    }

    /**
     * Remove item from queue
     */
    removeFromQueue(index) {
        if (this.isQueueRunning) return;
        this.queue.splice(index, 1);
        this.renderQueue();
    }

    /**
     * Start refinement logic (single or queue)
     */
    async startRefinementOrQueue() {
        if (this.queue.length > 0) {
            await this.processQueue();
        } else {
            // Run as single temporary job
            // Validate inputs
            if (!this.targetImage) {
                this.showError('Please provide a target image.');
                return;
            }

            let turnASelect = document.getElementById('agentic_imagen_turn_a_model');
            let turnBSelect = document.getElementById('agentic_imagen_turn_b_model');
            let tagsInput = document.getElementById('agentic_imagen_tags');
            let maxIterInput = document.getElementById('agentic_imagen_max_iterations');

            if (!turnASelect?.value || !turnBSelect?.value) {
                this.showError('Please select models for both Turn A and Turn B.');
                return;
            }

            let job = {
                id: Date.now(),
                targetImage: this.targetImage,
                tags: tagsInput?.value.trim() || '',
                turnAModel: turnASelect.value,
                turnBModel: turnBSelect.value,
                maxIterations: parseInt(maxIterInput?.value) || 5,
                mode: this.mode || 'match',
                status: 'pending'
            };

            // Run single job
            this.status = 'running';
            this.updateUI();

            try {
                await this.executeRefinementJob(job);
            } catch (e) {
                console.error("Single job failed", e);
                // Always reset state on error to prevent stuck buttons
                this.status = 'idle';
                this.isQueueRunning = false;
                this.updateUI();
            }
        }
    }

    /**
     * Process the queue
     */
    async processQueue() {
        if (this.isQueueRunning) return;
        this.isQueueRunning = true;
        this.status = 'idle'; // Reset overall status first
        this.updateUI();

        for (let i = 0; i < this.queue.length; i++) {
            // Re-check running state at start of each iteration
            if (!this.isQueueRunning) break;

            let job = this.queue[i];
            if (job.status === 'completed' || job.status === 'error') continue;

            // Set global status to running for this job
            this.status = 'running';
            job.status = 'running';
            this.renderQueue();

            this.addTranscriptMessage('system', `--> Starting Queue Item ${i + 1}/${this.queue.length}: ${job.mode} "${job.tags}"`);

            try {
                // We do NOT call applyJobToUI anymore to avoid flickering the config area
                // The job runs based on its internal properties

                await this.executeRefinementJob(job);

                // If we get here without error, it succeeded
                job.status = 'completed';
                job.result = this.finalConfig;

            } catch (error) {
                // Check if it was an abort
                if (this.abortController && this.abortController.signal.aborted) {
                    this.addTranscriptMessage('system', 'Job aborted.');
                    job.status = 'pending'; // Reset to pending if aborted so can be retried? Or 'error'?
                    // If user clicked cancel, we want to stop EVERYTHING.
                    this.isQueueRunning = false;
                    break;
                }

                console.error(`Queue item ${i} failed:`, error);
                job.status = 'error';
                job.error = error.message;
                this.addTranscriptMessage('error', `Queue item failed: ${error.message}`);
            }

            // Save queue state after each job
            this.saveQueue();
            this.renderQueue();
        }

        this.isQueueRunning = false;

        // If we finished (didn't abort), set status to completed
        if (this.status === 'running') {
            this.status = 'completed';
        }

        this.updateUI();
        this.addTranscriptMessage('system', 'Queue processing finished.');
    }

    /**
     * Apply job settings to UI (helper for queue execution)
     */
    applyJobToUI(job) {
        // Models
        let turnASelect = document.getElementById('agentic_imagen_turn_a_model');
        let turnBSelect = document.getElementById('agentic_imagen_turn_b_model');
        if (turnASelect) turnASelect.value = job.turnAModel;
        if (turnBSelect) turnBSelect.value = job.turnBModel;

        // Tags
        let tagsInput = document.getElementById('agentic_imagen_tags');
        if (tagsInput) tagsInput.value = job.tags;

        // Image
        this.targetImage = job.targetImage;
        this.updateImagePreview();

        // Mode
        this.mode = job.mode;
        let modeSelect = document.getElementById('agentic_imagen_mode');
        if (modeSelect) modeSelect.value = job.mode;
    }
}

// Global instance
let agenticImagen = new AgenticImagen();
