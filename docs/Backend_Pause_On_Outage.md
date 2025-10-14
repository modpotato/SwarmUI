# Backend Pause-On-Outage Feature

## Overview

The Backend Pause-On-Outage feature allows queued generation requests to survive transient backend failures rather than immediately failing them. When enabled, the system enters a "paused" state during outages and automatically resumes processing when backends become available again.

## Settings

Two new settings are available in the Backend configuration section:

### PauseOnOutage (bool)
- **Default**: `false`
- **Description**: When enabled, the queue pauses during backend outages instead of failing pending requests. Queued generations will survive transient outages and resume automatically once a backend is back.
- **Backward Compatibility**: Defaults to `false` to preserve existing fail-fast behavior for current installations.

### OutagePauseTTLMinutes (int)
- **Default**: `240` (4 hours)
- **Description**: Maximum duration in minutes to keep requests paused during a backend outage before auto-failing them. This acts as a safety net for prolonged outages when PauseOnOutage is enabled.
- **Special Values**: Set to `0` or negative to pause indefinitely (not recommended for production).

## How It Works

### Without PauseOnOutage (Default Behavior)
When all backends go down or become unresponsive:
1. Individual requests fail immediately with "No backends available!" error
2. After `MaxTimeoutMinutes`, all pending requests are failed with a timeout error
3. The queue is cleared

### With PauseOnOutage Enabled
When all backends go down or become unresponsive:
1. The system enters "paused" state after `MaxTimeoutMinutes`
2. Pending requests are NOT failed - they remain in the queue
3. The UI/API shows status as "paused: waiting for backends to recover"
4. The system continuously monitors for backend recovery
5. When any backend becomes RUNNING/LOADING/WAITING:
   - The pause state is automatically cleared
   - Pending requests resume processing normally
6. If outage exceeds `OutagePauseTTLMinutes` (when > 0):
   - All pending requests are failed with a timeout error
   - The pause state is cleared

## Status Reporting

When the queue is paused:
- **Status**: `"paused"`
- **Class**: `"warn"`
- **Message**: `"Queue is paused: waiting for backends to recover."`
- **any_loading**: Reports whether any backend is LOADING or WAITING

This status is visible in the UI status bar and through the API.

## Behavior Details

### Request Processing in TryFind
When no backends are available, the system now:
- Logs warnings about the situation
- Attempts to scale new backends if configured
- Does NOT immediately fail the request
- Lets the caller's `maxWait` (PerRequestTimeoutMinutes) handle the timeout naturally

This ensures requests can survive temporary outages without being prematurely failed.

### Queue State Management
- While paused with pending requests, the system does NOT trigger "Queue End" webhooks
- The queue is treated as "not idle" to prevent idle-related events
- When the queue becomes empty, the pause state is automatically cleared

### Logging
The system logs key events:
- `[BackendHandler] Entering outage pause mode for N pending requests. Waiting for backends to recover.`
- `[BackendHandler] Backends recovered, exiting outage pause mode. Resuming N pending requests.`
- `[BackendHandler] Outage pause TTL of N minutes exceeded. Failing N requests.`
- `[BackendHandler] Queue emptied, clearing outage pause state.`

## Use Cases

### Recommended: Personal/Development Instances
For personal or development instances where transient failures are common:
```
PauseOnOutage = true
OutagePauseTTLMinutes = 60  # 1 hour safety net
```

### Production Instances with High Availability
For production instances with good backend reliability:
```
PauseOnOutage = false  # Keep fail-fast behavior
```

### Production Instances with Occasional Restarts
For production instances where backends may occasionally restart:
```
PauseOnOutage = true
OutagePauseTTLMinutes = 15  # Short safety net for quick restarts
```

## Interaction with Other Settings

### MaxTimeoutMinutes
The pause logic only activates AFTER `MaxTimeoutMinutes` has passed without any progress. This ensures brief delays don't trigger pause mode.

### PerRequestTimeoutMinutes
Individual requests still respect their `PerRequestTimeoutMinutes` limit. If a request waits longer than this (either during normal operation or pause), it will timeout normally.

## Edge Cases

1. **All requests cancelled during pause**: The pause state clears when the queue becomes empty.
2. **Backend becomes enabled during pause**: The system detects this and exits pause mode.
3. **Multiple backends with mixed states**: Pause only occurs when NO backend is RUNNING/LOADING/WAITING.
4. **OutagePauseTTLMinutes = 0**: The system pauses indefinitely (until backends recover or users cancel).

## Migration from Existing Behavior

Since `PauseOnOutage` defaults to `false`, existing installations maintain their current behavior:
- No configuration changes required
- Users can opt-in to the new behavior by setting `PauseOnOutage = true` in their settings

## Implementation Notes

The implementation includes:
- **Settings.cs**: New configuration fields
- **BackendHandler.cs**: 
  - Pause state tracking (`IsOutagePaused`, `OutagePauseStartTime`)
  - Modified request handling loop with pause logic
  - Updated status reporting
  - Modified `TryFind` to avoid premature failures

The changes are minimal and surgical, preserving existing behavior when the feature is disabled.
