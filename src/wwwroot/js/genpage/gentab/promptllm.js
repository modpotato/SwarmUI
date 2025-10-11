
/** Handler for Prompt LLM feature - includes refinement, generation, and blending capabilities. */
class PromptLLM {
    constructor() {
        this.models = [];
        this.currentSource = null;
        this.currentSourceType = null;
        this.refinedPrompt = null;
        this.currentMode = 'refine'; // refine, generate, or blend
        this.generatedPrompt = null;
        this.blendedPrompt = null;
        this.loraMetadata = null; // Will store available LoRAs and their trigger words
    }

    /**
     * Get the current active tab mode
     */
    getCurrentMode() {
        if (document.getElementById('refine-panel')?.classList.contains('active')) {
            return 'refine';
        }
        if (document.getElementById('generate-panel')?.classList.contains('active')) {
            return 'generate';
        }
        if (document.getElementById('blend-panel')?.classList.contains('active')) {
            return 'blend';
        }
        return 'refine';
    }

    /**
     * Fetch LoRA metadata for system prompt enhancement
     */
    async fetchLoraMetadata() {
        try {
            // Get available LoRAs from the backend
            let data = await new Promise((resolve, reject) => {
                genericRequest('ListT2IParams', {}, resolve, 0, reject);
            });
            
            if (data && data.list) {
                // Find LoRA parameters
                let loraParam = data.list.find(p => p.id === 'loras');
                if (loraParam && loraParam.values) {
                    this.loraMetadata = [];
                    for (let lora of loraParam.values) {
                        let metadata = {
                            name: lora,
                            triggerWords: null
                        };
                        // Try to fetch trigger words for this LoRA if available
                        // This would require a backend API to expose LoRA metadata
                        this.loraMetadata.push(metadata);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching LoRA metadata:', error);
            // Continue without LoRA metadata
        }
    }

    /**
     * Initialize the LLM refiner by loading available models.
     */
    async init() {
        try {
            let data = await new Promise((resolve, reject) => {
                genericRequest('GetOpenRouterModels', {}, resolve, 0, reject);
            });
            
            if (data.error) {
                console.error('OpenRouter API error:', data.error);
                this.showError(data.error);
                return;
            }

            this.models = data.models || [];
            this.populateModelDropdown();
        } catch (error) {
            console.error('Error initializing LLM refiner:', error);
            this.showError('Failed to load models. Please check your OpenRouter API key in User Settings.');
        }
    }

    /**
     * Populate the model dropdown with available models.
     */
    populateModelDropdown() {
        let selects = [
            document.getElementById('llm_refine_model_select'),
            document.getElementById('llm_generate_model_select'),
            document.getElementById('llm_blend_model_select')
        ];
        
        for (let select of selects) {
            if (!select) continue;

            select.innerHTML = '';
            
            if (this.models.length === 0) {
                select.innerHTML = '<option value="">No models available. Please configure OpenRouter API key.</option>';
                continue;
            }

            // Add a default option
            let defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select a model...';
            select.appendChild(defaultOption);

            // Add common/recommended models first
            let recommendedModels = [
                'anthropic/claude-3.5-sonnet',
                'openai/gpt-4-turbo',
                'google/gemini-pro',
                'meta-llama/llama-3-70b-instruct'
            ];

            let recommended = this.models.filter(m => recommendedModels.some(r => m.id.includes(r)));
            let others = this.models.filter(m => !recommendedModels.some(r => m.id.includes(r)));

            if (recommended.length > 0) {
                let optgroup = document.createElement('optgroup');
                optgroup.label = 'Recommended';
                recommended.forEach(model => {
                    let option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    option.dataset.supportsVision = model.supportsVision || false;
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            }

            if (others.length > 0) {
                let optgroup = document.createElement('optgroup');
                optgroup.label = 'Other Models';
                others.slice(0, 50).forEach(model => { // Limit to first 50 to avoid overwhelming the UI
                    let option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    option.dataset.supportsVision = model.supportsVision || false;
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            }
        }

        // Add change listener to handle vision support warnings
        let refineSelect = document.getElementById('llm_refine_model_select');
        if (refineSelect) {
            refineSelect.addEventListener('change', () => this.checkVisionSupport());
        }
    }

    /**
     * Open the refinement modal and prepare the source.
     */
    openModal() {
        // Detect source (image tags or prompt text)
        this.detectSource();
        
        // Initialize models if not already loaded
        if (this.models.length === 0) {
            this.init();
        }

        // Fetch LoRA metadata if not already loaded
        if (!this.loraMetadata) {
            this.fetchLoraMetadata();
        }

        // Reset UI
        this.resetUI();

        // Update display
        this.updateSourceDisplay();

        // Show modal
        $('#llm_prompt_refine_modal').modal('show');
    }

    /**
     * Check if the selected model supports vision and show warning if needed.
     */
    checkVisionSupport() {
        let modelSelect = document.getElementById('llm_refine_model_select');
        let bypassCheckbox = document.getElementById('llm_refine_vision_bypass');
        let statusDiv = document.getElementById('llm_refine_status');
        
        if (!modelSelect || !modelSelect.value) {
            return;
        }

        let selectedOption = modelSelect.options[modelSelect.selectedIndex];
        let supportsVision = selectedOption.dataset.supportsVision === 'true';

        // If using image tags and model doesn't support vision, show warning and auto-check bypass
        if (this.currentSourceType === 'image_tags' && !supportsVision && !bypassCheckbox.checked) {
            statusDiv.textContent = 'Warning: Selected model may not support vision. "Bypass Vision" has been enabled.';
            statusDiv.style.color = '#ff8800';
            bypassCheckbox.checked = true;
        } else {
            statusDiv.textContent = '';
            statusDiv.style.color = '#666';
        }
    }

    /**
     * Detect the source for refinement (image tags or prompt text).
     * Supports enhanced context control modes.
     */
    detectSource() {
        // Check if an image is selected and has metadata
        let hasImageMetadata = false;
        let imageTags = '';

        if (currentMetadataVal) {
            try {
                let readable = interpretMetadata(currentMetadataVal);
                if (readable) {
                    let metadata = JSON.parse(readable);
                    if (metadata.sui_image_params && metadata.sui_image_params.prompt) {
                        imageTags = metadata.sui_image_params.prompt;
                        hasImageMetadata = true;
                    }
                }
            } catch (e) {
                console.error('Error parsing image metadata:', e);
            }
        }

        // Get current prompt text
        let promptBox = document.getElementById('alt_prompt_textbox');
        let currentPrompt = promptBox ? promptBox.value.trim() : '';

        // Get context mode
        let contextMode = document.getElementById('llm_refine_context_mode');
        let mode = contextMode ? contextMode.value : 'replace';

        if (hasImageMetadata && imageTags) {
            if (mode === 'replace') {
                // Traditional behavior: use image tags
                this.currentSource = imageTags;
                this.currentSourceType = 'image_tags';
            } else if (mode === 'inspire') {
                // Keep prompt, use image metadata as inspiration
                this.currentSource = currentPrompt || imageTags;
                this.currentSourceType = 'prompt_inspired';
                this.imageMetadataContext = imageTags;
            } else if (mode === 'append') {
                // Append image metadata to current prompt
                if (currentPrompt) {
                    this.currentSource = currentPrompt + ', ' + imageTags;
                } else {
                    this.currentSource = imageTags;
                }
                this.currentSourceType = 'prompt_appended';
            }
        } else {
            // Use current prompt text
            this.currentSource = currentPrompt;
            this.currentSourceType = 'prompt_text';
        }
    }

    /**
     * Update the source display in the modal.
     */
    updateSourceDisplay() {
        let sourceDisplay = document.getElementById('llm_refine_source_display');
        let originalText = document.getElementById('llm_refine_original_text');

        if (sourceDisplay) {
            sourceDisplay.textContent = this.currentSourceType === 'image_tags' 
                ? 'Image Tags from selected image' 
                : 'Current Prompt Text';
        }

        if (originalText) {
            originalText.value = this.currentSource || '(empty)';
        }
    }

    /**
     * Reset the UI to initial state.
     */
    resetUI() {
        let resultContainer = document.getElementById('llm_refine_result_container');
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }

        let diffContainer = document.getElementById('llm_refine_diff_container');
        if (diffContainer) {
            diffContainer.style.display = 'none';
        }

        let diffDisplay = document.getElementById('llm_refine_diff_display');
        if (diffDisplay) {
            diffDisplay.innerHTML = '<div style="opacity: 0.6; font-style: italic;">No changes yet.</div>';
        }

        let refineButton = document.getElementById('llm_refine_button');
        if (refineButton) {
            refineButton.disabled = false;
            refineButton.classList.remove('btn-info');
            if (!refineButton.classList.contains('btn-primary')) {
                refineButton.classList.add('btn-primary');
            }
        }

        let applyButton = document.getElementById('llm_apply_button');
        if (applyButton) {
            applyButton.style.display = 'none';
            applyButton.classList.remove('btn-info');
            if (!applyButton.classList.contains('btn-success')) {
                applyButton.classList.add('btn-success');
            }
        }

        let status = document.getElementById('llm_refine_status');
        if (status) {
            status.textContent = '';
            status.style.color = '#666';
        }

        let modalError = document.getElementById('llm_refine_modal_error');
        if (modalError) {
            modalError.textContent = '';
        }
        
        // Clear additional user instructions
        let userPromptInput = document.getElementById('llm_refine_user_prompt');
        if (userPromptInput) {
            userPromptInput.value = '';
        }
        
        // Uncheck vision bypass by default
        let bypassCheckbox = document.getElementById('llm_refine_vision_bypass');
        if (bypassCheckbox) {
            bypassCheckbox.checked = false;
        }
        
        this.refinedPrompt = null;
    }

    /**
     * Perform the prompt refinement.
     */
    async refinePrompt() {
        let modelSelect = document.getElementById('llm_refine_model_select');
        let modelId = modelSelect ? modelSelect.value : '';
        let userPromptInput = document.getElementById('llm_refine_user_prompt');
        let bypassCheckbox = document.getElementById('llm_refine_vision_bypass');
        let refineButton = document.getElementById('llm_refine_button');
        let status = document.getElementById('llm_refine_status');

        if (!modelId) {
            this.showError('Please select a model.');
            return;
        }

        if (!this.currentSource || this.currentSource.trim() === '') {
            this.showError('No source text to refine. Please enter a prompt or select an image with metadata.');
            return;
        }

        // Get additional user instructions if provided
        let customUserPrompt = userPromptInput ? userPromptInput.value.trim() : '';
        let bypassVision = bypassCheckbox ? bypassCheckbox.checked : false;

        // Disable refine button and show status
        if (refineButton) {
            refineButton.disabled = true;
        }
        if (status) {
            status.textContent = 'Refining prompt...';
            status.style.color = '#666';
        }
        this.showError('');

        try {
            // Build enhanced system prompt with best practices and LoRA awareness
            let systemPrompt = this.buildSystemPromptWithBestPractices();
            
            // Add context for inspiration mode
            if (this.currentSourceType === 'prompt_inspired' && this.imageMetadataContext) {
                systemPrompt += '\n\nThe user wants to keep their current prompt but draw inspiration from image metadata. ' +
                    `Image metadata for inspiration: ${this.imageMetadataContext}`;
            }

            let requestBody = {
                modelId: modelId,
                sourceText: this.currentSource,
                isImageTags: this.currentSourceType.includes('image_tags') || this.currentSourceType.includes('appended'),
                bypassVision: bypassVision,
                systemPrompt: systemPrompt
            };

            // Add additional user prompt if provided
            if (customUserPrompt) {
                requestBody.userPrompt = customUserPrompt;
            }

            let data = await new Promise((resolve, reject) => {
                genericRequest('RefinePromptWithOpenRouter', requestBody, resolve, 0, reject);
            });

            if (data.error) {
                this.showError(data.error);
                if (status) {
                    status.textContent = '';
                }
                if (refineButton) {
                    refineButton.disabled = false;
                }
                return;
            }

            this.refinedPrompt = data.refined_prompt;
            this.displayRefinedPrompt();
            if (status) {
                status.textContent = 'Refinement complete!';
                status.style.color = '#0a0';
            }
            if (refineButton) {
                refineButton.disabled = false;
            }

        } catch (error) {
            console.error('Error refining prompt:', error);
            this.showError('Failed to refine prompt. Please try again.');
            if (status) {
                status.textContent = '';
            }
            if (refineButton) {
                refineButton.disabled = false;
            }
        }
    }

    /**
     * Display the refined prompt and show diff.
     */
    displayRefinedPrompt() {
        let resultText = document.getElementById('llm_refine_result_text');
        let resultContainer = document.getElementById('llm_refine_result_container');
        let diffContainer = document.getElementById('llm_refine_diff_container');
        let applyButton = document.getElementById('llm_apply_button');

        if (resultText) {
            resultText.value = this.refinedPrompt;
        }

        if (resultContainer) {
            resultContainer.style.display = 'block';
        }

        // Generate and display diff
        this.displayDiff();

        if (diffContainer) {
            diffContainer.style.display = 'block';
        }

        if (applyButton) {
            applyButton.style.display = 'inline-block';
            applyButton.classList.remove('btn-secondary');
            applyButton.classList.add('btn-success');
        }

        let refineButton = document.getElementById('llm_refine_button');
        if (refineButton) {
            refineButton.classList.remove('btn-primary');
            refineButton.classList.add('btn-info');
        }
    }

    /**
     * Display a simple diff between original and refined prompts.
     */
    displayDiff() {
        let diffDisplay = document.getElementById('llm_refine_diff_display');
        if (!diffDisplay) return;

        // Simple word-based diff
        let original = this.currentSource.split(/\s+/);
        let refined = this.refinedPrompt.split(/\s+/);

        let diffHtml = this.generateSimpleDiff(original, refined);
        diffDisplay.innerHTML = diffHtml;
    }

    /**
     * Generate a simple visual diff between two arrays of words.
     */
    generateSimpleDiff(original, refined) {
        let originalCounts = Object.create(null);
        let refinedCounts = Object.create(null);
        let originalTokensByKey = Object.create(null);
        let refinedTokensByKey = Object.create(null);

        for (let token of original) {
            if (!token) continue;
            let key = token.toLowerCase();
            originalCounts[key] = (originalCounts[key] || 0) + 1;
            if (!originalTokensByKey[key]) {
                originalTokensByKey[key] = [];
            }
            originalTokensByKey[key].push(token);
        }

        for (let token of refined) {
            if (!token) continue;
            let key = token.toLowerCase();
            refinedCounts[key] = (refinedCounts[key] || 0) + 1;
            if (!refinedTokensByKey[key]) {
                refinedTokensByKey[key] = [];
            }
            refinedTokensByKey[key].push(token);
        }

        let removed = [];
        for (let key of Object.keys(originalCounts)) {
            let diff = originalCounts[key] - (refinedCounts[key] || 0);
            if (diff > 0) {
                removed.push(...originalTokensByKey[key].slice(0, diff));
            }
        }

        let added = [];
        for (let key of Object.keys(refinedCounts)) {
            let diff = refinedCounts[key] - (originalCounts[key] || 0);
            if (diff > 0) {
                added.push(...refinedTokensByKey[key].slice(0, diff));
            }
        }

        const removedLabelStyle = 'color: #ff9aa2; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;';
        const addedLabelStyle = 'color: #7be495; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;';
        const tokenBaseStyle = 'display: inline-flex; align-items: center; margin: 2px 4px 2px 0; padding: 4px 8px; border-radius: 16px; font-size: 0.85rem; border: 1px solid; backdrop-filter: brightness(1.1);';
        const removedTokenStyle = `${tokenBaseStyle} background-color: rgba(255, 99, 132, 0.22); border-color: rgba(255, 99, 132, 0.35); color: #ffb2bd;`;
        const addedTokenStyle = `${tokenBaseStyle} background-color: rgba(76, 175, 80, 0.22); border-color: rgba(76, 175, 80, 0.35); color: #9df3b4;`;

        let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

        if (removed.length > 0) {
            html += `<div><div style="${removedLabelStyle}">Removed</div><div style="margin-top: 6px; display: flex; flex-wrap: wrap;">`;
            html += removed.map(w => `<span style="${removedTokenStyle}">${escapeHtml(w)}</span>`).join('');
            html += '</div></div>';
        }

        if (added.length > 0) {
            html += `<div><div style="${addedLabelStyle}">Added</div><div style="margin-top: 6px; display: flex; flex-wrap: wrap;">`;
            html += added.map(w => `<span style="${addedTokenStyle}">${escapeHtml(w)}</span>`).join('');
            html += '</div></div>';
        }

        if (removed.length === 0 && added.length === 0) {
            html += '<div style="opacity: 0.7;">No word-level additions or removals detected. The refinement may have only re-ordered tags or adjusted punctuation.</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Execute the action based on current mode (Refine, Generate, or Blend)
     */
    async executeAction() {
        let mode = this.getCurrentMode();
        if (mode === 'refine') {
            await this.refinePrompt();
        } else if (mode === 'generate') {
            await this.generatePrompt();
        } else if (mode === 'blend') {
            await this.blendPrompts();
        }
    }

    /**
     * Apply the result based on current mode
     */
    applyResult() {
        let mode = this.getCurrentMode();
        if (mode === 'refine') {
            this.applyRefinedPrompt();
        } else if (mode === 'generate') {
            this.applyGeneratedPrompt();
        } else if (mode === 'blend') {
            this.applyBlendedPrompt();
        }
    }

    /**
     * Generate a prompt from minimal input
     */
    async generatePrompt() {
        let modelSelect = document.getElementById('llm_generate_model_select');
        let modelId = modelSelect ? modelSelect.value : '';
        let inputBox = document.getElementById('llm_generate_input');
        let styleBox = document.getElementById('llm_generate_style');
        let detailSelect = document.getElementById('llm_generate_detail_level');
        let status = document.getElementById('llm_generate_status');
        let actionButton = document.getElementById('llm_action_button');

        if (!modelId) {
            this.showError('Please select a model.');
            return;
        }

        let input = inputBox ? inputBox.value.trim() : '';
        if (!input) {
            this.showError('Please enter an idea or keywords.');
            return;
        }

        let style = styleBox ? styleBox.value.trim() : '';
        let detailLevel = detailSelect ? detailSelect.value : 'moderate';

        // Disable button and show status
        if (actionButton) actionButton.disabled = true;
        if (status) {
            status.textContent = 'Generating prompt...';
            status.style.color = '#666';
        }
        this.showError('');

        try {
            // Build the generation request
            let detailInstructions = {
                'minimal': 'Keep the prompt simple and concise with only essential tags.',
                'moderate': 'Create a balanced prompt with good detail.',
                'detailed': 'Generate a very detailed and descriptive prompt.',
                'extreme': 'Create an extremely detailed prompt with maximum descriptors and quality tags.'
            };

            let systemPrompt = this.buildSystemPromptWithBestPractices() + '\n\n' +
                'Generate a complete, detailed prompt for image generation from the user\'s simple idea. ' +
                detailInstructions[detailLevel] +
                (style ? ` Use the "${style}" style.` : '');

            let requestBody = {
                modelId: modelId,
                sourceText: input,
                isImageTags: false,
                systemPrompt: systemPrompt,
                bypassVision: true
            };

            let data = await new Promise((resolve, reject) => {
                genericRequest('RefinePromptWithOpenRouter', requestBody, resolve, 0, reject);
            });

            if (data.error) {
                this.showError(data.error);
                if (status) status.textContent = '';
                if (actionButton) actionButton.disabled = false;
                return;
            }

            this.generatedPrompt = data.refined_prompt;
            this.displayGeneratedPrompt();
            if (status) {
                status.textContent = 'Generation complete!';
                status.style.color = '#0a0';
            }
            if (actionButton) actionButton.disabled = false;

        } catch (error) {
            console.error('Error generating prompt:', error);
            this.showError('Failed to generate prompt. Please try again.');
            if (status) status.textContent = '';
            if (actionButton) actionButton.disabled = false;
        }
    }

    /**
     * Blend multiple prompts together
     */
    async blendPrompts() {
        let modelSelect = document.getElementById('llm_blend_model_select');
        let modelId = modelSelect ? modelSelect.value : '';
        let prompt1Box = document.getElementById('llm_blend_prompt1');
        let prompt2Box = document.getElementById('llm_blend_prompt2');
        let prompt3Box = document.getElementById('llm_blend_prompt3');
        let modeSelect = document.getElementById('llm_blend_mode');
        let status = document.getElementById('llm_blend_status');
        let actionButton = document.getElementById('llm_action_button');

        if (!modelId) {
            this.showError('Please select a model.');
            return;
        }

        let prompt1 = prompt1Box ? prompt1Box.value.trim() : '';
        let prompt2 = prompt2Box ? prompt2Box.value.trim() : '';
        let prompt3 = prompt3Box ? prompt3Box.value.trim() : '';

        if (!prompt1 || !prompt2) {
            this.showError('Please enter at least two prompts to blend.');
            return;
        }

        let blendMode = modeSelect ? modeSelect.value : 'balanced';

        // Disable button and show status
        if (actionButton) actionButton.disabled = true;
        if (status) {
            status.textContent = 'Blending prompts...';
            status.style.color = '#666';
        }
        this.showError('');

        try {
            let modeInstructions = {
                'balanced': 'Blend these prompts giving equal weight to all elements.',
                'favor_first': 'Blend these prompts while emphasizing elements from the first prompt.',
                'creative': 'Creatively blend these prompts, adding your own interpretations.',
                'structured': 'Blend these prompts maintaining clear structure and organization.'
            };

            let prompts = [prompt1, prompt2];
            if (prompt3) prompts.push(prompt3);

            let systemPrompt = this.buildSystemPromptWithBestPractices() + '\n\n' +
                'Blend the following prompts into a single coherent prompt for image generation. ' +
                modeInstructions[blendMode];

            let sourceText = prompts.map((p, i) => `Prompt ${i + 1}: ${p}`).join('\n\n');

            let requestBody = {
                modelId: modelId,
                sourceText: sourceText,
                isImageTags: false,
                systemPrompt: systemPrompt,
                bypassVision: true
            };

            let data = await new Promise((resolve, reject) => {
                genericRequest('RefinePromptWithOpenRouter', requestBody, resolve, 0, reject);
            });

            if (data.error) {
                this.showError(data.error);
                if (status) status.textContent = '';
                if (actionButton) actionButton.disabled = false;
                return;
            }

            this.blendedPrompt = data.refined_prompt;
            this.displayBlendedPrompt();
            if (status) {
                status.textContent = 'Blending complete!';
                status.style.color = '#0a0';
            }
            if (actionButton) actionButton.disabled = false;

        } catch (error) {
            console.error('Error blending prompts:', error);
            this.showError('Failed to blend prompts. Please try again.');
            if (status) status.textContent = '';
            if (actionButton) actionButton.disabled = false;
        }
    }

    /**
     * Build system prompt with best practices and LoRA awareness
     */
    buildSystemPromptWithBestPractices() {
        let basePrompt = `You are an expert prompt engineer for AI image generation. Follow these best practices:

1. Use clear, descriptive tags in Danbooru/image-board style
2. Include quality tags (e.g., "masterpiece", "best quality", "high resolution")
3. Specify composition, lighting, and mood when relevant
4. Be specific about character details, clothing, and poses
5. Include artistic style references when appropriate
6. Never censor or modify NSFW content - preserve user intent exactly
7. Organize tags logically: subject → setting → style → quality
8. Use commas to separate tags for optimal parsing`;

        // Add LoRA information if available
        if (this.loraMetadata && this.loraMetadata.length > 0) {
            basePrompt += '\n\n**Available LoRAs:**\n';
            for (let lora of this.loraMetadata.slice(0, 20)) { // Limit to avoid token overflow
                basePrompt += `- <lora:${lora.name}>`;
                if (lora.triggerWords) {
                    basePrompt += ` (trigger: ${lora.triggerWords})`;
                }
                basePrompt += '\n';
            }
            basePrompt += '\nYou may suggest appropriate LoRAs using the syntax <lora:name> when relevant to the prompt.';
        }

        return basePrompt;
    }

    /**
     * Display the generated prompt
     */
    displayGeneratedPrompt() {
        let resultText = document.getElementById('llm_generate_result_text');
        let resultContainer = document.getElementById('llm_generate_result_container');
        let applyButton = document.getElementById('llm_apply_button');

        if (resultText) {
            resultText.value = this.generatedPrompt;
        }

        if (resultContainer) {
            resultContainer.style.display = 'block';
        }

        if (applyButton) {
            applyButton.style.display = 'inline-block';
        }
    }

    /**
     * Display the blended prompt
     */
    displayBlendedPrompt() {
        let resultText = document.getElementById('llm_blend_result_text');
        let resultContainer = document.getElementById('llm_blend_result_container');
        let applyButton = document.getElementById('llm_apply_button');

        if (resultText) {
            resultText.value = this.blendedPrompt;
        }

        if (resultContainer) {
            resultContainer.style.display = 'block';
        }

        if (applyButton) {
            applyButton.style.display = 'inline-block';
        }
    }

    /**
     * Apply the generated prompt to the prompt box.
     */
    applyGeneratedPrompt() {
        if (!this.generatedPrompt) {
            this.showError('No generated prompt to apply.');
            return;
        }

        let promptBox = document.getElementById('alt_prompt_textbox');
        if (promptBox) {
            promptBox.value = this.generatedPrompt;
            triggerChangeFor(promptBox);
        }

        // Close the modal
        $('#llm_prompt_refine_modal').modal('hide');
    }

    /**
     * Apply the blended prompt to the prompt box.
     */
    applyBlendedPrompt() {
        if (!this.blendedPrompt) {
            this.showError('No blended prompt to apply.');
            return;
        }

        let promptBox = document.getElementById('alt_prompt_textbox');
        if (promptBox) {
            promptBox.value = this.blendedPrompt;
            triggerChangeFor(promptBox);
        }

        // Close the modal
        $('#llm_prompt_refine_modal').modal('hide');
    }

    /**
     * Apply the refined prompt to the prompt box.
     */
    applyRefinedPrompt() {
        if (!this.refinedPrompt) {
            this.showError('No refined prompt to apply.');
            return;
        }

        let promptBox = document.getElementById('alt_prompt_textbox');
        if (promptBox) {
            promptBox.value = this.refinedPrompt;
            triggerChangeFor(promptBox);
        }

        // Close the modal
        $('#llm_prompt_refine_modal').modal('hide');
    }

    /**
     * Show an error message.
     */
    showError(message) {
        let errorSpan = document.getElementById('llm_refine_modal_error');
        if (errorSpan) {
            errorSpan.textContent = message;
        }
    }
}

// Global instance
let promptLLM = new PromptLLM();

// Backward compatibility alias
let llmPromptRefiner = promptLLM;
