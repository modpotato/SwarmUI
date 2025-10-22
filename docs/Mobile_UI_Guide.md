# Mobile UI Guide

## Overview

SwarmUI includes comprehensive mobile support designed to provide an optimal experience on smartphones and tablets. This guide explains the mobile features, how they work, and how to contribute to mobile development.

## Mobile Features

### Responsive Layout System

The UI automatically adapts to different screen sizes:

- **Mobile** (< 768px): Compact single-column layout with swipe gestures
- **Tablet** (768px - 1024px): Hybrid layout with some sidebars visible
- **Desktop** (> 1024px): Full multi-column layout with all features visible
- **Large Desktop** (> 1920px): Expanded layout optimized for large screens

### Layout Modes

Users can control the layout behavior through three modes:

1. **Auto** (Default): Automatically switches between mobile and desktop based on screen size
2. **Mobile**: Forces mobile layout regardless of screen size
3. **Desktop**: Forces desktop layout regardless of screen size

The layout mode can be changed in User Settings and persists across sessions.

### Mobile Navigation

#### Swipe Gestures

Mobile users can navigate using intuitive swipe gestures:

- **Swipe from left edge → right**: Opens parameter sidebar
- **Swipe left on content**: Closes parameter sidebar
- **Swipe from right edge → left**: Opens image batch sidebar
- **Swipe right on content**: Closes image batch sidebar
- **Swipe from bottom edge → up**: Opens advanced/history section
- **Swipe down on content**: Closes bottom section

Gestures require a minimum swipe distance (40% of screen width or 100px) to prevent accidental triggers.

#### Touch Interactions

All interactive elements are optimized for touch:

- **Minimum touch target size**: 44x44 pixels (Apple's recommended minimum)
- **Increased padding**: Buttons and inputs have extra padding for easier tapping
- **Larger text**: Font sizes are increased for better readability
- **Better spacing**: UI elements have more spacing to prevent mis-taps

### Mobile-Specific UI Adjustments

When in mobile mode:

1. **Sidebars auto-close**: Left and right sidebars are closed by default to maximize image viewing area
2. **Full-width prompts**: Prompt box expands to use full width
3. **Simplified navigation**: Tab bars are streamlined for mobile
4. **Optimized modals**: Dialogs are resized to fit mobile screens (max 95vw)
5. **Better scrolling**: Smooth scrolling with momentum on iOS and Android
6. **Visual indicators**: Subtle edge highlights show swipeable areas

## Technical Implementation

### CSS Classes

The mobile system uses two primary CSS classes:

- `.small-window`: Applied to `<body>` when in mobile mode
- `.large-window`: Applied to `<body>` when in desktop mode

These classes allow targeted styling for each mode.

### Responsive Breakpoints

```css
/* Mobile */
@media screen and (max-width: 768px) { }

/* Tablet */
@media screen and (min-width: 769px) and (max-width: 1024px) { }

/* Large Desktop */
@media screen and (min-width: 1920px) { }
```

### JavaScript Architecture

The mobile layout is managed by the `GenTabLayout` class in `/src/wwwroot/js/genpage/gentab/layout.js`:

Key properties:
- `isSmallWindow`: Boolean indicating current mobile state
- `mobileDesktopLayout`: Current layout mode setting ('auto', 'mobile', or 'desktop')
- `swipeStartX/Y`: Track swipe gesture starting positions

Key methods:
- `reapplyPositions()`: Recalculates and applies layout positions
- `onTransitionToMobile()`: Handles switching to mobile mode
- `onTransitionToDesktop()`: Handles switching to desktop mode
- `handleResize()`: Debounced window resize handler
- `isTouchDevice()`: Detects if device supports touch
- `getMobileStatus()`: Returns current mobile state information

### Mode Transitions

When switching between mobile and desktop modes:

1. The current mode state is stored
2. New mode is calculated based on layout setting and window size
3. If mode changed, transition handlers are called
4. Sidebars are opened/closed as appropriate
5. Layout positions are recalculated
6. Optional visual feedback is shown to user

## Development Guidelines

### Adding Mobile Support to New Features

When developing new features, follow these guidelines:

1. **Test on mobile**: Always test new UI on mobile devices or in responsive mode
2. **Touch targets**: Ensure buttons are at least 44x44 pixels
3. **Responsive CSS**: Use `.small-window` class for mobile-specific styles
4. **Avoid hover**: Don't rely on hover states (use click/tap instead)
5. **Scrollable content**: Ensure long content is scrollable on small screens
6. **Modal sizing**: Make modals responsive (max-width: 95vw on mobile)

### CSS Best Practices

```css
/* Good: Mobile-specific styling */
.small-window .my-feature {
    font-size: 1rem;
    padding: 0.5rem;
    min-height: 2.75rem;
}

/* Good: Progressive enhancement */
.my-button {
    /* Base styles for all devices */
    padding: 0.3rem;
}

.small-window .my-button {
    /* Enhanced for touch */
    padding: 0.6rem;
    min-height: 2.75rem;
}
```

### JavaScript Best Practices

```javascript
// Check if in mobile mode
if (genTabLayout.isSmallWindow) {
    // Mobile-specific behavior
}

// Check if touch device
if (genTabLayout.isTouchDevice()) {
    // Touch-specific behavior
}

// Get full mobile status
let status = genTabLayout.getMobileStatus();
console.log(status.isSmallWindow, status.isTouchDevice);
```

## Testing Mobile Features

### Browser DevTools

1. Open browser DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select device or enter custom dimensions
4. Test at various sizes: 375x667 (iPhone), 768x1024 (iPad), etc.

### Real Device Testing

For best results, test on actual devices:

- **iOS**: iPhone (Safari, Chrome)
- **Android**: Various devices (Chrome, Firefox, Samsung Internet)
- **Tablet**: iPad, Android tablet

### Test Checklist

See `TESTING_CHECKLIST.md` for comprehensive mobile testing scenarios, including:

- Layout auto-detection
- Mode toggling
- Touch interactions
- Swipe gestures
- Orientation changes
- Modal dialogs
- Text input
- Performance

## Accessibility

Mobile features include accessibility considerations:

- **Screen reader support**: All interactive elements are properly labeled
- **Keyboard navigation**: Works with Bluetooth keyboards on mobile
- **Focus indicators**: Clear visual focus states
- **Color contrast**: Meets WCAG guidelines
- **Text scaling**: Respects user's text size preferences

## Performance Optimization

Mobile optimizations for better performance:

- **Debounced resize**: Resize events are debounced to reduce reflow
- **Smooth scrolling**: Uses `-webkit-overflow-scrolling: touch`
- **Transition throttling**: Animations are optimized for 60fps
- **Minimal repaints**: Layout changes are batched when possible

## Future Enhancements

Potential improvements for mobile UX:

- [ ] PWA support (install as app)
- [ ] Offline mode
- [ ] Pull-to-refresh
- [ ] Haptic feedback for interactions
- [ ] Voice input for prompts
- [ ] Camera integration for image uploads
- [ ] Share sheet integration
- [ ] Dark/light mode based on system preference

## Contributing

To contribute to mobile development:

1. Follow the development guidelines above
2. Test on multiple devices/screen sizes
3. Update this documentation with new features
4. Add tests to `TESTING_CHECKLIST.md`
5. Include screenshots of mobile UI in PRs

## Resources

- [Mobile Web Best Practices](https://developers.google.com/web/fundamentals/design-and-ux/principles)
- [Touch Target Sizing](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

## Support

For mobile-related issues:

1. Check the testing checklist to reproduce the issue
2. Test on multiple devices if possible
3. Include device/browser info in bug reports
4. Provide screenshots or screen recordings

---

*Last updated: 2025-10-18*
