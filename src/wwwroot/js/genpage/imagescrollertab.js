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
        this.isScrolling = false;
        this.scrollAlignTimeout = null;

        // Swipe gesture state
        this.swipeStartX = null;
        this.swipeStartY = null;
        this.swipeCurrentX = 0;
        this.swipingItem = null;
        this.swipeThreshold = Math.max(100, window.innerWidth * 0.3);

        this.initialized = false;
        this.currentPath = 'raw';
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
        // Add touchstart listener to detect user interaction and cancel auto-scroll
        this.container.addEventListener('touchstart', () => {
            this.isScrolling = true;
            if (this.scrollAlignTimeout) clearTimeout(this.scrollAlignTimeout);
        }, { passive: true });

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
        this.isScrolling = true;
        if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
        if (this.scrollAlignTimeout) clearTimeout(this.scrollAlignTimeout);

        const currentScrollY = this.container.scrollTop;

        // Debounce for UI updates (UI bars)
        this.scrollTimeout = setTimeout(() => {
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

        // Debounce for Magnetic Alignment (Instagram-y feel)
        this.scrollAlignTimeout = setTimeout(() => {
            this.isScrolling = false;
            this.alignToNearestImage();
        }, 150); // Wait for scroll to settle
    }

    alignToNearestImage() {
        if (this.isScrolling) return;

        const containerHeight = this.container.clientHeight;
        const scrollTop = this.container.scrollTop;

        // Find the image closest to being centered
        // Since all items are 100vh (containerHeight), simple math works
        const index = Math.round(scrollTop / containerHeight);
        const targetScrollTop = index * containerHeight;

        // If we are close enough, don't jitter
        if (Math.abs(scrollTop - targetScrollTop) < 10) return;

        // Smooth scroll to target
        this.container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
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

        genericRequest('ListImagesRecursive', {
            'path': this.currentPath,
            'offset': this.currentImages.length,
            'limit': 10,
            'sortBy': 'Date',
            'sortReverse': true
        }, data => {
            if (data.error) {
                console.log("Error loading images: " + data.error);
                // Fallback to root if raw fails (e.g. first run)
                if (this.currentPath == 'raw') {
                    this.currentPath = '';
                    this.isLoading = false;
                    this.loadImages();
                    return;
                }
                this.isLoading = false;
                this.loadingIndicator.style.display = 'none';
                showToast(translate("Failed to load images"));
                return;
            }

            if (!data.files || data.files.length === 0) {
                if (this.currentPath == 'raw' && this.currentImages.length == 0) {
                    // If raw is empty, try root
                    this.currentPath = '';
                    this.isLoading = false;
                    this.loadImages();
                    return;
                }
                this.hasMore = false;
                this.isLoading = false;
                this.loadingIndicator.style.display = 'none';
                return;
            }

            this.hasMore = data.hasMore;

            data.files.forEach(file => {
                this.renderImage(file);
                this.currentImages.push(file);
            });

            this.isLoading = false;
            this.loadingIndicator.style.display = 'none';
        });
    }

    renderImage(file) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'scroller-image-item';

        const src = getImageOutPrefix() + '/' + file.src;
        const name = file.src;

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
        this.setupSwipeHandlers(itemDiv, name);

        // Metadata Overlay
        const metadataOverlay = document.createElement('div');
        metadataOverlay.className = 'scroller-metadata-overlay';

        // Parse metadata
        let metadata = interpretMetadata(file.metadata);

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
                e.preventDefault(); // Prevent double-triggering from tap handler checks
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
                e.preventDefault();
                e.stopPropagation();
                this.moveToRecycleBin(name, itemDiv);
            };
            actionsOverlay.appendChild(recycleBtn);
        }

        itemDiv.appendChild(actionsOverlay);

        // Tap handler
        let lastTapTime = 0;

        const handleTap = (e) => {
            if (this.swipingItem !== null) return;

            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;

            // Allow up to 500ms for double tap, more generous for accessibility
            if (tapLength < 500 && tapLength > 50) { // > 50 to prevent bounce
                // Double tap
                if (starBtn) {
                    // Check if star request is already flying? handled by backend usually, but for UI feedback:
                    this.toggleStar(name, starBtn);
                    this.showHeartAnimation(itemDiv);
                }

                if (e.cancelable) e.preventDefault();
                // Reset to avoid triple-tap triggering another single tap logic
                lastTapTime = 0;
            } else {
                // Single tap (delayed to wait for potential double tap)
                // If it was a double-tap, lastTapTime was reset, so this timeout check logic is a bit tricky
                // Better approach: store the time we are checking against
                const tapTime = currentTime;

                setTimeout(() => {
                    const newTime = new Date().getTime();
                    // If no new tap happened (lastTapTime is still the same as when we set it)
                    // OR if it's been long enough
                    if (lastTapTime === tapTime) {
                        // Toggle overlays
                        if (metadataOverlay.style.opacity === '0') {
                            metadataOverlay.style.opacity = '1';
                            actionsOverlay.style.opacity = '1';
                        } else {
                            metadataOverlay.style.opacity = '0';
                            actionsOverlay.style.opacity = '0';
                        }
                    }
                }, 500);

                lastTapTime = currentTime;
            }
        };

        itemDiv.addEventListener('click', handleTap);
        itemDiv.addEventListener('touchend', (e) => {
            // Only handle if it's a tap (not a swipe)
            if (this.swipingItem === null && Math.abs(this.swipeCurrentX) < 10) {
                handleTap(e);
                if (e.cancelable) e.preventDefault();
            }
        });

        this.setupSwipeHandlers(itemDiv, name);

        this.container.appendChild(itemDiv);
        this.observer.observe(itemDiv);
    }

    setupSwipeHandlers(itemDiv, imageName) {
        // Create delete indicator
        const deleteIndicator = document.createElement('div');
        deleteIndicator.className = 'scroller-delete-indicator';
        deleteIndicator.innerHTML = '<i class="bi bi-trash-fill"></i>';
        itemDiv.appendChild(deleteIndicator);

        let touchStartTime = 0;

        itemDiv.addEventListener('touchstart', (e) => {
            this.swipeStartX = e.touches[0].clientX;
            this.swipeStartY = e.touches[0].clientY;
            this.swipingItem = itemDiv;
            this.swipeCurrentX = 0;
            touchStartTime = Date.now();
            // Don't add 'swiping' class yet to avoid interfering with scroll snap
        }, { passive: true });

        itemDiv.addEventListener('touchmove', (e) => {
            if (!this.swipeStartX || this.swipingItem !== itemDiv) return;

            const deltaX = e.touches[0].clientX - this.swipeStartX;
            const deltaY = Math.abs(e.touches[0].clientY - this.swipeStartY);

            // Only handle left swipe
            if (Math.abs(deltaX) > deltaY && deltaX < 0) {
                if (e.cancelable) e.preventDefault();

                if (!itemDiv.classList.contains('swiping')) {
                    itemDiv.classList.add('swiping');
                }

                this.swipeCurrentX = deltaX;
                itemDiv.style.transform = `translateX(${deltaX}px)`;

                const progress = Math.min(1, Math.abs(deltaX) / this.swipeThreshold);
                itemDiv.style.setProperty('--swipe-progress', progress);
            }
        }, { passive: false });

        const endSwipe = (e) => {
            if (!this.swipingItem) return;

            if (Math.abs(this.swipeCurrentX) > 10 && e.type === 'touchend') {
                e.stopImmediatePropagation();
            }

            const touchDuration = Date.now() - touchStartTime;
            const velocity = Math.abs(this.swipeCurrentX) / touchDuration;
            // Velocity check: > 0.5px/ms and moved at least 50px
            const isFastSwipe = velocity > 0.5 && Math.abs(this.swipeCurrentX) > 50;

            // Remove swiping class immediately to enable transition for the animation
            itemDiv.classList.remove('swiping');

            if (Math.abs(this.swipeCurrentX) > this.swipeThreshold || isFastSwipe) {
                // Complete swipe
                this.moveToRecycleBin(imageName, itemDiv, true, true);
                itemDiv.style.transform = 'translateX(-100%)';
                setTimeout(() => itemDiv.remove(), 300);
            } else {
                // Cancel swipe
                itemDiv.style.transform = 'translateX(0)';
                setTimeout(() => {
                    itemDiv.style.removeProperty('--swipe-progress');
                }, 300);
            }

            this.swipeStartX = null;
            this.swipeStartY = null;
            this.swipingItem = null;
            this.swipeCurrentX = 0;
        };

        itemDiv.addEventListener('touchend', endSwipe);
        itemDiv.addEventListener('touchcancel', endSwipe);
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

    moveToRecycleBin(path, itemElement, skipConfirm = false, skipDomRemove = false) {
        if (!skipConfirm && !confirm(translate("Are you sure you want to move this image to the recycle bin?"))) {
            return;
        }

        genericRequest('MoveImageToRecycleBin', { 'path': path }, (data) => {
            if (data.success) {
                if (!skipDomRemove) {
                    itemElement.remove();
                }
                // Remove from local list
                const index = this.currentImages.findIndex(f => f.data.name === path);
                if (index > -1) {
                    this.currentImages.splice(index, 1);
                }
                showToast(translate("Image deleted"));
            } else {
                showToast(translate("Failed to move image"));
            }
        });
    }
}

window.imageScrollerTab = new ImageScrollerTab();
