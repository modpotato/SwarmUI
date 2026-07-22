class PostProcessTab {
    /** Initializes the post-processing tab. */
    constructor() {
        this.imagePreview = getRequiredElementById('postprocess_image_preview');
        this.fileInput = getRequiredElementById('postprocess_file_input');
        this.genTags = getRequiredElementById('postprocess_gen_tags');
        this.loraNames = getRequiredElementById('postprocess_lora_names');
        this.inferredTags = getRequiredElementById('postprocess_inferred_tags');
        this.finalTags = getRequiredElementById('postprocess_final_tags');
        this.llmModel = getRequiredElementById('postprocess_llm_model');
        this.resultDiv = getRequiredElementById('postprocess_result');
        this.currentImageData = null;
        this.currentImagePath = null;
        this.models = [];
        getRequiredElementById('postprocess_upload_btn').addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', () => this.handleFileUpload());
        getRequiredElementById('postprocess_browse_btn').addEventListener('click', () => this.browseHistory());
        getRequiredElementById('postprocess_auto_tag_btn').addEventListener('click', () => this.autoTag());
        getRequiredElementById('postprocess_llm_tag_btn').addEventListener('click', () => this.llmTag());
        getRequiredElementById('postprocess_llm_tag_plus').addEventListener('click', (e) => this.showPromptMenu(e));
        getRequiredElementById('postprocess_apply_wm_btn').addEventListener('click', () => this.applyWatermark());
        getRequiredElementById('postprocess_copy_tags_btn').addEventListener('click', () => this.copyTags());
        getRequiredElementById('postprocess_save_tags_btn').addEventListener('click', () => this.saveSidecar());
        getRequiredElementById('postprocess_run_workflow_btn').addEventListener('click', () => this.runWorkflow());
        getRequiredElementById('maintab_postprocess').addEventListener('click', () => this.onTabOpen());
    }

    /** Called when the tab is opened. */
    onTabOpen() {
        if (this.models.length == 0) {
            this.loadModels();
        }
        this.loadWorkflows();
    }

    /** Loads OpenRouter models for the LLM tag dropdown. */
    loadModels() {
        genericRequest('GetOpenRouterModels', {}, data => {
            this.models = data.models ?? [];
            this.llmModel.innerHTML = '';
            for (let model of this.models) {
                let opt = document.createElement('option');
                opt.value = model.id;
                opt.textContent = model.name ?? model.id;
                if (model.supports_vision) {
                    opt.textContent += ' (vision)';
                }
                this.llmModel.append(opt);
            }
            let visionModel = this.models.find(m => m.supports_vision);
            if (visionModel) {
                this.llmModel.value = visionModel.id;
            }
        });
    }

    /** Loads available ComfyUI workflows. */
    loadWorkflows() {
        genericRequest('ComfyListWorkflows', {}, data => {
            let select = getRequiredElementById('postprocess_workflow_select');
            select.innerHTML = '<option value="">None</option>';
            for (let wf of (data.workflows ?? [])) {
                let opt = document.createElement('option');
                opt.value = wf;
                opt.textContent = wf;
                select.append(opt);
            }
        });
    }

    /** Handles file upload for the source image. */
    handleFileUpload() {
        let file = this.fileInput.files[0];
        if (!file) {
            return;
        }
        let reader = new FileReader();
        reader.onload = () => {
            this.currentImageData = reader.result;
            this.currentImagePath = null;
            this.showPreview(reader.result);
        };
        reader.readAsDataURL(file);
    }

    /** Opens the image history browser to select a source image. */
    browseHistory() {
        let lastImage = typeof lastHistoryImage !== 'undefined' ? lastHistoryImage : null;
        if (lastImage) {
            this.loadImageFromSrc(lastImage);
            return;
        }
        if (typeof imageHistoryBrowser !== 'undefined') {
            getRequiredElementById('imagehistorytabclickable').click();
        }
    }

    /** Loads an image from a src URL into the post-process tab. */
    async loadImageFromSrc(src) {
        try {
            let response = await fetch(src);
            let blob = await response.blob();
            let dataUrl = await new Promise((resolve, reject) => {
                let reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read'));
                reader.readAsDataURL(blob);
            });
            this.currentImageData = dataUrl;
            this.currentImagePath = src;
            this.showPreview(dataUrl);
            this.extractMetadata(src);
        }
        catch (error) {
            showError(`Failed to load image: ${error.message}`);
        }
    }

    /** Shows a preview of the current image. */
    showPreview(dataUrl) {
        this.imagePreview.innerHTML = `<img src="${dataUrl}" class="postprocess-preview-img" />`;
    }

    /** Extracts generation metadata from the image if available. */
    extractMetadata(src) {
        if (typeof currentMetadataVal !== 'undefined' && currentMetadataVal) {
            try {
                let meta = JSON.parse(currentMetadataVal);
                let params = meta.sui_image_params ?? meta;
                if (params.prompt) {
                    this.genTags.value = params.prompt;
                }
                if (params.loras) {
                    this.loraNames.value = params.loras;
                }
            }
            catch (e) {
                // metadata not JSON, ignore
            }
        }
    }

    /** Runs the automatic tagger via ComfyUI workflow. */
    autoTag() {
        if (!this.currentImageData) {
            showError('No image selected.');
            return;
        }
        let statusBtn = getRequiredElementById('postprocess_auto_tag_btn');
        statusBtn.disabled = true;
        statusBtn.textContent = 'Tagging...';
        genericRequest('ComfyReadWorkflow', { name: 'swarm_auto_tagger' }, data => {
            if (data.error) {
                statusBtn.disabled = false;
                statusBtn.textContent = 'Auto Tag';
                showError('Auto-tagger workflow not found. Create a ComfyUI workflow named "swarm_auto_tagger" with the WD tagger node.');
                return;
            }
            statusBtn.disabled = false;
            statusBtn.textContent = 'Auto Tag';
            this.inferredTags.value = 'Auto-tagger workflow found. Use the Generate tab with the tagger workflow to produce tags, then paste them here.';
        }, 0, error => {
            statusBtn.disabled = false;
            statusBtn.textContent = 'Auto Tag';
            showError(`Auto-tagger check failed: ${error}`);
        });
    }

    /** Generates tags using the LLM with vision. */
    llmTag() {
        if (!this.currentImageData) {
            showError('No image selected.');
            return;
        }
        let modelId = this.llmModel.value;
        if (!modelId) {
            showError('No LLM model selected.');
            return;
        }
        let btn = getRequiredElementById('postprocess_llm_tag_btn');
        btn.disabled = true;
        btn.textContent = 'Generating...';
        genericRequest('GenerateTagsWithLLM', {
            imageData: this.currentImageData,
            generationTags: this.genTags.value,
            loraNames: this.loraNames.value,
            inferredTags: this.inferredTags.value,
            includeArtistNames: getRequiredElementById('postprocess_include_artist').checked,
            modelId: modelId
        }, data => {
            btn.disabled = false;
            btn.textContent = 'Generate Tags';
            if (data.tags) {
                this.finalTags.value = data.tags;
            }
            else if (data.error) {
                showError(data.error);
            }
        }, 0, error => {
            btn.disabled = false;
            btn.textContent = 'Generate Tags';
            showError(`LLM tagging failed: ${error}`);
        });
    }

    /** Shows the prompt LLM menu. */
    showPromptMenu(e) {
        let rect = e.target.getBoundingClientRect();
        let buttons = [
            { key: 'llm_refine', label: 'Prompt LLM', title: 'Open Prompt LLM for tag refinement', action: () => promptLLM.openModal(this.finalTags) }
        ];
        new AdvancedPopover('postprocess_prompt_menu', buttons, true, rect.x, rect.y + rect.height + 2, e.target.parentElement, null, null, 250);
    }

    /** Applies the watermark to the current image. */
    applyWatermark() {
        if (!this.currentImageData) {
            showError('No image selected.');
            return;
        }
        let status = getRequiredElementById('postprocess_wm_status');
        status.textContent = 'Applying watermark...';
        genericRequest('ApplyWatermark', {
            image: this.currentImageData,
            alpha: parseInt(getRequiredElementById('postprocess_wm_alpha').value),
            corner: getRequiredElementById('postprocess_wm_corner').value
        }, data => {
            if (data.image) {
                this.currentImageData = data.image;
                this.showPreview(data.image);
                this.resultDiv.innerHTML = `<img src="${data.image}" class="postprocess-result-img" />`;
                status.textContent = 'Watermark applied.';
            }
            else if (data.error) {
                status.textContent = data.error;
            }
        }, 0, error => {
            status.textContent = `Failed: ${error}`;
        });
    }

    /** Copies the final tags to clipboard. */
    copyTags() {
        let tags = this.finalTags.value.trim();
        if (!tags) {
            showError('No tags to copy.');
            return;
        }
        navigator.clipboard.writeText(tags);
    }

    /** Saves the tag list as a sidecar .txt file next to the image. */
    saveSidecar() {
        if (!this.currentImagePath) {
            showError('No image path available. Upload or select from history first.');
            return;
        }
        let tags = this.finalTags.value.trim();
        if (!tags) {
            showError('No tags to save.');
            return;
        }
        let path = this.currentImagePath;
        let prefix = `${getImageOutPrefix()}/`;
        if (path.startsWith(prefix)) {
            path = path.substring(prefix.length);
        }
        genericRequest('SaveTextFile', { path: path.replace(/\.[^.]+$/, '.txt'), content: tags }, () => {
            getRequiredElementById('postprocess_save_tags_btn').textContent = 'Saved!';
            setTimeout(() => { getRequiredElementById('postprocess_save_tags_btn').textContent = 'Save Sidecar'; }, 2000);
        }, 0, error => {
            showError(`Failed to save: ${error}`);
        });
    }

    /** Runs a ComfyUI workflow on the current image via the Generate tab. */
    runWorkflow() {
        let workflow = getRequiredElementById('postprocess_workflow_select').value;
        if (!workflow) {
            showError('No workflow selected.');
            return;
        }
        if (!this.currentImageData) {
            showError('No image selected.');
            return;
        }
        let status = getRequiredElementById('postprocess_workflow_status');
        status.textContent = 'Loading workflow into Generate tab...';
        genericRequest('ComfyReadWorkflow', { name: workflow }, data => {
            if (data.error) {
                status.textContent = `Failed to load workflow: ${data.error}`;
                return;
            }
            status.textContent = 'Workflow loaded. Switch to the Generate tab to run it with this image as init.';
        }, 0, error => {
            status.textContent = `Failed: ${error}`;
        });
    }
}

let postProcessTab = new PostProcessTab();
