# LLM Prompt Refinement - Testing Checklist

## Pre-Testing Setup

- [ ] Build project successfully: `dotnet build -c Release`
- [ ] Start SwarmUI server
- [ ] Navigate to Generate tab
- [ ] Have an OpenRouter account ready
- [ ] Have some test images with metadata

## API Key Configuration Tests

### Test 1: Initial Configuration
- [ ] Navigate to User tab
- [ ] Locate API Keys section
- [ ] Find OpenRouter row
- [ ] Verify "Status" shows "(Unknown)" or "not set"
- [ ] Verify "Remove" button is disabled

### Test 2: Invalid API Key
- [ ] Enter an invalid key (e.g., "test123")
- [ ] Click "Save"
- [ ] Verify status updates
- [ ] Try to use refinement feature
- [ ] Verify appropriate error message is shown

### Test 3: Valid API Key
- [ ] Get real OpenRouter API key from https://openrouter.ai/keys
- [ ] Enter valid key
- [ ] Click "Save"
- [ ] Verify input field clears
- [ ] Verify status shows "set"
- [ ] Verify "Remove" button becomes enabled

### Test 4: Remove API Key
- [ ] Click "Remove" button
- [ ] Verify status changes to "not set"
- [ ] Verify "Remove" button becomes disabled

## UI Access Tests

### Test 5: Accessing the Feature
- [ ] Navigate to Generate tab
- [ ] Locate prompt text box
- [ ] Find "+" button next to prompt box
- [ ] Click "+" button
- [ ] Verify menu appears
- [ ] Verify "Refine with LLM" option is visible
- [ ] Verify it's listed first in the menu

### Test 6: Opening Modal
- [ ] Click "Refine with LLM" option
- [ ] Verify modal opens
- [ ] Verify modal has correct title
- [ ] Verify all sections are visible:
  - [ ] Source information
  - [ ] Original text area
  - [ ] Model selection dropdown
  - [ ] Refine button
  - [ ] Close button

## Source Detection Tests

### Test 7: No Image Selected, Empty Prompt
- [ ] Ensure no image is selected
- [ ] Clear prompt box
- [ ] Open LLM refinement modal
- [ ] Verify "Source" shows "Current Prompt Text"
- [ ] Verify "Original" shows "(empty)"

### Test 8: No Image Selected, With Prompt
- [ ] Ensure no image is selected
- [ ] Enter text in prompt box: "a beautiful sunset over mountains"
- [ ] Open LLM refinement modal
- [ ] Verify "Source" shows "Current Prompt Text"
- [ ] Verify "Original" shows the entered prompt

### Test 9: Image Selected With Metadata
- [ ] Generate an image or select one from history
- [ ] Verify image has metadata (check current image info)
- [ ] Open LLM refinement modal
- [ ] Verify "Source" shows "Image Tags from selected image"
- [ ] Verify "Original" shows the image's prompt from metadata

### Test 10: Image Selected Without Metadata
- [ ] Select an image that has no metadata (external image)
- [ ] Open LLM refinement modal
- [ ] Verify falls back to "Current Prompt Text"

## Model Loading Tests

### Test 11: Initial Model Load
- [ ] Configure valid API key
- [ ] Open LLM refinement modal
- [ ] Verify model dropdown shows "Loading models..."
- [ ] Wait for models to load
- [ ] Verify dropdown populates with models
- [ ] Verify "Recommended" optgroup appears
- [ ] Verify recommended models include:
  - [ ] Claude variant
  - [ ] GPT-4 variant
  - [ ] Gemini variant
  - [ ] Llama variant

### Test 12: Model Load Failure
- [ ] Use invalid API key
- [ ] Open LLM refinement modal
- [ ] Verify error message appears
- [ ] Verify dropdown shows appropriate message

## Refinement Process Tests

### Test 13: No Model Selected
- [ ] Open modal with valid setup
- [ ] Leave model dropdown at "Select a model..."
- [ ] Click "Refine" button
- [ ] Verify error message: "Please select a model."

### Test 14: Successful Refinement
- [ ] Enter prompt: "cat"
- [ ] Open modal
- [ ] Select a model (e.g., Claude or GPT-4)
- [ ] Click "Refine"
- [ ] Verify:
  - [ ] Refine button becomes disabled
  - [ ] Status shows "Refining prompt..."
  - [ ] Wait for completion
  - [ ] Status shows "Refinement complete!"
  - [ ] "Refined" text area appears with result
  - [ ] "Changes" section appears with diff
  - [ ] "Apply" button appears
  - [ ] Refine button re-enables

### Test 15: Refinement with Different Models
Test with various model types:
- [ ] Claude model
- [ ] GPT-4 model
- [ ] Gemini model
- [ ] Llama model
- [ ] Other available models
- [ ] Verify each produces appropriate refinements

### Test 16: API Error During Refinement
- [ ] Start refinement
- [ ] Simulate network issue (disconnect internet briefly)
- [ ] Verify appropriate error message appears
- [ ] Verify UI returns to normal state

### Test 17: Empty Prompt Refinement
- [ ] Clear prompt box
- [ ] Ensure no image selected
- [ ] Open modal
- [ ] Select model
- [ ] Click "Refine"
- [ ] Verify error: "No source text to refine..."

## Diff Display Tests

### Test 18: Simple Diff
- [ ] Start with prompt: "red car"
- [ ] Refine to get something like: "vibrant red sports car"
- [ ] Verify diff shows:
  - [ ] Removed section (if any) in red background
  - [ ] Added section (if any) in green background
  - [ ] Words listed appropriately

### Test 19: Complex Diff
- [ ] Use longer prompt with many words
- [ ] Refine prompt
- [ ] Verify diff is readable and accurate

### Test 20: No Changes Diff
- [ ] Use very specific, well-formed prompt
- [ ] Refine prompt
- [ ] If result is same, verify diff shows "No significant word-level changes detected"

## Apply Functionality Tests

### Test 21: Apply Refined Prompt
- [ ] Perform successful refinement
- [ ] Click "Apply" button
- [ ] Verify:
  - [ ] Prompt box updates with refined text
  - [ ] Modal closes
  - [ ] Refined prompt is now active

### Test 22: Apply Then Generate
- [ ] Refine a prompt
- [ ] Apply it
- [ ] Click "Generate" button
- [ ] Verify image generation uses refined prompt

### Test 23: Close Without Applying
- [ ] Perform refinement
- [ ] Click "Close" instead of "Apply"
- [ ] Verify:
  - [ ] Modal closes
  - [ ] Original prompt remains unchanged

## Edge Cases

### Test 24: Very Long Prompt
- [ ] Enter prompt with 500+ words
- [ ] Attempt refinement
- [ ] Verify it processes correctly

### Test 25: Special Characters
- [ ] Use prompt with special characters: `<segment:face> (masterpiece:1.2)`
- [ ] Attempt refinement
- [ ] Verify it handles correctly

### Test 26: Non-English Text
- [ ] Try prompt in different language
- [ ] Attempt refinement
- [ ] Verify appropriate handling

### Test 27: Rapid Successive Refinements
- [ ] Refine a prompt
- [ ] Immediately after, refine again
- [ ] Verify no race conditions or errors

### Test 28: Modal Behavior
- [ ] Open modal
- [ ] Try pressing ESC key
- [ ] Verify modal closes
- [ ] Open modal
- [ ] Click outside modal
- [ ] Verify expected behavior

## Browser Compatibility

### Test 29: Different Browsers
Test in:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if on Mac)
- [ ] Edge

## Browser Compatibility

### Test 29: Different Browsers
Test in:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if on Mac)
- [ ] Edge

### Test 30: Different Screen Sizes and Mobile Testing
Test on:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (landscape and portrait)
- [ ] Mobile (if applicable)

#### Mobile-Specific Tests:

##### Test 30.1: Mobile Layout Auto-Detection
- [ ] Open SwarmUI on a mobile device (or with browser dev tools in mobile mode)
- [ ] Verify layout automatically switches to mobile mode (small-window class applied)
- [ ] Verify left and right sidebars are closed by default
- [ ] Verify bottom section is closed by default
- [ ] Verify main image area takes full width

##### Test 30.2: Mobile Mode Toggle
- [ ] Navigate to User Settings (or Layout Settings if available)
- [ ] Find "Mobile/Desktop Layout" selector
- [ ] Test switching between:
  - [ ] Auto (responsive to screen size)
  - [ ] Mobile (force mobile layout)
  - [ ] Desktop (force desktop layout)
- [ ] Verify layout changes immediately
- [ ] Verify setting persists after page reload

##### Test 30.3: Touch Interactions
- [ ] Test all buttons are at least 44x44 pixels (Apple's minimum touch target)
- [ ] Verify buttons respond to touch without delay
- [ ] Test scrolling in parameter sidebar is smooth
- [ ] Test scrolling in image batch area is smooth
- [ ] Verify pinch-to-zoom works on generated images

##### Test 30.4: Swipe Gestures (Mobile)
- [ ] Swipe from left edge inward → Opens left sidebar
- [ ] Swipe from anywhere towards left → Closes left sidebar (when open)
- [ ] Swipe from right edge inward → Opens right sidebar
- [ ] Swipe from anywhere towards right → Closes right sidebar (when open)
- [ ] Swipe from bottom edge upward → Opens bottom section
- [ ] Swipe from anywhere downward → Closes bottom section (when open)
- [ ] Verify swipe gestures require minimum distance (40% of screen or 100px)
- [ ] Verify swipe gestures don't interfere with scrolling
- [ ] Verify swipe gestures don't trigger on buttons or inputs

##### Test 30.5: Mobile Portrait Orientation
- [ ] Test layout in portrait mode on mobile
- [ ] Verify prompt box is visible and usable
- [ ] Verify generate button is accessible
- [ ] Verify image output area is appropriately sized
- [ ] Test parameter inputs are accessible

##### Test 30.6: Mobile Landscape Orientation
- [ ] Rotate device to landscape
- [ ] Verify layout adjusts appropriately
- [ ] Verify all UI elements remain accessible
- [ ] Test switching between portrait and landscape

##### Test 30.7: Modal Dialogs on Mobile
- [ ] Open various modals (e.g., LLM Refinement, Image Editor)
- [ ] Verify modals fit within screen width (max 95vw)
- [ ] Verify modal content is scrollable if needed
- [ ] Verify modal close button is easily tappable
- [ ] Test modal interaction doesn't trigger background elements

##### Test 30.8: Dropdown Menus on Mobile
- [ ] Test model selection dropdown
- [ ] Test parameter dropdowns (sampler, scheduler, etc.)
- [ ] Verify dropdowns display properly
- [ ] Verify selected option is visible
- [ ] Verify touch scrolling works in long dropdowns

##### Test 30.9: Text Input on Mobile
- [ ] Test typing in prompt box
- [ ] Verify on-screen keyboard doesn't obscure important UI
- [ ] Test auto-resize of prompt box as text is entered
- [ ] Verify autocomplete/suggestions work if implemented
- [ ] Test copy/paste functionality

##### Test 30.10: Image Batch on Mobile
- [ ] Generate multiple images
- [ ] Verify batch grid displays properly
- [ ] Verify images are appropriately sized
- [ ] Test tapping images to view full size
- [ ] Verify batch scrolling works smoothly
- [ ] Test "Clear Batch" button accessibility

##### Test 30.11: Parameter Visibility on Mobile
- [ ] Open left sidebar on mobile
- [ ] Verify all parameters are accessible
- [ ] Test scrolling through parameters
- [ ] Verify parameter inputs are usable
- [ ] Test advanced options toggle
- [ ] Verify parameter filter search works

##### Test 30.12: Mobile Performance
- [ ] Monitor frame rate during interactions
- [ ] Verify no lag when opening/closing sidebars
- [ ] Test responsiveness of generate button
- [ ] Verify image loading performance
- [ ] Check memory usage during extended session

##### Test 30.13: Tablet-Specific (768px - 1024px)
- [ ] Test layout on tablet (or simulated tablet size)
- [ ] Verify intermediate layout scaling
- [ ] Test in both portrait and landscape
- [ ] Verify all features remain accessible
- [ ] Test with touch and/or mouse input

##### Test 30.14: Desktop-to-Mobile Transition
- [ ] Start in desktop layout
- [ ] Resize browser window to mobile size
- [ ] Verify smooth transition to mobile layout
- [ ] Verify sidebars auto-close
- [ ] Verify no layout breaking occurs

##### Test 30.15: Mobile-to-Desktop Transition
- [ ] Start in mobile layout
- [ ] Resize browser window to desktop size
- [ ] Verify smooth transition to desktop layout
- [ ] Verify sidebars restore to sensible defaults
- [ ] Verify split bars become draggable

##### Test 30.16: Mobile Accessibility
- [ ] Test with screen reader (VoiceOver on iOS, TalkBack on Android)
- [ ] Verify all interactive elements are announced
- [ ] Test keyboard navigation (Bluetooth keyboard on mobile)
- [ ] Verify sufficient color contrast
- [ ] Test with increased text size settings

##### Test 30.17: Network Performance on Mobile
- [ ] Test on 3G/4G connection
- [ ] Verify graceful handling of slow network
- [ ] Test offline detection if implemented
- [ ] Verify progressive loading of images
- [ ] Test reconnection after network loss

## Performance Tests

### Test 31: Response Time
- [ ] Measure time for model loading
- [ ] Measure time for refinement (should be < 10 seconds for most models)
- [ ] Verify UI remains responsive during operations

### Test 32: Multiple Refinements
- [ ] Perform 5+ refinements in sequence
- [ ] Verify no memory leaks
- [ ] Verify performance doesn't degrade

## Integration Tests

### Test 33: With Image Generation Workflow
- [ ] Generate an image
- [ ] Select it
- [ ] Refine its prompt
- [ ] Apply refined prompt
- [ ] Generate new image
- [ ] Verify complete workflow works

### Test 34: With Presets
- [ ] Apply a preset
- [ ] Open refinement modal
- [ ] Verify preset's prompt is used
- [ ] Refine and apply
- [ ] Verify works correctly

### Test 35: With Wildcards
- [ ] Use prompt with wildcard: `<wildcard:colors> car`
- [ ] Open modal
- [ ] Verify wildcard is processed appropriately

## Error Recovery

### Test 36: API Key Removed During Session
- [ ] Start session with valid key
- [ ] Open refinement modal
- [ ] In another tab, remove API key
- [ ] Try to refine
- [ ] Verify appropriate error

### Test 37: Rate Limiting
- [ ] Make many rapid requests
- [ ] If rate limited, verify error message is clear
- [ ] Verify can retry after cooldown

## Documentation Tests

### Test 38: Help Text
- [ ] Review all tooltip/help text in UI
- [ ] Verify clarity and accuracy

### Test 39: Error Messages
- [ ] Trigger each error condition
- [ ] Verify error messages are:
  - [ ] Clear and actionable
  - [ ] Grammatically correct
  - [ ] Helpful

## Final Checklist

- [ ] All API endpoints work correctly
- [ ] All UI elements render properly
- [ ] All user interactions work as expected
- [ ] Error handling is robust
- [ ] Documentation is accurate
- [ ] No console errors in browser
- [ ] No backend errors in logs
- [ ] Feature integrates seamlessly with existing UI
- [ ] Performance is acceptable
- [ ] Code follows project conventions

## Notes Section

Record any issues found:

```
Issue 1:
- Description:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:
- Severity: [Critical/High/Medium/Low]

Issue 2:
- ...
```

## Sign-off

- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Known issues documented
- [ ] Feature ready for user testing
- [ ] Feature ready for production

Tested by: _______________
Date: _______________
Version: _______________
