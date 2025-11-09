# Mobile Stream UI Mockup

## Visual Layout

```
┌─────────────────────────────────┐
│ ◄ Back     15 / 100+    ⚙ Filter│  <- Top Bar (overlay)
│                                  │
│                                  │
│                                  │
│         ┌─────────────┐          │
│         │             │          │
│         │   Image     │          │  <- Fullscreen Image
│         │   Content   │          │     (vertically centered)
│         │             │          │
│         └─────────────┘          │
│                                  │
│                                  │
│                                  │
│   ⓘ Info     ★ Star    ⤴ Share │  <- Bottom Bar (overlay)
└─────────────────────────────────┘
```

## Interaction States

### Normal View
- Image takes full screen
- Top and bottom bars visible with semi-transparent background
- User can swipe/scroll vertically to next/previous image

### UI Hidden (after tap)
- Bars fade out
- Maximum screen space for image viewing
- Another tap brings bars back

### Filter Drawer Open
```
┌─────────────────────────────────┐
│ ◄ Back     15 / 100+    ⚙ Filter│
│                                  │
│         Current Image            │
│                                  │
├─────────────────────────────────┤
│ ═══ (handle)                    │  <- Swipeable Drawer
│                                  │
│ Filter Images                    │
│                                  │
│ Sort By: [Newest First    ▼]    │
│                                  │
│ □ Show Starred Only              │
│                                  │
│ Search Prompt                    │
│ [____________________]           │
│                                  │
│ Model                            │
│ [____________________]           │
│                                  │
│ LoRA                             │
│ [____________________]           │
│                                  │
│ [Clear Filters] [Apply]          │
└─────────────────────────────────┘
```

### Info Drawer Open
```
┌─────────────────────────────────┐
│ ◄ Back     15 / 100+    ⚙ Filter│
│                                  │
│         Current Image            │
│                                  │
├─────────────────────────────────┤
│ ═══ (handle)                    │  <- Swipeable Drawer
│                                  │
│ Image Details                    │
│                                  │
│ PROMPT:                          │
│ A beautiful landscape with...    │
│                                  │
│ MODEL:                           │
│ SDXL_Base_1.0                   │
│                                  │
│ LORAS:                           │
│ DetailTweaker, StyleEnhancer     │
│                                  │
│ DIMENSIONS:                      │
│ 1024 × 1024                      │
│                                  │
│ STEPS: 30    CFG SCALE: 7.5     │
│ SEED: 1234567890                 │
└─────────────────────────────────┘
```

## Color Scheme

### Dark Theme (Default for Mobile)
- Background: `#000000` (pure black for OLED)
- Overlay bars: `rgba(0,0,0,0.7)` (semi-transparent)
- Drawer background: `#1a1a1a` (dark gray)
- Text: `#ffffff` (white)
- Accent: `#4a9eff` (blue for buttons)
- Star color: `#ffd700` (gold)

### Overlays
- Top bar gradient: `linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)`
- Bottom bar gradient: `linear-gradient(to top, rgba(0,0,0,0.7), transparent)`
- Drop shadows on icons for better visibility

## Icons

All icons are SVG-based with 24x24 or 32x32 viewport:

- **Back**: Left arrow
- **Filter**: Funnel icon
- **Info**: Circle with 'i'
- **Star**: Outline when not starred, filled when starred
- **Share**: Upload/share icon

## Typography

- **Image Counter**: 14px, medium weight
- **Drawer Titles**: 20px, bold
- **Labels**: 12px, uppercase, semibold
- **Values**: 14px, regular
- **Buttons**: 16px, semibold

## Spacing

- Top bar padding: 12px + safe area inset
- Bottom bar padding: 12px + safe area inset
- Drawer padding: 20px horizontal
- Filter sections: 20px margin bottom
- Button gaps: 12px

## Animations

### Star Animation
```
Scale: 0.5 → 1.2 → 1.0
Duration: 300ms
Easing: ease
Color: white → gold
```

### Drawer Open/Close
```
Transform: translateY(100%) → translateY(0)
Duration: 300ms
Easing: ease
```

### UI Toggle
```
Opacity: 1 → 0 or 0 → 1
Transform: translateY(-100%) or translateY(100%)
Duration: 300ms
Easing: ease
```

### Image Load
```
Opacity: 0.5 → 1
Scale: 0.95 → 1
Duration: 300ms
Easing: ease
```

## Responsive Breakpoints

While designed for mobile, the interface adapts:

- **Mobile Portrait**: 320px - 480px (optimal)
- **Mobile Landscape**: 480px - 768px (adjusted spacing)
- **Tablet**: 768px+ (could show side-by-side in future)

## Touch Targets

All interactive elements meet accessibility guidelines:

- Minimum size: 44px × 44px
- Padding around icons: 8px minimum
- Drawer handle: 40px × 20px (larger for easier grab)

## Gesture Recognition

### Vertical Scroll
- Native scroll behavior with snap points
- Each image is exactly 100vh (dynamic viewport height)
- Scroll snapping ensures one image is always centered

### Horizontal Swipe (on drawer handle)
- Recognizes downward drag on handle
- Follows finger with drag
- Snaps closed if dragged > 100px
- Snaps back if < 100px

### Tap Detection
- Single tap: Toggle UI (debounced, 300ms)
- Double tap: Star/unstar (within 300ms)

## Loading States

### Initial Load
```
┌─────────────────────────────────┐
│                                  │
│                                  │
│                                  │
│          ⟳ Spinner               │
│      Loading images...           │
│                                  │
│                                  │
│                                  │
└─────────────────────────────────┘
```

### Image Loading
- Individual images show spinner overlay
- Border pulse effect (optional)
- Fade in when loaded

### Infinite Scroll Loading
- Spinner appears at bottom when loading more
- Seamless addition of new images
- No interruption to current view

## Error States

### No Images
```
┌─────────────────────────────────┐
│ ◄ Back      0 / 0       ⚙ Filter│
│                                  │
│                                  │
│         📷                        │
│    No images found               │
│                                  │
│   Try adjusting filters or       │
│   generate some images first     │
│                                  │
│                                  │
└─────────────────────────────────┘
```

### Load Error
```
┌─────────────────────────────────┐
│           ⚠                      │
│   Failed to load images          │
│                                  │
│    [Retry]                       │
└─────────────────────────────────┘
```

## Deep Link State

When URL contains `?image=path/to/image.jpg`:
1. Page loads
2. Fetches images until target is found
3. Automatically scrolls to target image
4. Highlights briefly (optional)

## Platform-Specific Considerations

### iOS
- Respects safe area insets (notch, home indicator)
- Uses `-webkit-overflow-scrolling: touch` for momentum
- Prevents bounce-to-refresh interference

### Android
- Handles various screen aspect ratios
- Works with gesture navigation
- Respects system bars

### PWA (Future)
- Can be installed as standalone app
- Fullscreen mode without browser chrome
- App-like navigation
