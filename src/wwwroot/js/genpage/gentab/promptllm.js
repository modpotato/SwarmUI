
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
        this.contextOptions = {
            includePrompt: true,
            includeImageTags: false,
            tagsMode: 'append',
            includeCurrentImage: false,
            includeUploadedImage: false
        };
        this.contextControlsInitialized = false;
        this.suppressContextChange = false;
        this.uploadedImageData = null;
        this.uploadedImageName = null;
        this.cachedCurrentImageData = null;
        this.cachedCurrentImageSrc = null;
        this.latestImageTags = '';
        this.hasImageMetadataAvailable = false;
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
            // Try the new dedicated LoRA metadata endpoint first
            let resp = await new Promise((resolve, reject) => {
                genericRequest('GetLoraMetadata', {}, resolve, 0, reject);
            });
            if (resp && resp.loras) {
                this.loraMetadata = [];
                for (let item of resp.loras) {
                    this.loraMetadata.push({
                        name: item.id || item.title,
                        triggerWords: item.triggerPhrase || null,
                        description: item.description || null,
                        preview: item.preview || null,
                        tags: item.tags || null
                    });
                }
                return;
            }

            // Fallback: fall back to parameter listing
            let data = await new Promise((resolve, reject) => {
                genericRequest('ListT2IParams', {}, resolve, 0, reject);
            });
            
            if (data && data.list) {
                let loraParam = data.list.find(p => p.id === 'loras');
                if (loraParam && loraParam.values) {
                    this.loraMetadata = [];
                    for (let lora of loraParam.values) {
                        this.loraMetadata.push({ name: lora, triggerWords: null, description: null });
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching LoRA metadata:', error);
            // Continue without LoRA metadata
        }
    }

    /** Initialize context control event handlers once. */
    initializeContextControls() {
        if (this.contextControlsInitialized) {
            return;
        }
        this.contextControlsInitialized = true;

        const promptToggle = document.getElementById('llm_refine_include_prompt');
        const tagsToggle = document.getElementById('llm_refine_include_image_tags');
        const tagsBehaviorRadios = document.querySelectorAll('input[name="llm_refine_tags_behavior"]');
        const currentImageToggle = document.getElementById('llm_refine_include_current_image');
        const bypassCheckbox = document.getElementById('llm_refine_vision_bypass');
        const uploadInput = document.getElementById('llm_refine_upload_image');
        const clearButton = document.getElementById('llm_refine_clear_upload');

        const onContextChange = () => {
            if (this.suppressContextChange) {
                return;
            }
            this.detectSource();
            this.updateSourceDisplay();
        };

        promptToggle?.addEventListener('change', onContextChange);

        tagsToggle?.addEventListener('change', () => {
            this.updateTagsControlsState();
            onContextChange();
        });

        tagsBehaviorRadios.forEach(radio => {
            radio.addEventListener('change', onContextChange);
        });

        currentImageToggle?.addEventListener('change', () => {
            this.updateImageControlsState();
            onContextChange();
        });

        bypassCheckbox?.addEventListener('change', () => {
            this.updateImageControlsState();
            this.checkVisionSupport();
        });

        uploadInput?.addEventListener('change', (event) => {
            this.handleUploadSelected(event);
        });

        clearButton?.addEventListener('click', () => {
            this.clearUploadedImage();
        });
    }

    /** Refresh availability and defaults for context controls based on current state. */
    refreshContextAvailability() {
        const metadata = this.extractImageMetadata();
        this.hasImageMetadataAvailable = metadata.hasMetadata;
        this.latestImageTags = metadata.tags;

        this.suppressContextChange = true;

        const promptToggle = document.getElementById('llm_refine_include_prompt');
        if (promptToggle) {
            promptToggle.checked = true;
        }

        const tagsToggle = document.getElementById('llm_refine_include_image_tags');
        const tagsStatus = document.getElementById('llm_refine_tags_status');
        if (tagsToggle) {
            if (!metadata.hasMetadata) {
                tagsToggle.checked = false;
                tagsToggle.disabled = true;
                if (tagsStatus) {
                    tagsStatus.textContent = 'No image metadata detected for the current image.';
                }
            }
            else {
                tagsToggle.disabled = false;
                tagsToggle.checked = true;
                if (tagsStatus) {
                    tagsStatus.textContent = 'Configure how image tags contribute to the refinement.';
                }
            }
        }

        const appendRadio = document.getElementById('llm_refine_tags_append');
        if (appendRadio) {
            appendRadio.checked = true;
        }

        const imageToggle = document.getElementById('llm_refine_include_current_image');
        const imageStatus = document.getElementById('llm_refine_image_status');
        const hasImage = !!currentImgSrc;
        if (imageToggle) {
            imageToggle.checked = false;
            imageToggle.disabled = !hasImage;
        }
        if (imageStatus) {
            imageStatus.textContent = hasImage ? '' : 'No image is currently selected.';
        }

        this.clearUploadedImage(true);

        this.suppressContextChange = false;

        this.updateTagsControlsState();
        this.updateImageControlsState();
    }

    /** Extract image metadata tags if available. */
    extractImageMetadata() {
        let hasMetadata = false;
        let tags = '';
        if (currentMetadataVal) {
            try {
                let readable = interpretMetadata(currentMetadataVal);
                if (readable) {
                    let metadata = JSON.parse(readable);
                    if (metadata.sui_image_params && metadata.sui_image_params.prompt) {
                        tags = metadata.sui_image_params.prompt;
                        hasMetadata = true;
                    }
                }
            }
            catch (error) {
                console.error('Error parsing image metadata:', error);
            }
        }
        return { hasMetadata, tags };
    }

    /** Determine currently selected image-tag behavior. */
    getTagsMode() {
        const selected = document.querySelector('input[name="llm_refine_tags_behavior"]:checked');
        return selected ? selected.value : 'append';
    }

    /** Whether the current image is selected for vision context. */
    isCurrentImageSelected() {
        const toggle = document.getElementById('llm_refine_include_current_image');
        return !!(toggle && !toggle.disabled && toggle.checked);
    }

    /** Determine whether any image data should be sent. */
    shouldSendImageData(bypassVision = null) {
        const bypass = bypassVision !== null
            ? bypassVision
            : (document.getElementById('llm_refine_vision_bypass')?.checked ?? false);
        if (bypass) {
            return false;
        }
        return this.isCurrentImageSelected() || !!this.uploadedImageData;
    }

    /** Convert the current image to a data URL if available. */
    async getCurrentImageDataUrl() {
        if (!currentImgSrc) {
            return null;
        }
        if (currentImgSrc.startsWith('data:')) {
            return currentImgSrc;
        }
        if (this.cachedCurrentImageSrc === currentImgSrc && this.cachedCurrentImageData) {
            return this.cachedCurrentImageData;
        }
        return await new Promise((resolve, reject) => {
            try {
                toDataURL(currentImgSrc, (url) => {
                    if (url) {
                        this.cachedCurrentImageSrc = currentImgSrc;
                        this.cachedCurrentImageData = url;
                        resolve(url);
                    }
                    else {
                        reject(new Error('Failed to convert current image to data URL.'));
                    }
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }

    /** Calculate approximate size of a base64 data URL in KB. */
    getDataUrlSizeKB(dataUrl) {
        if (!dataUrl) return 0;
        // Base64 encoding adds ~33% overhead, but we can estimate from string length
        // Actual bytes = (string length * 3) / 4, roughly
        return Math.round((dataUrl.length * 3) / (4 * 1024));
    }

    /** Gather all image payloads that should be attached to the request. */
    async collectImageData(bypassVision) {
        if (!this.shouldSendImageData(bypassVision)) {
            return [];
        }

        let payload = [];

        if (this.isCurrentImageSelected()) {
            const dataUrl = await this.getCurrentImageDataUrl();
            if (dataUrl) {
                payload.push(dataUrl);
            }
        }

        if (this.uploadedImageData) {
            payload.push(this.uploadedImageData);
        }

        return payload;
    }

    /** Handle manual image uploads for additional vision context. */
    handleUploadSelected(event) {
        const file = event?.target?.files?.[0];
        if (!file) {
            this.clearUploadedImage();
            return;
        }
        if (!file.type.startsWith('image/')) {
            this.showError('Selected file is not an image.');
            this.clearUploadedImage();
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            this.uploadedImageData = loadEvent.target.result;
            this.uploadedImageName = file.name;
            const preview = document.getElementById('llm_refine_upload_preview');
            if (preview) {
                const originalSizeKB = Math.max(1, Math.round(file.size / 1024));
                const base64SizeKB = this.getDataUrlSizeKB(this.uploadedImageData);
                preview.textContent = `${file.name} ready to attach (${originalSizeKB} KB file → ~${base64SizeKB} KB as base64).`;
            }
            const clearButton = document.getElementById('llm_refine_clear_upload');
            if (clearButton) {
                clearButton.style.display = 'inline-flex';
            }
            this.contextOptions.includeUploadedImage = true;
            this.updateImageControlsState();
            this.updateSourceDisplay();
        };
        reader.onerror = () => {
            this.showError('Failed to read uploaded image. Please try again.');
            this.clearUploadedImage();
        };
        reader.readAsDataURL(file);
    }

    /** Clear any uploaded image from the current session. */
    clearUploadedImage(silent = false) {
        this.uploadedImageData = null;
        this.uploadedImageName = null;
        const uploadInput = document.getElementById('llm_refine_upload_image');
        if (uploadInput) {
            uploadInput.value = '';
        }
        const preview = document.getElementById('llm_refine_upload_preview');
        if (preview) {
            preview.textContent = '';
        }
        const clearButton = document.getElementById('llm_refine_clear_upload');
        if (clearButton) {
            clearButton.style.display = 'none';
        }
        this.contextOptions.includeUploadedImage = false;
        if (!silent) {
            this.updateImageControlsState();
            this.updateSourceDisplay();
        }
    }

    /** Update the state of tag-related controls and messaging. */
    updateTagsControlsState() {
        const tagsToggle = document.getElementById('llm_refine_include_image_tags');
        const tagRadios = document.querySelectorAll('#llm_refine_tags_behavior_group input');
        const tagLabels = document.querySelectorAll('#llm_refine_tags_behavior_group label');
        const status = document.getElementById('llm_refine_tags_status');

        const tagsEnabled = !!(tagsToggle && !tagsToggle.disabled && tagsToggle.checked && this.hasImageMetadataAvailable);

        tagRadios.forEach(radio => {
            radio.disabled = !tagsEnabled;
        });

        tagLabels.forEach(label => {
            label.classList.toggle('disabled', !tagsEnabled);
        });

        if (status) {
            if (!this.hasImageMetadataAvailable) {
                status.textContent = 'No image metadata detected for the current image.';
            }
            else if (!tagsToggle || !tagsToggle.checked) {
                status.textContent = 'Toggle on to include image tags in the refinement.';
            }
            else {
                status.textContent = 'Configure how image tags contribute to the refinement.';
            }
        }
    }

    /** Update the state of image attachment controls and helper text. */
    updateImageControlsState() {
        const imageToggle = document.getElementById('llm_refine_include_current_image');
        const uploadInput = document.getElementById('llm_refine_upload_image');
        const status = document.getElementById('llm_refine_image_status');
        const bypassCheckbox = document.getElementById('llm_refine_vision_bypass');
        const bypass = bypassCheckbox ? bypassCheckbox.checked : false;
        const hasImage = !!currentImgSrc;

        if (imageToggle) {
            const shouldDisable = !hasImage || bypass;
            imageToggle.disabled = shouldDisable;
            if (shouldDisable) {
                imageToggle.checked = false;
            }
        }

        if (uploadInput) {
            uploadInput.disabled = bypass;
        }

        if (status) {
            if (bypass) {
                status.textContent = 'Vision bypass enabled; attached images will be ignored.';
            }
            else if (!hasImage) {
                status.textContent = 'No image is currently selected.';
            }
            else if (this.isCurrentImageSelected() && this.cachedCurrentImageData) {
                // Show current image size when it's selected and cached
                const sizeKB = this.getDataUrlSizeKB(this.cachedCurrentImageData);
                status.textContent = `Current image will be attached (~${sizeKB} KB as base64).`;
            }
            else if (this.isCurrentImageSelected()) {
                status.textContent = 'Current image will be attached.';
            }
            else {
                status.textContent = '';
            }
        }

        this.contextOptions.includeCurrentImage = this.isCurrentImageSelected();
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
        this.initializeContextControls();

        // Reset UI state before loading context
        this.resetUI();

        // Ensure current availability is reflected in toggles
        this.refreshContextAvailability();

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

        // Inject LoRA descriptions toggle UI if not present
        try {
            const loraToggleId = 'llm_refine_include_lora_desc';
            if (!document.getElementById(loraToggleId)) {
                const container = document.getElementById('llm_refine_controls_container') || document.getElementById('llm_refine_modal_body') || document.body;
                const wrapper = document.createElement('div');
                wrapper.style.marginTop = '8px';
                wrapper.innerHTML = `\
                    <label style="font-size:0.9em; display:flex; align-items:center; gap:8px;">\
                        <input type="checkbox" id="${loraToggleId}">\
                        <span>Include LoRA descriptions in system prompt (costs tokens)</span>\
                    </label>\
                `;
                container.prepend(wrapper);
            }
        } catch (e) {
            console.warn('Failed to inject LoRA description toggle UI:', e);
        }

        // Update display
        this.updateSourceDisplay();
        this.checkVisionSupport();

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

        const wantsVision = this.shouldSendImageData(bypassCheckbox.checked);

        if (wantsVision && !supportsVision && !bypassCheckbox.checked) {
            statusDiv.textContent = 'Warning: Selected model may not support vision. "Bypass Vision" has been enabled.';
            statusDiv.style.color = '#ff8800';
            bypassCheckbox.checked = true;
            this.updateImageControlsState();
        }
        else {
            statusDiv.textContent = '';
            statusDiv.style.color = '#666';
        }
    }

    /**
     * Detect the source for refinement (image tags or prompt text).
     * Supports enhanced context control modes.
     */
    detectSource() {
        const { hasMetadata, tags } = this.extractImageMetadata();
        this.hasImageMetadataAvailable = hasMetadata;
        this.latestImageTags = tags;

        const promptToggle = document.getElementById('llm_refine_include_prompt');
        const promptBox = document.getElementById('alt_prompt_textbox');
        const promptText = promptBox ? promptBox.value.trim() : '';
        const includePrompt = !!(promptToggle && !promptToggle.disabled && promptToggle.checked && promptText.length > 0);

        const tagsToggle = document.getElementById('llm_refine_include_image_tags');
        const includeTags = !!(hasMetadata && tagsToggle && !tagsToggle.disabled && tagsToggle.checked && tags.length > 0);
        const tagsMode = includeTags ? this.getTagsMode() : 'append';

        this.contextOptions.includePrompt = includePrompt;
        this.contextOptions.includeImageTags = includeTags;
        this.contextOptions.tagsMode = tagsMode;
        this.contextOptions.includeCurrentImage = this.isCurrentImageSelected();
        this.contextOptions.includeUploadedImage = !!this.uploadedImageData;

        this.currentSource = '';
        this.currentSourceType = 'none';
        this.imageMetadataContext = null;

        if (!includePrompt && !includeTags) {
            if (promptText) {
                this.currentSource = promptText;
                this.currentSourceType = 'prompt_text';
            }
            else if (tags) {
                this.currentSource = tags;
                this.currentSourceType = 'image_tags_only';
            }
            return;
        }

        if (includeTags && (!includePrompt || tagsMode === 'replace')) {
            this.currentSource = tags;
            this.currentSourceType = 'image_tags_only';
            return;
        }

        if (includePrompt) {
            this.currentSource = promptText;
            this.currentSourceType = 'prompt_text';
        }

        if (includeTags) {
            if (tagsMode === 'append') {
                if (this.currentSource) {
                    let base = this.currentSource.trim();
                    let separator = ',';
                    if (base.endsWith(',') || base.endsWith(';') || base.endsWith('.')) {
                        separator = '';
                    }
                    this.currentSource = `${base}${separator ? separator + ' ' : ' '}${tags}`.trim();
                    this.currentSourceType = 'prompt_plus_tags';
                }
                else {
                    this.currentSource = tags;
                    this.currentSourceType = 'image_tags_only';
                }
            }
            else if (tagsMode === 'reference') {
                this.imageMetadataContext = tags;
                if (!this.currentSource) {
                    this.currentSource = tags;
                    this.currentSourceType = 'image_tags_only';
                }
                else {
                    this.currentSourceType = 'prompt_with_tag_reference';
                }
            }
        }

        if (!this.currentSource) {
            this.currentSourceType = 'none';
        }
    }

    /**
     * Update the source display in the modal.
     */
    updateSourceDisplay() {
        const sourceDisplay = document.getElementById('llm_refine_source_display');
        const visionDisplay = document.getElementById('llm_refine_vision_display');
        const originalText = document.getElementById('llm_refine_original_text');

        if (sourceDisplay) {
            const parts = [];
            const promptToggle = document.getElementById('llm_refine_include_prompt');
            const promptBox = document.getElementById('alt_prompt_textbox');
            const hasPromptText = promptBox && promptBox.value.trim().length > 0;
            if (promptToggle && promptToggle.checked) {
                parts.push(hasPromptText ? 'Current prompt' : 'Current prompt (empty)');
            }
            const tagsToggle = document.getElementById('llm_refine_include_image_tags');
            if (tagsToggle && tagsToggle.checked) {
                if (!this.hasImageMetadataAvailable) {
                    parts.push('Image tags (not available)');
                }
                else {
                    if (this.contextOptions.tagsMode === 'append') {
                        parts.push('Image tags (append)');
                    }
                    else if (this.contextOptions.tagsMode === 'reference') {
                        parts.push('Image tags (inspiration)');
                    }
                    else {
                        parts.push('Image tags (replace)');
                    }
                }
            }
            sourceDisplay.textContent = parts.length > 0 ? parts.join(' + ') : 'None selected';
        }

        if (visionDisplay) {
            const attachments = [];
            if (this.isCurrentImageSelected()) {
                attachments.push('Current image');
            }
            if (this.uploadedImageData) {
                attachments.push(this.uploadedImageName ? `Uploaded: ${this.uploadedImageName}` : 'Uploaded image');
            }
            const bypass = document.getElementById('llm_refine_vision_bypass')?.checked ?? false;
            if (attachments.length === 0) {
                visionDisplay.textContent = 'None';
            }
            else if (bypass) {
                visionDisplay.textContent = `${attachments.join(', ')} (ignored due to bypass)`;
            }
            else {
                visionDisplay.textContent = attachments.join(', ');
            }
        }

        if (originalText) {
            originalText.value = this.currentSource || '(empty)';
        }
    }

    /**
     * Reset the UI to initial state.
     */
    resetUI() {
        let originalContainer = document.getElementById('llm_refine_original_container');
        if (originalContainer) {
            originalContainer.style.display = 'block';
        }

        let resultContainer = document.getElementById('llm_refine_result_container');
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }

        let diffContainer = document.getElementById('llm_refine_diff_container');
        if (diffContainer) {
            diffContainer.style.display = 'none';
        }

        let inlineViewerContainer = document.getElementById('llm_refine_inline_viewer_container');
        if (inlineViewerContainer) {
            inlineViewerContainer.style.display = 'none';
        }

        let inlineViewer = document.getElementById('llm_refine_inline_viewer');
        if (inlineViewer) {
            inlineViewer.innerHTML = '<div style="opacity: 0.6; font-style: italic;">No refinement yet.</div>';
        }

        let diffDisplay = document.getElementById('llm_refine_diff_display');
        if (diffDisplay) {
            diffDisplay.innerHTML = '<div style="opacity: 0.6; font-style: italic;">No changes yet.</div>';
        }

        let actionButton = document.getElementById('llm_action_button');
        if (actionButton) {
            actionButton.disabled = false;
            actionButton.classList.remove('btn-info');
            if (!actionButton.classList.contains('btn-primary')) {
                actionButton.classList.add('btn-primary');
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
        
        // Reset context controls to defaults
        this.suppressContextChange = true;
        let promptToggle = document.getElementById('llm_refine_include_prompt');
        if (promptToggle) {
            promptToggle.checked = true;
        }
        let tagsToggle = document.getElementById('llm_refine_include_image_tags');
        if (tagsToggle) {
            tagsToggle.checked = false;
        }
        let appendRadio = document.getElementById('llm_refine_tags_append');
        if (appendRadio) {
            appendRadio.checked = true;
        }
        let imageToggle = document.getElementById('llm_refine_include_current_image');
        if (imageToggle) {
            imageToggle.checked = false;
        }
        this.suppressContextChange = false;

        // Clear uploaded image and cached previews
        this.clearUploadedImage(true);
        this.cachedCurrentImageData = null;
        this.cachedCurrentImageSrc = null;
    this.imageMetadataContext = null;
    this.hasImageMetadataAvailable = false;
    this.latestImageTags = '';
        this.contextOptions = {
            includePrompt: true,
            includeImageTags: false,
            tagsMode: 'append',
            includeCurrentImage: false,
            includeUploadedImage: false
        };

        // Uncheck vision bypass by default
        let bypassCheckbox = document.getElementById('llm_refine_vision_bypass');
        if (bypassCheckbox) {
            bypassCheckbox.checked = false;
        }

        this.updateTagsControlsState();
        this.updateImageControlsState();

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
            if (this.imageMetadataContext) {
                systemPrompt += '\n\nThe user wants to keep their current prompt but draw inspiration from image metadata. ' +
                    `Image metadata for inspiration: ${this.imageMetadataContext}`;
            }

            let imagePayload = [];
            try {
                imagePayload = await this.collectImageData(bypassVision);
                
                // Calculate and display total payload size
                if (imagePayload.length > 0) {
                    let totalImageSizeKB = 0;
                    imagePayload.forEach(dataUrl => {
                        totalImageSizeKB += this.getDataUrlSizeKB(dataUrl);
                    });
                    
                    console.log(`LLM Refiner: Sending ${imagePayload.length} image(s), total ~${totalImageSizeKB} KB as base64`);
                    
                    // Warn if payload is very large
                    if (totalImageSizeKB > 800) {
                        const proceed = confirm(
                            `Warning: The attached image(s) are very large (~${totalImageSizeKB} KB as base64).\n\n` +
                            `This may exceed the provider's request size limit and cause a "Request Too Large" error.\n\n` +
                            `Consider:\n` +
                            `• Using smaller/compressed images\n` +
                            `• Attaching fewer images\n` +
                            `• Enabling "Bypass Vision" to send text only\n\n` +
                            `Do you want to proceed anyway?`
                        );
                        if (!proceed) {
                            if (status) {
                                status.textContent = 'Refinement cancelled.';
                                status.style.color = '#666';
                            }
                            if (refineButton) {
                                refineButton.disabled = false;
                            }
                            return;
                        }
                    }
                    else if (totalImageSizeKB > 400) {
                        console.warn(`LLM Refiner: Large image payload (~${totalImageSizeKB} KB). May fail with some providers.`);
                    }
                }
            }
            catch (imageError) {
                console.error('Error preparing vision attachments:', imageError);
                this.showError('Failed to prepare selected image attachments. Please try again.');
                if (status) {
                    status.textContent = '';
                }
                if (refineButton) {
                    refineButton.disabled = false;
                }
                return;
            }

            let requestBody = {
                modelId: modelId,
                sourceText: this.currentSource,
                isImageTags: this.currentSourceType === 'image_tags_only' || this.currentSourceType === 'prompt_plus_tags',
                bypassVision: bypassVision,
                systemPrompt: systemPrompt
            };

            // Add additional user prompt if provided
            if (customUserPrompt) {
                requestBody.userPrompt = customUserPrompt;
            }

            if (imagePayload.length > 0) {
                requestBody.imageData = imagePayload;
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
        let inlineViewerContainer = document.getElementById('llm_refine_inline_viewer_container');
        let inlineViewer = document.getElementById('llm_refine_inline_viewer');
        let originalContainer = document.getElementById('llm_refine_original_container');
        let resultContainer = document.getElementById('llm_refine_result_container');
        let diffContainer = document.getElementById('llm_refine_diff_container');
        let applyButton = document.getElementById('llm_apply_button');
        let actionButton = document.getElementById('llm_action_button');

        // Hide the old three-box layout
        if (originalContainer) {
            originalContainer.style.display = 'none';
        }
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }
        if (diffContainer) {
            diffContainer.style.display = 'none';
        }

        // Generate and display inline diff
        if (inlineViewer) {
            let inlineDiffHtml = this.generateInlineDiff(this.currentSource || '', this.refinedPrompt || '');
            inlineViewer.innerHTML = inlineDiffHtml;
        }

        // Show the new inline viewer
        if (inlineViewerContainer) {
            inlineViewerContainer.style.display = 'block';
        }

        // Make Apply button primary (green and prominent)
        if (applyButton) {
            applyButton.style.display = 'inline-block';
            applyButton.classList.remove('btn-secondary');
            applyButton.classList.add('btn-success');
        }

        // De-emphasize the action button (change from primary to info)
        if (actionButton) {
            actionButton.classList.remove('btn-primary');
            actionButton.classList.add('btn-info');
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
     * Generate inline diff HTML with additions highlighted in green and removals struck through in red.
     */
    generateInlineDiff(originalText, refinedText) {
        // Split into words while preserving spaces and punctuation
        const originalWords = originalText.match(/\S+|\s+/g) || [];
        const refinedWords = refinedText.match(/\S+|\s+/g) || [];
        
        // Build frequency maps (case-insensitive for matching)
        let originalCounts = Object.create(null);
        let refinedCounts = Object.create(null);
        
        for (let word of originalWords) {
            if (/^\s+$/.test(word)) continue; // Skip pure whitespace
            let key = word.toLowerCase();
            originalCounts[key] = (originalCounts[key] || 0) + 1;
        }
        
        for (let word of refinedWords) {
            if (/^\s+$/.test(word)) continue; // Skip pure whitespace
            let key = word.toLowerCase();
            refinedCounts[key] = (refinedCounts[key] || 0) + 1;
        }
        
        // Track which words are added or removed
        let removedKeys = Object.create(null);
        let addedKeys = Object.create(null);
        
        for (let key of Object.keys(originalCounts)) {
            let diff = originalCounts[key] - (refinedCounts[key] || 0);
            if (diff > 0) {
                removedKeys[key] = diff;
            }
        }
        
        for (let key of Object.keys(refinedCounts)) {
            let diff = refinedCounts[key] - (originalCounts[key] || 0);
            if (diff > 0) {
                addedKeys[key] = diff;
            }
        }
        
        // Build the inline HTML
        let html = '';
        let usedRemovals = Object.create(null);
        let usedAdditions = Object.create(null);
        
        // Styles for inline highlights
        const addedStyle = 'background-color: rgba(76, 175, 80, 0.25); padding: 2px 4px; border-radius: 3px; color: inherit;';
        const removedStyle = 'background-color: rgba(255, 99, 132, 0.25); padding: 2px 4px; border-radius: 3px; text-decoration: line-through; color: rgba(255, 99, 132, 0.8);';
        
        for (let word of refinedWords) {
            if (/^\s+$/.test(word)) {
                // Preserve whitespace as-is
                html += escapeHtml(word);
            } else {
                let key = word.toLowerCase();
                let isAddition = addedKeys[key] > 0 && (!usedAdditions[key] || usedAdditions[key] < addedKeys[key]);
                
                if (isAddition) {
                    html += `<span style="${addedStyle}">${escapeHtml(word)}</span>`;
                    usedAdditions[key] = (usedAdditions[key] || 0) + 1;
                } else {
                    html += escapeHtml(word);
                }
            }
        }
        
        // Add removed words at the end (struck through)
        let removedHtml = '';
        for (let word of originalWords) {
            if (/^\s+$/.test(word)) continue; // Skip whitespace for removals
            let key = word.toLowerCase();
            let isRemoval = removedKeys[key] > 0 && (!usedRemovals[key] || usedRemovals[key] < removedKeys[key]);
            
            if (isRemoval) {
                removedHtml += `<span style="${removedStyle}">${escapeHtml(word)}</span> `;
                usedRemovals[key] = (usedRemovals[key] || 0) + 1;
            }
        }
        
        if (removedHtml) {
            html += ' ' + removedHtml.trim();
        }
        
        return html || '<span style="opacity: 0.7;">No changes detected.</span>';
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

        // Helpers for LoRA block construction
        const truncate = (s, max) => s && s.length > max ? s.slice(0, max - 1) + '…' : s;
        const buildLoRABlock = (loras, includeDescriptions) => {
            if (!loras || loras.length === 0) return '';
            const MAX_LORAS = 5; // include at most 5 LoRAs by default
            const MAX_DESC = 150; // max chars per description
            const MAX_BLOCK = 2000; // max total chars for the block

            let selected = loras.slice(0, MAX_LORAS);
            let parts = selected.map(l => {
                let line = `- <lora:${l.name}>`;
                if (l.triggerWords) {
                    line += ` (trigger: ${l.triggerWords})`;
                }
                if (includeDescriptions && l.description) {
                    line += ` — desc: ${truncate(l.description, MAX_DESC)}`;
                }
                return line;
            });

            // Ensure the block isn't excessively large; trim descriptions or drop LoRAs if needed
            let block = '**Available LoRAs:**\n' + parts.join('\n');
            if (block.length > MAX_BLOCK && includeDescriptions) {
                // Try removing descriptions first
                parts = selected.map(l => {
                    let line = `- <lora:${l.name}>`;
                    if (l.triggerWords) line += ` (trigger: ${l.triggerWords})`;
                    return line;
                });
                block = '**Available LoRAs:**\n' + parts.join('\n');
            }
            if (block.length > MAX_BLOCK) {
                // As a last resort, keep only names for first 3 LoRAs
                parts = selected.slice(0, 3).map(l => `- <lora:${l.name}>${l.triggerWords ? ` (trigger: ${l.triggerWords})` : ''}`);
                block = '**Available LoRAs (trimmed):**\n' + parts.join('\n');
            }
            return block + '\nYou may suggest appropriate LoRAs using the syntax <lora:name> when relevant to the prompt.';
        };

        // Add LoRA information if available
        if (this.loraMetadata && this.loraMetadata.length > 0) {
            try {
                const includeDescriptions = !!document.getElementById('llm_refine_include_lora_desc')?.checked;
                basePrompt += '\n\n' + buildLoRABlock(this.loraMetadata, includeDescriptions) + '\n';
            } catch (e) {
                // Fallback to names+triggers only
                basePrompt += '\n\n**Available LoRAs:**\n';
                for (let lora of this.loraMetadata.slice(0, 5)) {
                    basePrompt += `- <lora:${lora.name}>`;
                    if (lora.triggerWords) basePrompt += ` (trigger: ${lora.triggerWords})`;
                    basePrompt += '\n';
                }
                basePrompt += '\nYou may suggest appropriate LoRAs using the syntax <lora:name> when relevant to the prompt.';
            }
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
