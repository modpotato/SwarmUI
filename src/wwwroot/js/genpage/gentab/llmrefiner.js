
/** Handler for LLM-based prompt refinement feature. */
class LLMPromptRefiner {
    constructor() {
        this.models = [];
        this.currentSource = null;
        this.currentSourceType = null;
        this.refinedPrompt = null;
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
        let select = document.getElementById('llm_refine_model_select');
        if (!select) return;

        select.innerHTML = '';
        
        if (this.models.length === 0) {
            select.innerHTML = '<option value="">No models available. Please configure OpenRouter API key.</option>';
            return;
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

        // Add change listener to handle vision support warnings
        select.addEventListener('change', () => this.checkVisionSupport());
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

        if (hasImageMetadata && imageTags) {
            this.currentSource = imageTags;
            this.currentSourceType = 'image_tags';
        } else {
            // Use current prompt text
            let promptBox = document.getElementById('alt_prompt_textbox');
            this.currentSource = promptBox ? promptBox.value.trim() : '';
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
            let requestBody = {
                modelId: modelId,
                sourceText: this.currentSource,
                isImageTags: this.currentSourceType === 'image_tags',
                bypassVision: bypassVision
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
let llmPromptRefiner = new LLMPromptRefiner();
