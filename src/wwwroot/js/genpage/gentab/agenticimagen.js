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

        this.pendingUserFeedback = null;
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
        
        // Load available models from OpenRouter
        try {
            let data = await new Promise((resolve, reject) => {
                genericRequest('GetOpenRouterModels', {}, resolve, 0, reject);
            });
            
            if (data.error) {
                console.error('OpenRouter API error:', data.error);
                return;
            }

            this.models = data.models || [];
            this.populateModelDropdowns();
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
        
        this.position.x = this.dragState.initialX + deltaX;
        this.position.y = this.dragState.initialY + deltaY;
        
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
     * Start the agentic refinement process
     */
    async startRefinement() {
        // Validate inputs
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

        if (!this.turnAModel || !this.turnBModel) {
            this.showError('Please select models for both Turn A and Turn B.');
            return;
        }

        // Safety cap
        this.maxIterations = Math.min(Math.max(1, this.maxIterations), 20);

        // Reset state
        this.status = 'running';
        this.iterations = [];
        this.currentIteration = 0;
        this.finalConfig = null;
        this.abortController = new AbortController();

        this.updateUI();
        this.clearTranscript();
        this.addTranscriptMessage('system', 'Starting Agentic Imagen refinement...');
        
        // If there was pending feedback, log it
        if (this.pendingUserFeedback) {
            this.addTranscriptMessage('user', this.pendingUserFeedback);
        }

        try {
            await this.runIterationLoop();
        } catch (error) {
            console.error('Error in refinement loop:', error);
            this.showError('Refinement failed: ' + (error.message || error));
            this.status = 'error';
            this.updateUI();
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
                this.addTranscriptMessage('system', 'Turn B decided the refinement is complete!');
                break;
            }
        }

        // Finalize
        this.status = 'completed';
        this.currentTurn = null;
        this.captureFinalConfig();
        this.updateUI();
        this.addTranscriptMessage('system', 'Refinement complete! Review the results below.');
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
            return new Promise((resolve, reject) => {
                let reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
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
        return `You are an expert AI image generation prompt engineer. Your role is to iteratively refine prompts and parameters to match a target image.

Available tools:
- set_positive_prompt(text): Set the positive prompt for image generation
- set_negative_prompt(text): Set the negative prompt
- set_aspect_ratio(ratio): Set the aspect ratio for the image (options: 1:1, 4:3, 3:2, 8:5, 16:9, 21:9, 3:4, 2:3, 5:8, 9:16, 9:21)
- set_param(name, value): Set other parameters like steps, CFG, sampler
- generate_image(): Trigger an image generation with current settings

Guidelines:
1. Make modest, purposeful changes each iteration - avoid changing everything at once
2. Use clear, descriptive tags in Danbooru/image-board style
3. Include quality tags and composition details
4. Be specific about subjects, lighting, and mood
5. After making changes, call generate_image() to test them

Your goal is to match the target image as closely as possible through iterative refinement.`;
    }

    /**
     * Get default Turn B system prompt (fallback)
     */
    getDefaultTurnBPrompt() {
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
            // Note: We don't have trigger words readily available in the simple list.
            // If we did, we'd append them here.
            return `- ${lora}: <lora:${lora}:1.0>`;
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
        
        // Add shared knowledge if enabled
        if (getUserSetting('sharedknowledge.enablesharedknowledge', false)) {
            let knowledgeText = getUserSetting('sharedknowledge.knowledgetext', '');
            if (knowledgeText.trim()) {
                prompt += '\n\n**Shared Knowledge:**\n' + knowledgeText.trim();
            }
        }

        // Add LoRA knowledge if enabled
        let enableLoras = document.getElementById('agentic_imagen_enable_loras')?.checked;
        if (enableLoras) {
            let loraList = this.getLoraListForPrompt();
            if (loraList) {
                prompt += `\n\n**Available LoRAs:**\nYou can use the following LoRAs by adding the syntax <lora:name:strength> to the prompt. Strength is usually between 0.5 and 1.0.\n${loraList}`;
            }
        }
        
        return prompt;
    }

    /**
     * Build Turn A user message
     */
    buildTurnAUserMessage() {
        let message = `Target image and tags: ${this.tags || 'No tags provided'}\n\n`;
        
        if (this.iterations.length > 0) {
            let lastIter = this.iterations[this.iterations.length - 1];
            message += `Previous iteration feedback from Turn B:\n${lastIter.turnB.content}\n\n`;
        }

        if (this.pendingUserFeedback) {
            message += `USER FEEDBACK / GUIDANCE: ${this.pendingUserFeedback}\n\n`;
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

        let message = `Target image tags: ${this.tags || 'No tags provided'}\n\n`;
        message += `Current settings:\n`;
        message += `- Positive prompt: ${currentPrompt}\n`;
        message += `- Negative prompt: ${currentNegPrompt}\n`;
        message += `- Resolution: ${width}x${height}\n\n`;

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
            mainGenHandler.internalHandleData = function(data, images, discardable, timeLastGenHit, actualInput, socketId, socket, isPreview) {
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
        if (this.status === 'running' && this.abortController) {
            this.abortController.abort();
            this.status = 'idle';
            this.currentTurn = null;
            this.addTranscriptMessage('system', 'Refinement cancelled by user.');
            this.updateUI();
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
            let match = content.match(/^Tool: (\w+)\((.*)\)$/s);
            if (match) {
                let toolName = match[1];
                let toolArgs = match[2];
                
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
        transcript.scrollTop = transcript.scrollHeight;
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

        if (this.status === 'idle') {
            if (statusText) statusText.textContent = 'Ready to start';
            if (progressText) progressText.textContent = '';
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (applyBtn) applyBtn.style.display = 'none';
            if (applyGenBtn) applyGenBtn.style.display = 'none';
            if (configSection) configSection.style.display = 'block';
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
            if (configSection) configSection.style.display = 'none';
            if (userInputSection) userInputSection.style.display = 'block';
        } else if (this.status === 'completed') {
            if (statusText) statusText.textContent = 'Completed';
            if (progressText) progressText.textContent = `Finished after ${this.currentIteration} iterations`;
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (applyBtn) applyBtn.style.display = 'inline-block';
            if (applyGenBtn) applyGenBtn.style.display = 'inline-block';
            if (configSection) configSection.style.display = 'none';
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
    showError(message) {
        let errorDiv = document.getElementById('agentic_imagen_error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, AgenticImagen.ERROR_DISPLAY_TIMEOUT_MS);
        }
    }

    /**
     * Reset the Agentic Imagen state
     */
    reset() {
        if (this.status === 'running') {
            this.cancel();
        }

        this.status = 'idle';
        this.iterations = [];
        this.currentIteration = 0;
        this.finalConfig = null;
        this.currentTurn = null;
        // Do not clear pendingUserFeedback here, as user might have just typed it
        
        // Clear UI
        this.clearTranscript();
        
        let resultsDiv = document.getElementById('agentic_imagen_results_content');
        if (resultsDiv) resultsDiv.innerHTML = '';
        
        let feedbackInput = document.getElementById('agentic_imagen_user_feedback');
        // Do not clear feedback input here
        
        this.updateUI();
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
        
        // If idle, maybe we should start? For now just queue it.
        if (this.status === 'idle') {
            this.addTranscriptMessage('system', 'Feedback queued for next run.');
        } else if (this.status === 'completed') {
            this.addTranscriptMessage('system', 'Feedback queued. Click "Start Agentic Refinement" to begin a new session with this feedback.');
        } else {
            this.addTranscriptMessage('system', 'Feedback queued for next iteration.');
        }
    }
}

// Global instance
let agenticImagen = new AgenticImagen();
