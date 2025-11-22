class ImageScrollerTab {
    constructor() {
        this.container = document.getElementById('image_scroller_container');
        this.backButton = document.getElementById('scroller_back_button');
        this.loadingIndicator = document.getElementById('scroller_loading_indicator');
        this.topTabBar = document.getElementById('toptablist');
        
        this.currentImages = [];
        this.isLoading = false;
        this.lastScrollY = 0;
        this.scrollTimeout = null;
        this.doubleTapTimeout = null;
        this.lastTapTime = 0;
        this.lastTapImage = null;
        
        this.initialized = false;
        this.currentPath = '';
        this.hasMore = true;
        
        this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
            root: this.container,
            rootMargin: '200px',
            threshold: 0.1
        });
    }

    initialize() {
        if (this.initialized) return;
        this.initialized = true;
        
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        this.backButton.addEventListener('click', this.goBack.bind(this));
        
        this.loadImages();
    }

    goBack() {
        let lastTab = localStorage.getItem('last_active_tab');
        if (!lastTab || lastTab === '#ImageScroller') {
            lastTab = '#Text2Image'; // Default to Generate tab
        }
        
        let tabButton = document.querySelector(`a[href="${lastTab}"]`);
        if (tabButton) {
            tabButton.click();
        }
        
        // Reset UI state
        this.topTabBar.classList.remove('scroller-topbar-hidden');
        this.backButton.classList.add('scroller-back-button-hidden');
    }

    handleScroll() {
        if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
        
        this.scrollTimeout = setTimeout(() => {
            const currentScrollY = this.container.scrollTop;
            
            // Show/hide top bar based on scroll direction
            if (currentScrollY > this.lastScrollY && currentScrollY > 50) {
                // Scrolling down
                this.topTabBar.classList.add('scroller-topbar-hidden');
                this.backButton.classList.remove('scroller-back-button-hidden');
            } else if (currentScrollY < this.lastScrollY) {
                // Scrolling up
                this.topTabBar.classList.remove('scroller-topbar-hidden');
                if (currentScrollY < 50) {
                    this.backButton.classList.add('scroller-back-button-hidden');
                }
            }
            
            this.lastScrollY = currentScrollY;
            
            // Infinite scroll
            if (this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight < 500) {
                this.loadImages();
            }
        }, 50);
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target.querySelector('img, video');
                if (img && img.dataset.src) {
                    img.src = img.dataset.src;
                    delete img.dataset.src;
                }
            }
        });
    }

    loadImages() {
        if (this.isLoading || !this.hasMore) return;
        
        this.isLoading = true;
        this.loadingIndicator.style.display = 'flex';
        
        // Use existing image history logic to fetch images
        // We'll fetch the root folder by default
        let path = this.currentPath;
        
        // Since the current API returns all files in a folder, we'll fetch once and then paginate locally
        if (this.allFiles && this.allFiles.length > 0) {
            this.processNextBatch();
            return;
        }

        // Increase depth to 2 to find images in subfolders
        listImageHistoryFolderAndFiles(path, false, (folders, files) => {
            if (!files) {
                this.isLoading = false;
                this.loadingIndicator.style.display = 'none';
                showToast(translate("Failed to load images"));
                return;
            }
            this.allFiles = files;
            this.processNextBatch();
        }, 2);
    }

    processNextBatch() {
        const batchSize = 20;
        const startIndex = this.currentImages.length;
        const nextBatch = this.allFiles.slice(startIndex, startIndex + batchSize);
        
        if (nextBatch.length === 0) {
            this.hasMore = false;
            this.isLoading = false;
            this.loadingIndicator.style.display = 'none';
            return;
        }
        
        nextBatch.forEach(file => {
            this.renderImage(file);
            this.currentImages.push(file);
        });
        
        this.isLoading = false;
        this.loadingIndicator.style.display = 'none';
        
        if (this.currentImages.length >= this.allFiles.length) {
            this.hasMore = false;
        }
    }

    renderImage(file) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'scroller-image-item';
        
        // file.data.src is the full URL, file.data.name is the relative path
        const src = file.data.src;
        const name = file.data.name;
        
        const isVideo = src.endsWith('.mp4') || src.endsWith('.webm');
        const element = isVideo ? document.createElement('video') : document.createElement('img');
        
        // Use lazy loading with IntersectionObserver
        element.dataset.src = src;
        if (isVideo) {
            element.loop = true;
            element.autoplay = true;
            element.muted = true;
        }
        
        itemDiv.appendChild(element);
        
        // Metadata Overlay
        const metadataOverlay = document.createElement('div');
        metadataOverlay.className = 'scroller-metadata-overlay';
        
        // Parse metadata
        let metadata = file.data.metadata;
        // interpretMetadata already returns an object or null, but let's be safe
        
        if (metadata && metadata.sui_image_params) {
            const params = metadata.sui_image_params;
            const prompt = params.prompt || '';
            const model = params.model || '';
            
            metadataOverlay.innerHTML = `
                <div class="scroller-metadata-text">
                    <strong>${escapeHtml(model)}</strong><br>
                    ${escapeHtml(prompt)}
                </div>
            `;
        }
        
        itemDiv.appendChild(metadataOverlay);
        
        // Action Buttons
        const actionsOverlay = document.createElement('div');
        actionsOverlay.className = 'scroller-actions-overlay';
        
        // Star Button
        let starBtn = null;
        if (permissions.hasPermission('user_star_images')) {
            starBtn = document.createElement('div');
            starBtn.className = 'scroller-action-button scroller-star-button';
            if (metadata && metadata.is_starred) {
                starBtn.classList.add('starred');
            }
            starBtn.innerHTML = '<i class="bi bi-heart-fill"></i>';
            starBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggleStar(name, starBtn);
            };
            actionsOverlay.appendChild(starBtn);
        }
        
        // Recycle Bin Button
        if (permissions.hasPermission('user_delete_image')) {
            const recycleBtn = document.createElement('div');
            recycleBtn.className = 'scroller-action-button scroller-recycle-button';
            recycleBtn.title = translate('Move to Recycle Bin');
            recycleBtn.innerHTML = '<i class="bi bi-trash"></i>';
            recycleBtn.onclick = (e) => {
                e.stopPropagation();
                this.moveToRecycleBin(name, itemDiv);
            };
            actionsOverlay.appendChild(recycleBtn);
        }
        
        itemDiv.appendChild(actionsOverlay);
        
        // Tap handler
        let lastTapTime = 0;
        itemDiv.addEventListener('click', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            
            if (tapLength < 300 && tapLength > 0) {
                // Double tap
                if (starBtn) {
                    this.toggleStar(name, starBtn);
                    this.showHeartAnimation(itemDiv);
                }
                e.preventDefault();
            } else {
                // Single tap (delayed to wait for potential double tap)
                setTimeout(() => {
                    const newTime = new Date().getTime();
                    if (newTime - lastTapTime >= 300) {
                        // Toggle overlays
                        if (metadataOverlay.style.opacity === '0') {
                            metadataOverlay.style.opacity = '1';
                            actionsOverlay.style.opacity = '1';
                        } else {
                            metadataOverlay.style.opacity = '0';
                            actionsOverlay.style.opacity = '0';
                        }
                    }
                }, 300);
            }
            
            lastTapTime = currentTime;
        });
        
        this.container.appendChild(itemDiv);
        this.observer.observe(itemDiv);
    }

    toggleStar(path, btnElement) {
        // Use existing API
        genericRequest('ToggleImageStarred', { 'path': path }, (data) => {
            if (data.error) {
                showToast(translate("Failed to toggle star: ") + data.error);
                return;
            }
            if (btnElement && typeof data.new_state === 'boolean') {
                if (data.new_state) {
                    btnElement.classList.add('starred');
                } else {
                    btnElement.classList.remove('starred');
                }
            }
        });
    }

    showHeartAnimation(container) {
        const heart = document.createElement('div');
        heart.className = 'scroller-heart-animation';
        heart.innerHTML = '<i class="bi bi-heart-fill"></i>';
        container.appendChild(heart);
        
        setTimeout(() => {
            heart.remove();
        }, 1000);
    }

    moveToRecycleBin(path, itemElement) {
        if (!confirm(translate("Are you sure you want to move this image to the recycle bin?"))) {
            return;
        }

        genericRequest('MoveImageToRecycleBin', { 'path': path }, (data) => {
            if (data.success) {
                itemElement.remove();
                // Remove from local list
                const index = this.currentImages.findIndex(f => f.data.name === path);
                if (index > -1) {
                    this.currentImages.splice(index, 1);
                }
                showToast(translate("Image moved to recycle bin"));
            } else {
                showToast(translate("Failed to move image"));
            }
        });
    }
}

window.imageScrollerTab = new ImageScrollerTab();
