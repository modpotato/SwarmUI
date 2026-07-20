class AlibabaVideoTab {
    /** Initializes the dedicated remote video generation tab. */
    constructor() {
        this.model = getRequiredElementById('alibaba_video_model');
        this.prompt = getRequiredElementById('alibaba_video_prompt');
        this.references = getRequiredElementById('alibaba_video_references');
        this.referenceWrap = getRequiredElementById('alibaba_video_references_wrap');
        this.referenceLabel = getRequiredElementById('alibaba_video_references_label');
        this.referenceHint = getRequiredElementById('alibaba_video_references_hint');
        this.generateButton = getRequiredElementById('alibaba_video_generate');
        this.interruptButton = getRequiredElementById('alibaba_video_interrupt');
        this.status = getRequiredElementById('alibaba_video_status');
        this.result = getRequiredElementById('alibaba_video_result');
        this.history = getRequiredElementById('alibaba_video_history');
        this.socket = null;
        this.model.addEventListener('change', () => this.updateReferenceMode());
        this.generateButton.addEventListener('click', () => this.generate());
        this.interruptButton.addEventListener('click', () => this.interrupt());
        getRequiredElementById('alibaba_video_refresh').addEventListener('click', () => this.loadHistory());
        getRequiredElementById('maintab_generatevideo').addEventListener('click', () => this.loadHistory());
        this.updateReferenceMode();
    }

    /** Updates reference-image requirements for the selected HappyHorse mode. */
    updateReferenceMode() {
        let model = this.model.value;
        if (model.endsWith('-t2v')) {
            this.referenceWrap.style.display = 'none';
            this.references.value = '';
        }
        else {
            this.referenceWrap.style.display = '';
            if (model.endsWith('-i2v')) {
                this.referenceLabel.textContent = 'First Frame Image';
                this.referenceHint.textContent = 'Upload exactly one image (PNG, JPEG, or WebP).';
                this.references.multiple = false;
            }
            else {
                this.referenceLabel.textContent = 'Reference Images';
                this.referenceHint.textContent = 'Upload 1–9 images. Refer to them as [Image 1], [Image 2], and so on in the prompt.';
                this.references.multiple = true;
            }
        }
    }

    /** Reads selected image files as Alibaba-compatible data URLs. */
    async readReferenceImages() {
        let files = [...this.references.files];
        let results = [];
        for (let file of files) {
            results.push(await new Promise((resolve, reject) => {
                let reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                reader.readAsDataURL(file);
            }));
        }
        return results;
    }

    /** Starts a remote asynchronous video task and renders streamed state updates. */
    async generate() {
        let prompt = this.prompt.value.trim();
        if (!prompt) {
            showError('A video prompt is required.');
            return;
        }
        let references;
        try {
            references = await this.readReferenceImages();
        }
        catch (error) {
            showError(error.message);
            return;
        }
        let model = this.model.value;
        if (model.endsWith('-i2v') && references.length != 1) {
            showError('Image-to-video requires exactly one first-frame image.');
            return;
        }
        if (model.endsWith('-r2v') && (references.length < 1 || references.length > 9)) {
            showError('Reference-to-video requires between one and nine images.');
            return;
        }
        this.generateButton.disabled = true;
        this.status.textContent = 'Submitting video task...';
        let request = {
            prompt: prompt,
            model: model,
            reference_images: references,
            resolution: getRequiredElementById('alibaba_video_resolution').value,
            ratio: getRequiredElementById('alibaba_video_ratio').value,
            duration: parseInt(getRequiredElementById('alibaba_video_duration').value)
        };
        this.socket = makeWSRequest('GenerateAlibabaVideoWS', request, data => this.handleUpdate(data), 0, error => {
            this.generateButton.disabled = false;
            this.status.textContent = 'Generation failed.';
            showError(error);
        });
    }

    /** Handles task status and final video events from the server. */
    handleUpdate(data) {
        if (data.video) {
            this.generateButton.disabled = false;
            this.status.textContent = 'Video complete and saved.';
            this.renderVideo(data.video, data.metadata);
            this.loadHistory();
            return;
        }
        if (data.status) {
            this.status.textContent = `Alibaba task ${data.status.toLowerCase()}${data.task_id ? ` — ${data.task_id}` : ''}`;
        }
    }

    /** Renders one video in the main result area. */
    renderVideo(src, metadata = '') {
        let safeSrc = escapeHtml(src);
        this.result.innerHTML = `<video controls autoplay class="alibaba-video-main" src="${safeSrc}"></video>`
            + `<div class="alibaba-video-result-actions"><a class="basic-button" href="${safeSrc}" target="_blank">Open</a>`
            + '<button class="basic-button alibaba-video-delete">Delete</button></div>';
        this.result.querySelector('.alibaba-video-delete').addEventListener('click', () => this.deleteVideo(src));
        this.result.dataset.metadata = metadata ?? '';
    }

    /** Requests interruption for this user's current generation session. */
    interrupt() {
        genericRequest('InterruptAll', {}, () => {
            this.status.textContent = 'Interrupt requested.';
            this.generateButton.disabled = false;
        });
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    /** Loads recent files from the dedicated server-side video output directory. */
    loadHistory() {
        genericRequest('ListVideos', { path: '', depth: 5, sortBy: 'Date', sortReverse: false }, data => {
            this.history.innerHTML = '';
            let files = data.files ?? [];
            if (files.length == 0) {
                this.history.append(createDiv(null, 'alibaba-video-empty', 'No saved videos yet.'));
                return;
            }
            for (let file of files) {
                let src = `${getImageOutPrefix()}/${file.src}`;
                let item = createDiv(null, 'alibaba-video-history-item');
                item.innerHTML = `<video preload="metadata" muted src="${escapeHtml(src)}"></video><div class="alibaba-video-history-name">${escapeHtml(file.src.split('/').pop())}</div>`;
                item.addEventListener('click', () => this.renderVideo(src, file.metadata));
                this.history.append(item);
            }
        });
    }

    /** Deletes a video through the normal media deletion API. */
    deleteVideo(src) {
        let path = src;
        let prefix = `${getImageOutPrefix()}/`;
        if (path.startsWith(prefix)) {
            path = path.substring(prefix.length);
        }
        genericRequest('DeleteImage', { path: path }, () => {
            this.result.innerHTML = '<div class="alibaba-video-empty">Video deleted.</div>';
            this.loadHistory();
        });
    }
}

let alibabaVideoTab = new AlibabaVideoTab();
