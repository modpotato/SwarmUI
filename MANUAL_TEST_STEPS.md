# Manual Testing Steps for LoRA Metadata and Modal Positioning Fixes

## Overview
This document outlines the manual testing steps to verify the fixes for:
1. LoRA metadata field mismatch
2. Modal positioning issues

## Prerequisites
- SwarmUI running locally
- OpenRouter API key configured
- At least one LoRA model installed (optional but recommended for full testing)

## Test 1: LoRA Metadata Field Mapping

### Test Case 1.1: Backend with Standard Fields
**Objective**: Verify that LoRAs are correctly loaded when backend returns standard fields (`id`, `triggerPhrase`)

**Steps**:
1. Start SwarmUI
2. Open browser console (F12)
3. Navigate to the Generate tab
4. Click the "+" button next to the prompt box
5. Select "Prompt LLM" from the dropdown
6. In the console, check for any errors related to LoRA loading
7. Select a model and click "Execute" button
8. Check the system prompt (visible in network tab or backend logs) contains LoRA information

**Expected Result**:
- No console errors about undefined LoRA fields
- LoRAs appear in the system prompt with format: `- <lora:name> (trigger: xxx)`
- Up to 20 LoRAs are included (if available)

### Test Case 1.2: Fallback Field Names
**Objective**: Verify tolerant field mapping works with alternative field names

**Steps**:
1. Open browser console
2. In the Prompt LLM modal, check console logs for LoRA loading
3. Verify no warnings about "Skipping LoRA entry with no valid id"

**Expected Result**:
- All LoRAs with at least one valid identifier field are loaded
- No entries with undefined names appear

## Test 2: Modal Positioning

### Test Case 2.1: Modal Appears Centered
**Objective**: Verify modal appears in center of screen, not top-left corner

**Steps**:
1. Open SwarmUI in browser
2. Navigate to Generate tab
3. Click "+" button next to prompt box
4. Select "Prompt LLM"
5. Observe modal position

**Expected Result**:
- Modal appears centered on screen
- Modal has proper backdrop overlay
- Modal is positioned by Bootstrap (not at position 0,0)

### Test Case 2.2: Modal Element Location in DOM
**Objective**: Verify modal is appended to document.body

**Steps**:
1. Open browser DevTools (F12)
2. Open Prompt LLM modal
3. In Elements/Inspector tab, search for element with id "llm_prompt_refine_modal"
4. Check its parent element

**Expected Result**:
- Modal's parent element is `<body>`
- Modal is not nested deep in the page structure

## Test 3: LoRA List Size

### Test Case 3.1: Up to 20 LoRAs Shown
**Objective**: Verify that up to 20 LoRAs are included in system prompt

**Steps**:
1. If you have more than 20 LoRAs installed:
   - Open Prompt LLM modal
   - Check "Include LoRA descriptions" toggle
   - Select a model and refine a prompt
   - Check the system prompt (network tab or logs)
   
**Expected Result**:
- System prompt includes up to 20 LoRAs (not just 5)
- If fewer than 20 LoRAs available, all are shown
- List is not truncated to 5

### Test Case 3.2: LoRA Description Toggle
**Objective**: Verify LoRA descriptions can be toggled

**Steps**:
1. Open Prompt LLM modal
2. Find the "Include LoRA descriptions" checkbox
3. Check it and execute a refinement
4. Uncheck it and execute another refinement
5. Compare network requests or logs

**Expected Result**:
- When checked: LoRAs include descriptions in system prompt
- When unchecked: LoRAs only include name and trigger words
- Toggle persists between refinements in same session

## Test 4: Error Handling

### Test Case 4.1: Malformed LoRA Entry
**Objective**: Verify graceful handling of entries without valid id

**Steps**:
1. Open browser console
2. Open Prompt LLM modal (this triggers LoRA fetch)
3. Check console for any warnings

**Expected Result**:
- If any malformed entries exist, console shows: "Skipping LoRA entry with no valid id: [object]"
- No undefined or null names appear in LoRA list
- System continues to work normally

### Test Case 4.2: No LoRAs Available
**Objective**: Verify system works when no LoRAs are installed

**Steps**:
1. System with no LoRAs (or temporarily rename LoRA folder)
2. Open Prompt LLM modal
3. Execute a refinement

**Expected Result**:
- No errors occur
- System prompt doesn't include LoRA section
- Refinement works normally

## Regression Testing

### Test Case 5.1: All Modal Tabs Work
**Objective**: Verify all three tabs still function

**Steps**:
1. Open Prompt LLM modal
2. Test "Refine" tab with existing prompt
3. Test "Generate" tab with keywords
4. Test "Blend" tab with two prompts

**Expected Result**:
- All tabs work as before
- No new errors introduced
- Apply button works in all modes

### Test Case 5.2: Context Controls Work
**Objective**: Verify context controls still function

**Steps**:
1. Open Prompt LLM modal
2. Toggle "Include current prompt"
3. Toggle "Include image tags"
4. Test different tag behaviors (append/inspire/replace)
5. Test "Attach current image"

**Expected Result**:
- All toggles and controls work
- Source display updates correctly
- Context is properly sent to LLM

## Notes
- These tests should be performed on different browsers (Chrome, Firefox, Safari)
- Test on both desktop and mobile viewports if possible
- Check browser console for any JavaScript errors throughout testing
- Verify backwards compatibility with existing functionality

## Success Criteria
All test cases should pass without:
- JavaScript errors in console
- Undefined values in UI or system prompts
- Modal positioning issues
- Loss of existing functionality
