// Mobile Stream JavaScript - TikTok-style image scroller
(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        PREFETCH_AHEAD: 5,      // Number of images to prefetch ahead
        PREFETCH_BEHIND: 2,     // Number of images to keep behind
        VIRTUALIZE_WINDOW: 15,  // Total DOM elements to keep (prev + current + next)
        API_PAGE_SIZE: 30,      // Images to fetch per API call
        SCROLL_DEBOUNCE: 100    // ms
    };

    // State management
    const state = {
        images: [],              // All loaded image metadata
        currentIndex: 0,         // Current visible image index
        cursor: null,            // API cursor for pagination
        hasMore: true,           // Whether more images available
        isLoading: false,        // Loading flag
        filters: {
            sortBy: 'date',
            sortReverse: true,
            starredOnly: false,
            promptSearch: '',
            modelSearch: '',
            loraSearch: ''
        },
        sessionId: null
    };

    // DOM elements
    const elements = {};

    // Utility: Build image URL with proper encoding per path segment
    function buildImageUrl(imageSrc) {
        if (!imageSrc) return '';
        // Split path into segments and encode each one separately
        const segments = imageSrc.split('/');
        const encodedSegments = segments.map(seg => encodeURIComponent(seg));
        return `/View/${encodedSegments.join('/')}`;
    }

    // Initialize
    function init() {
        // Cache DOM elements
        elements.container = document.getElementById('mobile-stream-container');
        elements.scroller = document.getElementById('image-scroller');
        elements.topBar = document.getElementById('top-bar');
        elements.bottomBar = document.getElementById('bottom-bar');
        elements.counter = document.getElementById('image-counter');
        elements.starButton = document.getElementById('star-button');
        elements.filterButton = document.getElementById('filter-button');
        elements.infoButton = document.getElementById('info-button');
        elements.backButton = document.getElementById('back-button');
        elements.shareButton = document.getElementById('share-button');
        elements.filterDrawer = document.getElementById('filter-drawer');
        elements.infoDrawer = document.getElementById('info-drawer');
        elements.loadingSpinner = document.getElementById('loading-spinner');

        // Get session ID from cookie
        state.sessionId = getCookie('session_id');

        // Parse URL parameters
        parseURLParameters();

        // Setup event listeners
        setupEventListeners();

        // Load initial images
        loadMoreImages().then(() => {
            // If deep link to specific image, scroll to it
            const urlParams = new URLSearchParams(window.location.search);
            const imageParam = urlParams.get('image');
            if (imageParam) {
                const index = state.images.findIndex(img => img.src === imageParam);
                if (index >= 0) {
                    scrollToIndex(index);
                }
            }
        });
    }

    function parseURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Parse filters from URL
        if (urlParams.has('starred')) {
            state.filters.starredOnly = urlParams.get('starred') === 'true';
        }
        if (urlParams.has('sort')) {
            const sort = urlParams.get('sort');
            if (sort === 'date-asc') {
                state.filters.sortBy = 'date';
                state.filters.sortReverse = false;
            } else if (sort === 'date-desc') {
                state.filters.sortBy = 'date';
                state.filters.sortReverse = true;
            } else if (sort === 'name-asc') {
                state.filters.sortBy = 'name';
                state.filters.sortReverse = false;
            } else if (sort === 'name-desc') {
                state.filters.sortBy = 'name';
                state.filters.sortReverse = true;
            }
        }
    }

    function setupEventListeners() {
        // Scroll handling with debounce
        let scrollTimeout;
        elements.scroller.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(handleScroll, CONFIG.SCROLL_DEBOUNCE);
        });

        // Star button
        elements.starButton.addEventListener('click', toggleStar);

        // Filter button
        elements.filterButton.addEventListener('click', () => openDrawer('filter'));

        // Info button
        elements.infoButton.addEventListener('click', () => openDrawer('info'));

        // Back button
        elements.backButton.addEventListener('click', () => {
            window.history.back();
        });

        // Share button
        elements.shareButton.addEventListener('click', shareCurrentImage);

        // Filter drawer controls
        document.getElementById('apply-filters').addEventListener('click', applyFilters);
        document.getElementById('clear-filters').addEventListener('click', clearFilters);

        // Drawer backdrop (close on click)
        createDrawerBackdrop();

        // Drawer swipe to close
        setupDrawerSwipe();

        // Hide bars on tap (optional)
        let lastTap = 0;
        elements.scroller.addEventListener('click', (e) => {
            const now = Date.now();
            if (now - lastTap < 300) {
                // Double tap on star button
                toggleStar();
            } else {
                // Single tap toggles UI
                toggleUI();
            }
            lastTap = now;
        });

        // Prevent pull-to-refresh on some browsers
        document.body.addEventListener('touchmove', (e) => {
            if (elements.scroller.scrollTop === 0 && e.touches[0].clientY > 0) {
                // At top of scroll, prevent overscroll
                // e.preventDefault(); // Commented out to allow normal scroll behavior
            }
        }, { passive: true });
    }

    function createDrawerBackdrop() {
        const backdrop = document.createElement('div');
        backdrop.className = 'drawer-backdrop';
        backdrop.id = 'drawer-backdrop';
        backdrop.addEventListener('click', closeAllDrawers);
        elements.container.appendChild(backdrop);
        elements.backdrop = backdrop;
    }

    function setupDrawerSwipe() {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const handleStart = (e) => {
            if (e.target.closest('.drawer-handle')) {
                isDragging = true;
                startY = e.touches ? e.touches[0].clientY : e.clientY;
                currentY = startY;
            }
        };

        const handleMove = (e) => {
            if (!isDragging) return;
            currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0) {
                // Dragging down
                const drawer = document.querySelector('.drawer.open');
                if (drawer) {
                    drawer.style.transform = `translateY(${deltaY}px)`;
                }
            }
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            
            const deltaY = currentY - startY;
            const drawer = document.querySelector('.drawer.open');
            
            if (drawer) {
                if (deltaY > 100) {
                    // Close drawer
                    closeAllDrawers();
                } else {
                    // Snap back
                    drawer.style.transform = '';
                }
            }
        };

        document.addEventListener('touchstart', handleStart, { passive: true });
        document.addEventListener('touchmove', handleMove, { passive: true });
        document.addEventListener('touchend', handleEnd, { passive: true });
    }

    async function loadMoreImages() {
        if (state.isLoading || !state.hasMore) return;
        
        state.isLoading = true;
        elements.loadingSpinner.style.display = 'block';
        
        try {
            const response = await fetch('/API/ListImagesMobile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: state.sessionId,
                    cursor: state.cursor,
                    limit: CONFIG.API_PAGE_SIZE,
                    sort_by: state.filters.sortBy === 'date' ? 'Date' : 'Name',
                    sort_reverse: state.filters.sortReverse,
                    starred_only: state.filters.starredOnly,
                    prompt_search: state.filters.promptSearch,
                    model_search: state.filters.modelSearch,
                    lora_search: state.filters.loraSearch
                })
            });

            if (!response.ok) {
                throw new Error('Failed to load images');
            }

            const data = await response.json();
            
            if (data.images && data.images.length > 0) {
                const startIndex = state.images.length;
                state.images.push(...data.images);
                state.cursor = data.next_cursor;
                state.hasMore = data.has_more;

                // Render new images
                renderImages(startIndex, data.images.length);
            } else {
                state.hasMore = false;
            }
        } catch (error) {
            console.error('Error loading images:', error);
            showError('Failed to load images. Please try again.');
        } finally {
            state.isLoading = false;
            elements.loadingSpinner.style.display = 'none';
        }
    }

    function renderImages(startIndex, count) {
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < count; i++) {
            const index = startIndex + i;
            const imageData = state.images[index];
            
            const slide = createImageSlide(imageData, index);
            fragment.appendChild(slide);
        }

        elements.scroller.appendChild(fragment);
        updateCounter();
    }

    function createImageSlide(imageData, index) {
        const slide = document.createElement('div');
        slide.className = 'image-slide loading';
        slide.dataset.index = index;
        slide.dataset.src = imageData.src;

        const img = document.createElement('img');
        img.alt = 'Generated image';
        img.loading = 'lazy';
        
        // Add load event
        img.addEventListener('load', () => {
            slide.classList.remove('loading');
            slide.dataset.loaded = 'true';
        });

        img.addEventListener('error', () => {
            slide.classList.remove('loading');
            slide.classList.add('error');
        });

        // Set image source with proper URL encoding
        img.src = buildImageUrl(imageData.src);
        
        slide.appendChild(img);
        return slide;
    }

    function handleScroll() {
        // Find current visible image
        const scrollTop = elements.scroller.scrollTop;
        const viewportHeight = window.innerHeight;
        const currentSlide = Math.round(scrollTop / viewportHeight);
        
        if (currentSlide !== state.currentIndex) {
            state.currentIndex = currentSlide;
            updateCounter();
            updateStarButton();
            prefetchImages();
            virtualizeDOM();
        }

        // Load more if near end
        if (state.currentIndex >= state.images.length - CONFIG.PREFETCH_AHEAD) {
            loadMoreImages();
        }
    }

    function prefetchImages() {
        // Prefetch images ahead and behind
        const start = Math.max(0, state.currentIndex - CONFIG.PREFETCH_BEHIND);
        const end = Math.min(state.images.length, state.currentIndex + CONFIG.PREFETCH_AHEAD + 1);

        for (let i = start; i < end; i++) {
            const slide = elements.scroller.querySelector(`[data-index="${i}"]`);
            if (slide && !slide.dataset.prefetched) {
                const img = slide.querySelector('img');
                if (img && !img.complete) {
                    // Force load by setting src if lazy
                    if (img.loading === 'lazy') {
                        img.loading = 'eager';
                    }
                }
                slide.dataset.prefetched = 'true';
            }
        }
    }

    function virtualizeDOM() {
        // Remove slides outside the virtualization window
        const slides = elements.scroller.querySelectorAll('.image-slide');
        const windowStart = Math.max(0, state.currentIndex - Math.floor(CONFIG.VIRTUALIZE_WINDOW / 2));
        const windowEnd = windowStart + CONFIG.VIRTUALIZE_WINDOW;

        slides.forEach((slide) => {
            const index = parseInt(slide.dataset.index);
            if (index < windowStart || index >= windowEnd) {
                // Keep the element but remove image to save memory
                const img = slide.querySelector('img');
                if (img && img.src) {
                    img.removeAttribute('src');
                    slide.classList.add('loading');
                    slide.removeAttribute('data-loaded');
                    slide.removeAttribute('data-prefetched');
                }
            } else if (!slide.dataset.loaded && !slide.classList.contains('loading')) {
                // Re-load if needed
                const img = slide.querySelector('img');
                const imageData = state.images[index];
                if (img && imageData) {
                    img.src = buildImageUrl(imageData.src);
                    slide.classList.add('loading');
                }
            }
        });
    }

    function updateCounter() {
        const current = state.currentIndex + 1;
        const total = state.images.length + (state.hasMore ? '+' : '');
        elements.counter.textContent = `${current} / ${total}`;
    }

    function updateStarButton() {
        if (state.currentIndex >= 0 && state.currentIndex < state.images.length) {
            const imageData = state.images[state.currentIndex];
            const isStarred = imageData.src.startsWith('Starred/');
            
            if (isStarred) {
                elements.starButton.classList.add('starred');
            } else {
                elements.starButton.classList.remove('starred');
            }
        }
    }

    async function toggleStar() {
        if (state.currentIndex < 0 || state.currentIndex >= state.images.length) return;

        const imageData = state.images[state.currentIndex];
        
        try {
            const response = await fetch('/API/ToggleImageStarred', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: state.sessionId,
                    path: imageData.src
                })
            });

            if (!response.ok) {
                throw new Error('Failed to toggle star');
            }

            const result = await response.json();
            
            // Update local state
            if (result.new_state) {
                elements.starButton.classList.add('starred');
                // Update image path if not in Starred folder
                if (!imageData.src.startsWith('Starred/')) {
                    imageData.src = 'Starred/' + imageData.src;
                }
            } else {
                elements.starButton.classList.remove('starred');
                // Update image path if in Starred folder
                if (imageData.src.startsWith('Starred/')) {
                    imageData.src = imageData.src.substring('Starred/'.length);
                }
            }
        } catch (error) {
            console.error('Error toggling star:', error);
            showError('Failed to star image');
        }
    }

    function toggleUI() {
        elements.topBar.classList.toggle('hidden');
        elements.bottomBar.classList.toggle('hidden');
    }

    function openDrawer(type) {
        closeAllDrawers();
        
        if (type === 'filter') {
            // Populate current filter values
            document.getElementById('sort-select').value = 
                `${state.filters.sortBy}-${state.filters.sortReverse ? 'desc' : 'asc'}`;
            document.getElementById('starred-only').checked = state.filters.starredOnly;
            document.getElementById('prompt-search').value = state.filters.promptSearch;
            document.getElementById('model-search').value = state.filters.modelSearch;
            document.getElementById('lora-search').value = state.filters.loraSearch;
            
            elements.filterDrawer.classList.add('open');
        } else if (type === 'info') {
            updateInfoDrawer();
            elements.infoDrawer.classList.add('open');
        }
        
        elements.backdrop.classList.add('visible');
    }

    function closeAllDrawers() {
        elements.filterDrawer.classList.remove('open');
        elements.infoDrawer.classList.remove('open');
        elements.backdrop.classList.remove('visible');
        
        // Reset any inline transforms from swiping
        elements.filterDrawer.style.transform = '';
        elements.infoDrawer.style.transform = '';
    }

    function updateInfoDrawer() {
        if (state.currentIndex < 0 || state.currentIndex >= state.images.length) return;

        const imageData = state.images[state.currentIndex];
        let metadata = {};
        
        try {
            metadata = JSON.parse(imageData.metadata || '{}');
        } catch (e) {
            console.warn('Failed to parse metadata:', e);
        }

        document.getElementById('info-prompt').textContent = metadata.prompt || '-';
        document.getElementById('info-model').textContent = metadata.model || metadata.Model || '-';
        
        // Extract LoRAs
        const loras = [];
        if (metadata.loras) {
            loras.push(...metadata.loras);
        }
        if (metadata.LoRAs) {
            loras.push(...metadata.LoRAs);
        }
        document.getElementById('info-loras').textContent = loras.length > 0 ? loras.join(', ') : '-';
        
        document.getElementById('info-dimensions').textContent = 
            metadata.width && metadata.height ? `${metadata.width} × ${metadata.height}` : '-';
        document.getElementById('info-steps').textContent = metadata.steps || metadata.Steps || '-';
        document.getElementById('info-cfg').textContent = metadata.cfg_scale || metadata['CFG Scale'] || '-';
        document.getElementById('info-seed').textContent = metadata.seed || metadata.Seed || '-';
    }

    async function applyFilters() {
        // Read filter values
        const sortValue = document.getElementById('sort-select').value;
        const [sortBy, sortOrder] = sortValue.split('-');
        
        state.filters.sortBy = sortBy;
        state.filters.sortReverse = sortOrder === 'desc';
        state.filters.starredOnly = document.getElementById('starred-only').checked;
        state.filters.promptSearch = document.getElementById('prompt-search').value.trim();
        state.filters.modelSearch = document.getElementById('model-search').value.trim();
        state.filters.loraSearch = document.getElementById('lora-search').value.trim();

        // Update URL
        updateURLWithFilters();

        // Reset and reload
        state.images = [];
        state.cursor = null;
        state.hasMore = true;
        state.currentIndex = 0;
        elements.scroller.innerHTML = '';
        elements.loadingSpinner.style.display = 'block';
        
        closeAllDrawers();
        await loadMoreImages();
        
        if (state.images.length > 0) {
            scrollToIndex(0);
        }
    }

    function clearFilters() {
        state.filters = {
            sortBy: 'date',
            sortReverse: true,
            starredOnly: false,
            promptSearch: '',
            modelSearch: '',
            loraSearch: ''
        };
        
        applyFilters();
    }

    function updateURLWithFilters() {
        const params = new URLSearchParams();
        
        if (state.filters.starredOnly) {
            params.set('starred', 'true');
        }
        
        const sortValue = `${state.filters.sortBy}-${state.filters.sortReverse ? 'desc' : 'asc'}`;
        if (sortValue !== 'date-desc') {
            params.set('sort', sortValue);
        }

        const newURL = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
        window.history.replaceState({}, '', newURL);
    }

    function scrollToIndex(index) {
        const viewportHeight = window.innerHeight;
        elements.scroller.scrollTop = index * viewportHeight;
        state.currentIndex = index;
        updateCounter();
        updateStarButton();
    }

    function shareCurrentImage() {
        if (state.currentIndex < 0 || state.currentIndex >= state.images.length) return;

        const imageData = state.images[state.currentIndex];
        const shareURL = `${window.location.origin}/Mobile/Stream?image=${encodeURIComponent(imageData.src)}`;

        if (navigator.share) {
            navigator.share({
                title: 'SwarmUI Generated Image',
                url: shareURL
            }).catch(err => console.log('Share cancelled:', err));
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareURL).then(() => {
                showMessage('Link copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }
    }

    function showError(message) {
        // Simple error display (could be improved with a toast)
        console.error(message);
        alert(message);
    }

    function showMessage(message) {
        // Simple message display (could be improved with a toast)
        console.log(message);
        // Could implement a toast notification here
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
