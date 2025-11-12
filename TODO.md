# SwarmUI Feature TODO

## 1. LoRA Description Adder for Prompt LLM

### Requirements
- Add API endpoint to fetch LoRA metadata (name, trigger_phrase, description)
- Add checkbox in proper modal location (not injected into body)
- Integrate with existing prompt LLM refine functionality
- Include LoRA descriptions in context when checkbox is enabled

### Implementation Notes
- Backend: Create `LoraAPI.cs` with `GetLoraMetadata` endpoint
- Frontend: Add checkbox in `GenTabModals.cshtml` within context controls section
- Update `promptllm.js` to fetch and include LoRA metadata when enabled
- Use session permissions to filter accessible LoRAs

---

## 2. TikTok-Style Mobile Image Stream

### Requirements
- Create mobile-friendly vertical scrolling image viewer
- Implement snap-to-scroll behavior (one image per screen)
- Add pagination/infinite scroll for large image collections
- Include filter drawer (starred, prompt search, model search, LoRA search)
- Show image info drawer with metadata
- Proper URL construction using session-based prefix

### Implementation Notes
- Backend: Create `ListImagesMobile` API endpoint with pagination support
- Frontend: Create `Mobile/Stream.cshtml` page
- CSS: `mobile-stream.css` with snap scrolling and responsive layout
- JavaScript: `mobile-stream.js` with proper session initialization
- Use `getImageOutPrefix()` to handle both `/Output/` and `/View/{user_id}/` paths
- Ensure `site.js` session initialization completes before mobile stream init

---

## Key Technical Considerations

### Session Management
- Mobile stream depends on `getSession()` completing first
- Must wait for session data before making API calls
- Use `getImageOutPrefix()` for correct image URL construction

### URL Routing
- `outputAppendUser=false` → `/Output/{path}`
- `outputAppendUser=true` → `/View/{user_id}/{path}`

### Proper Modal Integration
- LoRA checkbox must be in modal HTML, not injected via JavaScript
- Follow existing pattern in `GenTabModals.cshtml`

### Testing Requirements
- Test LoRA metadata fetching with valid/invalid LoRA names
- Test mobile stream with empty/populated output directories
- Test image URL construction with both `outputAppendUser` settings
- Test pagination and filtering in mobile stream
- Verify session initialization timing
