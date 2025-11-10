# Mobile Stream Image URL Fix

## Problem Statement

The mobile stream scroller was experiencing 404 errors when loading images because it was constructing image URLs using an incorrect path prefix.

### Symptoms
- Requests like `/View/raw/<filename>.png` returned `{"error":"404, file not found."}`
- Images failed to load in the mobile scroller despite files existing on disk
- Excessive network requests due to lack of deduplication

## Root Cause

The mobile scroller's `buildImageUrl()` function was hard-coding the path as `/View/{path}`, but this fork of StableSwarm UI serves images via different routes depending on server configuration:

1. When `outputAppendUser` is false (default): `Output/{path}`
2. When `outputAppendUser` is true: `View/{user_id}/{path}`

The existing image gallery (`imagehistory.js`) correctly uses `getImageOutPrefix()` to determine the proper base path, but the mobile scroller was not reusing this logic.

## Solution

### 1. URL Construction Fix

Updated `buildImageUrl()` in `src/wwwroot/js/mobile-stream.js` to use the same logic as the gallery:

```javascript
function buildImageUrl(imageSrc) {
    if (!imageSrc) return '';
    // Split path into segments and encode each one separately
    const segments = imageSrc.split('/');
    const encodedSegments = segments.map(seg => encodeURIComponent(seg));
    // Use getImageOutPrefix() to get the correct base path (same as gallery)
    // This returns either 'Output' or 'View/{user_id}' depending on server config
    return `${getImageOutPrefix()}/${encodedSegments.join('/')}`;
}
```

### 2. Request Deduplication

Added strict guards to prevent duplicate API requests:

- `lastRequestedCursor` tracking to prevent re-requesting the same cursor
- `inFlightRequests` Set to track active requests by a unique key (cursor + filters)
- `AbortController` to cancel stale requests when filters change
- Request key format: `{cursor}_{sortBy}_{sortReverse}_{starredOnly}_{promptSearch}_{modelSearch}_{loraSearch}`

### 3. Reduced Over-fetching

- Reduced `PREFETCH_AHEAD` from 5 to 3 images
- Added `FILTER_DEBOUNCE` config (300ms) for future filter debouncing
- Abort in-flight requests when filters change to avoid stale data

### 4. Enhanced Error Handling

- Added detailed console logging for 404 errors showing both relative path and resolved URL
- Created visual error overlay with retry button
- Graceful handling of aborted requests (no error shown)

## How URL Routing Works

### Server-Side Routes

The server registers two routes that map to the same handler (`ViewOutput`):

```csharp
WebApp.MapGet("/Output/{*Path}", ViewOutput);
WebApp.MapGet("/View/{*Path}", ViewOutput);
```

The `ViewOutput` handler:
1. Extracts the path after `/View/` or `/Output/`
2. Determines the root output directory based on user settings
3. If `AppendUserNameToOutputPath` is true and route is `/View/`, expects format: `/View/{user_id}/{path}`
4. Resolves the physical file path and serves the file

### Client-Side Path Building

The `getImageOutPrefix()` function (in `site.js`) returns the appropriate prefix:

```javascript
function getImageOutPrefix() {
    return outputAppendUser ? `View/${user_id}` : 'Output';
}
```

### API Response Format

Both `ListImages` and `ListImagesMobile` APIs return image objects with relative paths:

```json
{
  "images": [
    {
      "src": "2025-01-10/image-filename.png",
      "metadata": "{...}"
    }
  ]
}
```

The client must prepend `getImageOutPrefix()` to construct the full URL:
- Result: `Output/2025-01-10/image-filename.png` (default)
- Or: `View/user123/2025-01-10/image-filename.png` (with user append)

## Path Encoding

Each path segment is encoded separately using `encodeURIComponent()`, but forward slashes (`/`) are preserved as path separators:

```javascript
const segments = imageSrc.split('/');
const encodedSegments = segments.map(seg => encodeURIComponent(seg));
return `${getImageOutPrefix()}/${encodedSegments.join('/')}`;
```

This ensures special characters in filenames are properly encoded while maintaining the directory structure.

## Related Files

- `src/wwwroot/js/mobile-stream.js` - Mobile scroller implementation
- `src/wwwroot/js/genpage/gentab/imagehistory.js` - Gallery implementation (reference)
- `src/wwwroot/js/site.js` - Contains `getImageOutPrefix()` function
- `src/Core/WebServer.cs` - Server-side route handlers
- `src/WebAPI/T2IAPI.cs` - API endpoint implementations

## Testing

To verify the fix:

1. Ensure images exist in the output directory
2. Open the mobile stream UI
3. Verify images load without 404 errors
4. Check browser console for proper URL format
5. Test with filters to ensure deduplication works
6. Verify starred images toggle correctly

## Future Improvements

- Consider adding debouncing to text-based filter inputs (prompt, model, LoRA search)
- Implement IntersectionObserver for more efficient load triggering
- Add server-side debug logging flag for 404 troubleshooting
