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

### Test 30: Different Screen Sizes
Test on:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (landscape and portrait)
- [ ] Mobile (if applicable)

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
