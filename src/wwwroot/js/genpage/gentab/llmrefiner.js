
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
            let response = await fetch('/API/GetOpenRouterModels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                console.error('Failed to fetch OpenRouter models');
                return;
            }

            let data = await response.json();
            
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
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
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

        // Reset UI
        this.resetUI();

        // Update display
        this.updateSourceDisplay();

        // Show modal
        $('#llm_prompt_refine_modal').modal('show');
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
        document.getElementById('llm_refine_result_container').style.display = 'none';
        document.getElementById('llm_refine_diff_container').style.display = 'none';
        document.getElementById('llm_apply_button').style.display = 'none';
        document.getElementById('llm_refine_button').disabled = false;
        document.getElementById('llm_refine_status').textContent = '';
        document.getElementById('llm_refine_modal_error').textContent = '';
        this.refinedPrompt = null;
    }

    /**
     * Perform the prompt refinement.
     */
    async refinePrompt() {
        let modelSelect = document.getElementById('llm_refine_model_select');
        let modelId = modelSelect.value;

        if (!modelId) {
            this.showError('Please select a model.');
            return;
        }

        if (!this.currentSource || this.currentSource.trim() === '') {
            this.showError('No source text to refine. Please enter a prompt or select an image with metadata.');
            return;
        }

        // Disable refine button and show status
        document.getElementById('llm_refine_button').disabled = true;
        document.getElementById('llm_refine_status').textContent = 'Refining prompt...';
        this.showError('');

        try {
            let response = await fetch('/API/RefinePromptWithOpenRouter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelId: modelId,
                    sourceText: this.currentSource,
                    isImageTags: this.currentSourceType === 'image_tags'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to refine prompt');
            }

            let data = await response.json();

            if (data.error) {
                this.showError(data.error);
                document.getElementById('llm_refine_status').textContent = '';
                document.getElementById('llm_refine_button').disabled = false;
                return;
            }

            this.refinedPrompt = data.refined_prompt;
            this.displayRefinedPrompt();
            document.getElementById('llm_refine_status').textContent = 'Refinement complete!';

        } catch (error) {
            console.error('Error refining prompt:', error);
            this.showError('Failed to refine prompt. Please try again.');
            document.getElementById('llm_refine_status').textContent = '';
            document.getElementById('llm_refine_button').disabled = false;
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
        // Simple visualization: show removed words in red, added words in green
        let originalSet = new Set(original.map(w => w.toLowerCase()));
        let refinedSet = new Set(refined.map(w => w.toLowerCase()));

        let removed = original.filter(w => !refinedSet.has(w.toLowerCase()));
        let added = refined.filter(w => !originalSet.has(w.toLowerCase()));

        let html = '<div style="line-height: 1.8;">';
        
        if (removed.length > 0) {
            html += '<div><span style="color: #c00; font-weight: bold;">Removed:</span> ';
            html += removed.map(w => `<span style="background-color: #ffdddd; padding: 2px 4px; margin: 2px; border-radius: 3px;">${escapeHtml(w)}</span>`).join(' ');
            html += '</div>';
        }

        if (added.length > 0) {
            html += '<div style="margin-top: 5px;"><span style="color: #0a0; font-weight: bold;">Added:</span> ';
            html += added.map(w => `<span style="background-color: #ddffdd; padding: 2px 4px; margin: 2px; border-radius: 3px;">${escapeHtml(w)}</span>`).join(' ');
            html += '</div>';
        }

        if (removed.length === 0 && added.length === 0) {
            html += '<div style="color: #666;">No significant word-level changes detected.</div>';
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
