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
        this.selectedRefsDiv = getRequiredElementById('alibaba_video_selected_refs');
        this.socket = null;
        this.browserSelectedImages = [];
        this.imageBrowser = null;
        this.model.addEventListener('change', () => this.updateReferenceMode());
        this.generateButton.addEventListener('click', () => this.generate());
        this.interruptButton.addEventListener('click', () => this.interrupt());
        getRequiredElementById('alibaba_video_refresh').addEventListener('click', () => this.loadHistory());
        getRequiredElementById('maintab_generatevideo').addEventListener('click', () => this.loadHistory());
        getRequiredElementById('alibaba_video_browse_history').addEventListener('click', () => this.openImageBrowser());
        getRequiredElementById('alibaba_video_browser_close').addEventListener('click', () => this.closeImageBrowser());
        getRequiredElementById('alibaba_video_browser_confirm').addEventListener('click', () => this.confirmBrowserSelection());
        getRequiredElementById('alibaba_video_prompt_plus').addEventListener('click', (e) => this.showPromptMenu(e));
        this.updateReferenceMode();
    }

    /** Shows the prompt LLM menu for the video prompt. */
    showPromptMenu(e) {
        let rect = e.target.getBoundingClientRect();
        let buttons = [
            { key: 'llm_refine', label: 'Prompt LLM', title: 'Open Prompt LLM to refine or generate a video prompt', action: () => promptLLM.openModal(this.prompt, this.buildContextProvider()) }
        ];
        new AdvancedPopover('alibaba_video_prompt_menu', buttons, true, rect.x, rect.y + rect.height + 2, e.target.parentElement, null, null, 250);
    }

    /** Builds a context provider so the shared Prompt LLM widget operates on the video tab's prompt and reference image. */
    buildContextProvider() {
        let tab = this;
        return {
            getPromptText: () => tab.prompt.value,
            getMetadata: () => {
                let first = tab.selectedRefsDiv.querySelector('.alibaba-video-ref-thumb');
                return first ? (first.dataset.metadata ?? '') : '';
            },
            getImageSrc: () => {
                let first = tab.selectedRefsDiv.querySelector('.alibaba-video-ref-thumb');
                return first ? (first.dataset.dataUrl ?? null) : null;
            }
        };
    }

    /** Opens the embedded image history browser modal. */
    openImageBrowser() {
        let modal = getRequiredElementById('alibaba_video_image_browser_modal');
        modal.style.display = 'flex';
        if (!this.imageBrowser) {
            this.imageBrowser = new GenPageBrowserClass('alibaba_video_browser_container',
                (path, isRefresh, callback, depth) => this.listImagesForBrowser(path, isRefresh, callback, depth),
                'alibaba_video_image_browser', 'Thumbnails',
                (image) => this.describeBrowserImage(image),
                (image, div) => this.selectBrowserImage(image, div),
                '', 3);
            this.imageBrowser.allowMultiSelect = true;
        }
        this.imageBrowser.navigate('');
    }

    /** Closes the image browser modal. */
    closeImageBrowser() {
        getRequiredElementById('alibaba_video_image_browser_modal').style.display = 'none';
    }

    /** Lists images from the output history for the browser. */
    listImagesForBrowser(path, isRefresh, callback, depth) {
        genericRequest('ListImages', { path: path, depth: depth, sortBy: 'Name', sortReverse: false }, data => {
            let folders = data.folders ?? [];
            let files = (data.files ?? []).filter(f => {
                let lower = f.src.toLowerCase();
                return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp');
            });
            let mapped = files.map(file => {
                let fullSrc = `${getImageOutPrefix()}/${file.src}`;
                return { name: file.src, data: { src: fullSrc, fullsrc: fullSrc, name: file.src, metadata: file.metadata ?? '' } };
            });
            callback(folders, mapped);
        });
    }

    /** Describes an image for the browser tile display. */
    describeBrowserImage(image) {
        let parsedMeta = { is_starred: false, sui_image_params: null };
        if (image.data.metadata) {
            try {
                let readable = interpretMetadata(image.data.metadata);
                if (readable) {
                    parsedMeta = JSON.parse(readable) || parsedMeta;
                }
            }
            catch (e) {
            }
        }
        let baseName = image.data.name.split('/').pop();
        let aspectRatio = parsedMeta.sui_image_params?.width && parsedMeta.sui_image_params?.height
            ? parsedMeta.sui_image_params.width / parsedMeta.sui_image_params.height : null;
        return {
            name: image.data.name,
            description: '',
            buttons: [],
            image: `${image.data.src}?preview=true`,
            dragimage: image.data.src,
            className: parsedMeta.is_starred ? 'image-block-starred' : '',
            searchable: `${image.data.name}, ${image.data.metadata ?? ''}`,
            display: baseName,
            aspectRatio: aspectRatio
        };
    }

    /** Handles image selection in the browser. */
    selectBrowserImage(image, div) {
        let src = image.data.src;
        let idx = this.browserSelectedImages.findIndex(r => r.src == src);
        if (idx >= 0) {
            this.browserSelectedImages.splice(idx, 1);
            div.classList.remove('alibaba-video-browser-selected');
        }
        else {
            this.browserSelectedImages.push({ src: src, metadata: image.data.metadata ?? '' });
            div.classList.add('alibaba-video-browser-selected');
        }
        getRequiredElementById('alibaba_video_browser_count').textContent = `${this.browserSelectedImages.length} selected`;
    }

    /** Confirms the browser selection and adds images as references. */
    async confirmBrowserSelection() {
        for (let ref of this.browserSelectedImages) {
            try {
                let response = await fetch(ref.src);
                let blob = await response.blob();
                let dataUrl = await new Promise((resolve, reject) => {
                    let reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Failed to read image'));
                    reader.readAsDataURL(blob);
                });
                this.addSelectedRef(dataUrl, ref.src.split('/').pop(), ref.metadata);
            }
            catch (error) {
                showError(`Failed to load image: ${error.message}`);
            }
        }
        this.browserSelectedImages = [];
        getRequiredElementById('alibaba_video_browser_count').textContent = '0 selected';
        this.closeImageBrowser();
    }

    /** Adds a reference image thumbnail to the selected refs display. */
    addSelectedRef(dataUrl, name, metadata = '') {
        let item = createDiv(null, 'alibaba-video-ref-thumb');
        item.innerHTML = `<img src="${dataUrl}" alt="${escapeHtml(name)}" /><button class="alibaba-video-ref-remove" title="Remove">&times;</button><div class="alibaba-video-ref-name">${escapeHtml(name)}</div>`;
        item.querySelector('.alibaba-video-ref-remove').addEventListener('click', () => {
            item.remove();
            this.syncFileInput();
        });
        item.dataset.dataUrl = dataUrl;
        item.dataset.metadata = metadata ?? '';
        this.selectedRefsDiv.append(item);
        this.syncFileInput();
    }

    /** Syncs the file input with browser-selected images so generate() picks them up. */
    syncFileInput() {
        let dataTransfer = new DataTransfer();
        for (let item of this.selectedRefsDiv.querySelectorAll('.alibaba-video-ref-thumb')) {
            let dataUrl = item.dataset.dataUrl;
            let name = item.querySelector('.alibaba-video-ref-name')?.textContent ?? 'image.png';
            let byteString = atob(dataUrl.split(',')[1]);
            let mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
            let ab = new ArrayBuffer(byteString.length);
            let ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            let blob = new Blob([ab], { type: mimeString });
            dataTransfer.items.add(new File([blob], name, { type: mimeString }));
        }
        this.references.files = dataTransfer.files;
    }

    /** Updates reference-image requirements for the selected HappyHorse mode. */
    updateReferenceMode() {
        let model = this.model.value;
        if (model.endsWith('-t2v')) {
            this.referenceWrap.style.display = 'none';
            this.references.value = '';
            this.selectedRefsDiv.innerHTML = '';
        }
        else {
            this.referenceWrap.style.display = '';
            if (model.endsWith('-i2v')) {
                this.referenceLabel.textContent = 'First Frame Image';
                this.referenceHint.textContent = 'Upload exactly one image (PNG, JPEG, or WebP), or pick from history.';
                this.references.multiple = false;
            }
            else {
                this.referenceLabel.textContent = 'Reference Images';
                this.referenceHint.textContent = 'Upload 1–9 images, or pick from history. Refer to them as [Image 1], [Image 2], etc.';
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
