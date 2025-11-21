/** 
 * Agentic Imagen - Image-guided, two-agent LLM orchestration for iterative prompt refinement
 */
class AgenticImagen {
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
        
        // UI state
        this.isVisible = false;
        this.isMinimized = false;
        this.dragState = null;
        
        // Widget position
        this.position = { x: 100, y: 100 };
        this.size = { width: 600, height: 700 };
    }

    /**
     * Initialize the Agentic Imagen feature
     */
    async init() {
        console.log('Initializing Agentic Imagen...');
        
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

        document.addEventListener('mousemove', this.onDrag.bind(this));
        document.addEventListener('mouseup', this.stopDrag.bind(this));
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
        document.removeEventListener('mousemove', this.onDrag.bind(this));
        document.removeEventListener('mouseup', this.stopDrag.bind(this));
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

        try {
            await this.runIterationLoop();
        } catch (error) {
            console.error('Error in refinement loop:', error);
            this.showError('Refinement failed: ' + error.message);
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
            
            try {
                iteration.turnA = await this.executeTurnA();
            } catch (error) {
                this.addTranscriptMessage('error', `Turn A failed: ${error.message}`);
                throw error;
            }

            // Generate image if Turn A made changes
            if (iteration.turnA.toolCalls && iteration.turnA.toolCalls.length > 0) {
                let hasGenerate = iteration.turnA.toolCalls.some(tc => tc.name === 'generate_image');
                if (hasGenerate) {
                    try {
                        iteration.generatedImages = await this.generateImages();
                    } catch (error) {
                        this.addTranscriptMessage('error', `Image generation failed: ${error.message}`);
                        throw error;
                    }
                }
            }

            // Turn B: Critic
            this.currentTurn = 'B';
            this.updateUI();
            
            try {
                iteration.turnB = await this.executeTurnB(iteration.generatedImages);
                iteration.decision = iteration.turnB.decision;
            } catch (error) {
                this.addTranscriptMessage('error', `Turn B failed: ${error.message}`);
                throw error;
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
        this.addTranscriptMessage('turn-a', 'Turn A: Analyzing target and crafting prompts...');

        let systemPrompt = this.buildTurnASystemPrompt();
        let userMessage = this.buildTurnAUserMessage();

        let response = await this.callLLMWithTools(
            this.turnAModel,
            systemPrompt,
            userMessage,
            this.getTurnATools()
        );

        this.addTranscriptMessage('turn-a', `Turn A: ${response.content}`);
        
        if (response.toolCalls && response.toolCalls.length > 0) {
            for (let toolCall of response.toolCalls) {
                this.addTranscriptMessage('tool', `Tool: ${toolCall.name}(${JSON.stringify(toolCall.arguments).substring(0, 100)}...)`);
                await this.executeToolCall(toolCall);
            }
        }

        return {
            content: response.content,
            toolCalls: response.toolCalls || []
        };
    }

    /**
     * Execute Turn B (Critic)
     */
    async executeTurnB(generatedImages) {
        this.addTranscriptMessage('turn-b', 'Turn B: Evaluating generated images...');

        let systemPrompt = this.buildTurnBSystemPrompt();
        let userMessage = this.buildTurnBUserMessage(generatedImages);

        let response = await this.callLLM(
            this.turnBModel,
            systemPrompt,
            userMessage
        );

        this.addTranscriptMessage('turn-b', `Turn B: ${response.content}`);

        // Parse decision
        let decision = this.parseTurnBDecision(response.content);

        return {
            content: response.content,
            decision: decision
        };
    }

    /**
     * Build Turn A system prompt
     */
    buildTurnASystemPrompt() {
        return `You are an expert AI image generation prompt engineer. Your role is to iteratively refine prompts and parameters to match a target image.

Available tools:
- set_positive_prompt(text): Set the positive prompt for image generation
- set_negative_prompt(text): Set the negative prompt
- set_resolution(width, height): Set output resolution
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
     * Build Turn A user message
     */
    buildTurnAUserMessage() {
        let message = `Target image and tags: ${this.tags || 'No tags provided'}\n\n`;
        
        if (this.iterations.length > 0) {
            let lastIter = this.iterations[this.iterations.length - 1];
            message += `Previous iteration feedback from Turn B:\n${lastIter.turnB.content}\n\n`;
        }

        message += 'Please analyze the target image and provide your next refinement step.';
        
        return message;
    }

    /**
     * Build Turn B system prompt
     */
    buildTurnBSystemPrompt() {
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
                name: 'set_resolution',
                description: 'Set output resolution (width and height)',
                parameters: {
                    type: 'object',
                    properties: {
                        width: { type: 'number', description: 'Width in pixels' },
                        height: { type: 'number', description: 'Height in pixels' }
                    },
                    required: ['width', 'height']
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
        // This is a simplified version - actual implementation will use OpenRouter API
        // For now, return mock data
        console.log('Calling LLM with tools:', { modelId, systemPrompt, userMessage, tools });
        
        // TODO: Implement actual OpenRouter API call with function calling
        return {
            content: 'Mock Turn A response',
            toolCalls: []
        };
    }

    /**
     * Call LLM without tools
     */
    async callLLM(modelId, systemPrompt, userMessage) {
        // This is a simplified version
        console.log('Calling LLM:', { modelId, systemPrompt, userMessage });
        
        // TODO: Implement actual OpenRouter API call
        return {
            content: 'DECISION: CONTINUE\n\nMock Turn B feedback'
        };
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
            case 'set_resolution':
                this.setResolution(args.width, args.height);
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
     * Set resolution in Generate tab
     */
    setResolution(width, height) {
        let widthInput = document.getElementById('input_width');
        let heightInput = document.getElementById('input_height');
        
        if (widthInput) {
            widthInput.value = Math.max(64, Math.min(2048, width));
            triggerChangeFor(widthInput);
        }
        if (heightInput) {
            heightInput.value = Math.max(64, Math.min(2048, height));
            triggerChangeFor(heightInput);
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
        
        // TODO: Implement actual image generation
        // For now, return empty array
        return [];
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
     * Add message to chat transcript
     */
    addTranscriptMessage(type, content) {
        let transcript = document.getElementById('agentic_imagen_transcript');
        if (!transcript) return;

        let messageDiv = document.createElement('div');
        messageDiv.className = 'agentic-imagen-message agentic-imagen-message-' + type;
        
        let typeLabel = {
            'system': 'System',
            'turn-a': 'Turn A (Prompt Engineer)',
            'turn-b': 'Turn B (Critic)',
            'tool': 'Tool Call',
            'error': 'Error'
        }[type] || type;

        messageDiv.innerHTML = `
            <div class="agentic-imagen-message-label">${typeLabel}</div>
            <div class="agentic-imagen-message-content">${escapeHtml(content)}</div>
        `;

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

        if (this.status === 'idle') {
            if (statusText) statusText.textContent = 'Ready to start';
            if (progressText) progressText.textContent = '';
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (applyBtn) applyBtn.style.display = 'none';
            if (applyGenBtn) applyGenBtn.style.display = 'none';
            if (configSection) configSection.style.display = 'block';
            if (resultsSection) resultsSection.style.display = 'none';
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
        } else if (this.status === 'completed') {
            if (statusText) statusText.textContent = 'Completed';
            if (progressText) progressText.textContent = `Finished after ${this.currentIteration} iterations`;
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (applyBtn) applyBtn.style.display = 'inline-block';
            if (applyGenBtn) applyGenBtn.style.display = 'inline-block';
            if (configSection) configSection.style.display = 'none';
            if (resultsSection) resultsSection.style.display = 'block';
            this.displayResults();
        } else if (this.status === 'error') {
            if (statusText) statusText.textContent = 'Error';
            if (progressText) progressText.textContent = '';
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
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
            }, 5000);
        }
    }
}

// Global instance
let agenticImagen = new AgenticImagen();
