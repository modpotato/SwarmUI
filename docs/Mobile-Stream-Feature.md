# Mobile Image Stream Feature

## Overview

The Mobile Image Stream feature provides a dedicated, mobile-first interface for browsing generated images in SwarmUI. It offers a TikTok-style fullscreen vertical scroller with infinite scroll, quick starring, and advanced filtering capabilities.

## Accessing the Feature

Navigate to `/Mobile/Stream` in your browser. The page will automatically redirect to login if authentication is required.

## Key Features

### 1. Fullscreen Vertical Scroller
- **TikTok-style Navigation**: Swipe or scroll vertically to move between images
- **Snap Scrolling**: Each image snaps to fullscreen for a clean viewing experience
- **Minimal UI**: Chrome-free design with overlay controls that can be hidden
- **Optimized for Mobile**: Respects safe areas on notched devices (iPhone X+, etc.)

### 2. Infinite Scroll
- Automatically loads more images as you scroll
- Cursor-based pagination for efficient loading
- Shows image counter (e.g., "5 / 100+")

### 3. Performance Optimizations

#### DOM Virtualization
- Only keeps ~15 images in the DOM at once (5 behind, current, 9 ahead)
- Prevents memory bloat during long scrolling sessions
- Automatically removes images outside the viewport

#### Prefetching
- Prefetches next 5 images ahead of current position
- Keeps 2 images behind for smooth backward scrolling
- Lazy loads images outside prefetch window

### 4. Star/Favorite System
- **Quick Star**: Tap the star button at bottom center
- **Visual Feedback**: Animated star pop on toggle
- **Persistent**: Changes sync with main SwarmUI starred system
- **Filtered View**: Can show only starred images via filter

### 5. Advanced Filtering

Access the filter drawer by tapping the filter icon (top right).

**Available Filters:**
- **Sort By**: Date or Name, ascending or descending
- **Starred Only**: Show only favorited images
- **Prompt Search**: Filter by text in image prompt
- **Model Search**: Filter by model name
- **LoRA Search**: Filter by LoRA name

**Filter Application:**
- Filters persist in URL for bookmarking
- Clears current images and reloads with filters applied
- Can clear all filters with "Clear Filters" button

### 6. Image Details

Tap the info icon (bottom left) to view detailed metadata:
- Prompt text
- Model name
- LoRAs used
- Image dimensions
- Steps
- CFG Scale
- Seed

### 7. Deep Linking

Share specific images using URL parameters:
```
/Mobile/Stream?image=path/to/image.jpg
```

The page will automatically scroll to the specified image.

### 8. Share Functionality

Tap the share icon (bottom right) to:
- Use native mobile share API (if available)
- Copy link to clipboard (fallback)
- Share includes deep link to specific image

### 9. UI Controls

**Top Bar:**
- Back button (left): Return to previous page
- Image counter (center): Shows current position
- Filter button (right): Open filter drawer

**Bottom Bar:**
- Info button (left): Show image details
- Star button (center): Toggle favorite
- Share button (right): Share current image

**Gesture Controls:**
- **Single Tap**: Toggle UI visibility
- **Double Tap**: Quick star/unstar
- **Vertical Scroll**: Navigate between images
- **Swipe Down on Drawer**: Close drawer

## Technical Implementation

### Frontend

**Files:**
- `/src/Pages/Mobile/Stream.cshtml` - Razor page
- `/src/wwwroot/css/mobile-stream.css` - Mobile-optimized styles
- `/src/wwwroot/js/mobile-stream.js` - Client-side logic

**JavaScript Features:**
- Event-driven architecture
- Debounced scroll handling
- Efficient DOM manipulation
- Cookie-based session management

### Backend

**API Endpoint:**
- `POST /API/ListImagesMobile` - Paginated image listing

**Parameters:**
```json
{
  "cursor": "string|null",
  "limit": 30,
  "sort_by": "Date|Name",
  "sort_reverse": true|false,
  "starred_only": true|false,
  "prompt_search": "string",
  "model_search": "string",
  "lora_search": "string"
}
```

**Response:**
```json
{
  "images": [
    {
      "src": "relative/path/to/image.jpg",
      "metadata": "{\"prompt\":\"...\", \"model\":\"...\"}"
    }
  ],
  "next_cursor": "path:offset",
  "has_more": true|false
}
```

**Implementation Details:**
- Cursor format: `"path:offset"` for pagination
- Filters applied server-side for efficiency
- Metadata parsed from image sidecar files
- Supports both Name and Date sorting

## Browser Compatibility

**Recommended:**
- iOS Safari 14+
- Chrome Mobile 90+
- Firefox Mobile 88+

**Features:**
- CSS Scroll Snap (for smooth scrolling)
- Viewport units (dvh for dynamic viewport height)
- CSS env() (for safe area insets)
- Native Share API (with clipboard fallback)

## Performance Tips

1. **Smooth Scrolling**: The virtualization keeps memory usage low even with thousands of images
2. **Network Usage**: Images are only loaded when needed via prefetching
3. **Battery Efficient**: Debounced scroll events reduce CPU usage
4. **Mobile Data**: Consider filtering to reduce image count on cellular

## Future Enhancements

Potential improvements:
- Gesture support for more actions (swipe left/right for next folder)
- Keyboard shortcuts for desktop
- Batch operations (multi-select and delete)
- Video support with inline playback
- Custom filter presets
- Image comparison mode (side-by-side)

## Troubleshooting

**Images not loading:**
- Check network connection
- Verify session is valid (check cookies)
- Ensure image files exist in output directory

**Slow performance:**
- Clear browser cache
- Reduce prefetch settings if on slow device
- Use filters to reduce total image count

**Filter not working:**
- Verify metadata exists for images
- Check that metadata is in expected JSON format
- Try simpler filters first (starred only)

**Scroll not snapping:**
- Update to modern browser version
- Check if scroll-snap-type is supported
- Try refreshing the page

## Support

For issues or feature requests, please file an issue on the SwarmUI GitHub repository.
