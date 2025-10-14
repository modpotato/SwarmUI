# Backend Pause-On-Outage Testing Scenarios

## Test Environment Setup

Before testing, ensure:
1. SwarmUI is running with at least one backend configured
2. You have access to backend status and logs
3. You can modify backend settings (enable/disable/stop/start)

## Test Scenario 1: Default Behavior (PauseOnOutage = false)

**Configuration:**
```
PauseOnOutage = false
MaxTimeoutMinutes = 2  # Set short for testing
```

**Steps:**
1. Queue multiple generation requests
2. Disable or stop all backends
3. Wait for MaxTimeoutMinutes (2 minutes)

**Expected Results:**
- After MaxTimeoutMinutes, all pending requests fail with timeout error
- Log shows: "[BackendHandler] N requests denied due to backend timeout failure"
- Queue is cleared
- Status shows backend error/disabled state (not "paused")

## Test Scenario 2: Pause Mode with Quick Recovery

**Configuration:**
```
PauseOnOutage = true
MaxTimeoutMinutes = 2  # Set short for testing
OutagePauseTTLMinutes = 30
```

**Steps:**
1. Queue multiple generation requests
2. Disable or stop all backends
3. Wait for MaxTimeoutMinutes (2 minutes) - should enter pause
4. Check status - should show "paused"
5. Re-enable or restart a backend
6. Observe requests resume

**Expected Results:**
- After MaxTimeoutMinutes, system enters pause mode (requests NOT failed)
- Log shows: "[BackendHandler] Entering outage pause mode for N pending requests"
- Status shows: "Queue is paused: waiting for backends to recover"
- When backend returns:
  - Log shows: "[BackendHandler] Backends recovered, exiting outage pause mode. Resuming N pending requests"
  - Requests complete successfully
  - Status returns to normal

## Test Scenario 3: Pause Mode with TTL Expiration

**Configuration:**
```
PauseOnOutage = true
MaxTimeoutMinutes = 1  # Set very short for testing
OutagePauseTTLMinutes = 3  # Set short for testing
```

**Steps:**
1. Queue multiple generation requests
2. Disable or stop all backends
3. Wait for MaxTimeoutMinutes (1 minute) - should enter pause
4. Wait for OutagePauseTTLMinutes (3 more minutes) without bringing backends back
5. Observe requests fail after TTL

**Expected Results:**
- After MaxTimeoutMinutes, system enters pause mode
- After OutagePauseTTLMinutes of pause:
  - Log shows: "[BackendHandler] Outage pause TTL of 3 minutes exceeded. Failing N requests"
  - All pending requests fail with timeout error mentioning pause duration
  - Status returns to normal (not "paused")

## Test Scenario 4: Pause Mode with Indefinite Wait

**Configuration:**
```
PauseOnOutage = true
MaxTimeoutMinutes = 1
OutagePauseTTLMinutes = 0  # Indefinite pause
```

**Steps:**
1. Queue generation requests
2. Disable or stop all backends
3. Wait for MaxTimeoutMinutes (1 minute) - should enter pause
4. Wait for 5+ minutes
5. Verify requests still pending (not failed)
6. Re-enable backend and verify recovery

**Expected Results:**
- System enters pause and stays paused indefinitely
- No TTL timeout occurs
- Requests remain in queue
- When backend returns, requests complete successfully

## Test Scenario 5: Queue Empty During Pause

**Configuration:**
```
PauseOnOutage = true
MaxTimeoutMinutes = 1
OutagePauseTTLMinutes = 30
```

**Steps:**
1. Queue generation requests
2. Disable or stop all backends
3. Wait for pause mode to activate
4. Cancel all pending requests manually
5. Observe pause state cleared

**Expected Results:**
- Log shows: "[BackendHandler] Queue emptied, clearing outage pause state"
- IsOutagePaused flag cleared
- OutagePauseStartTime reset to 0

## Test Scenario 6: Partial Backend Availability

**Configuration:**
```
PauseOnOutage = true
MaxTimeoutMinutes = 2
```

**Steps:**
1. Configure multiple backends
2. Queue generation requests
3. Disable/stop all but leave one in LOADING state
4. Wait for MaxTimeoutMinutes

**Expected Results:**
- System does NOT enter pause mode (because one backend is LOADING)
- Requests wait normally for the loading backend
- No "paused" status shown

## Test Scenario 7: Backend Status Changes During Pause

**Configuration:**
```
PauseOnOutage = true
MaxTimeoutMinutes = 1
OutagePauseTTLMinutes = 30
```

**Steps:**
1. Queue requests and trigger pause
2. While paused, change a backend to LOADING (e.g., start initialization)
3. Observe immediate exit from pause

**Expected Results:**
- System exits pause as soon as any backend becomes LOADING/WAITING/RUNNING
- Log shows: "[BackendHandler] Backends recovered, exiting outage pause mode"
- Requests resume processing

## Test Scenario 8: UI Status Display

**Configuration:**
```
PauseOnOutage = true
MaxTimeoutMinutes = 1
```

**Steps:**
1. Open SwarmUI in browser
2. Queue requests and trigger backend outage
3. Observe status bar during pause
4. Restore backend and observe status change

**Expected Results:**
- Status bar shows warning with message: "Queue is paused: waiting for backends to recover"
- Status class is "warn" (typically orange/yellow color)
- When backends recover, status returns to normal
- No "Queue End" webhook triggered during pause

## Test Scenario 9: TryFind Behavior Without Immediate Failure

**Configuration:**
```
PauseOnOutage = true or false  # Should work the same
PerRequestTimeoutMinutes = 5
```

**Steps:**
1. Submit a generation request with no backends available
2. Observe logs for TryFind warnings
3. Wait for PerRequestTimeoutMinutes
4. Verify request times out naturally (not immediately)

**Expected Results:**
- TryFind logs warnings: "No backends are available! Waiting for backends to become available..."
- Request does NOT immediately fail with "No backends available!" error
- After PerRequestTimeoutMinutes, request times out via caller's maxWait
- This works regardless of PauseOnOutage setting

## Test Scenario 10: Webhook Behavior During Pause

**Configuration:**
```
PauseOnOutage = true
MaxTimeoutMinutes = 1
OutagePauseTTLMinutes = 30
```

**Steps:**
1. Set up a webhook listener for "Queue End" events
2. Queue requests and trigger pause
3. Wait several minutes while paused
4. Verify webhook NOT triggered during pause
5. Cancel all requests or restore backend
6. Verify webhook triggered when queue actually empties

**Expected Results:**
- No "Queue End" webhook while paused with pending requests
- T2IBackendRequests.IsEmpty() returns false during pause
- Webhook only fires when queue actually empties

## Validation Checklist

After running tests, verify:
- [ ] Default behavior (PauseOnOutage=false) unchanged
- [ ] Pause mode activates correctly after MaxTimeoutMinutes
- [ ] Status reporting shows "paused" during outage
- [ ] Requests resume when backends recover
- [ ] TTL expires correctly when OutagePauseTTLMinutes > 0
- [ ] Indefinite pause works when OutagePauseTTLMinutes <= 0
- [ ] Pause clears when queue becomes empty
- [ ] No immediate failures in TryFind
- [ ] Webhooks behave correctly during pause
- [ ] Build succeeds without warnings/errors
- [ ] Logs are clear and informative

## Manual Testing Notes

For practical testing, you may want to:
1. Set very short timeout values (1-2 minutes instead of defaults)
2. Use a local ComfyUI backend you can easily stop/start
3. Monitor both SwarmUI logs and UI status bar simultaneously
4. Test with simple, quick generations to speed up validation
5. Use debug/verbose logging to see detailed state changes

## Expected Log Patterns

During testing, look for these log patterns:

**Entering Pause:**
```
[BackendHandler] No backends are available! Waiting for backends to become available...
[BackendHandler] Entering outage pause mode for X pending requests. Waiting for backends to recover.
```

**Exiting Pause (Recovery):**
```
[BackendHandler] Backends recovered, exiting outage pause mode. Resuming X pending requests.
```

**Exiting Pause (TTL):**
```
[BackendHandler] Outage pause TTL of Y minutes exceeded. Failing X requests.
```

**Queue Empty:**
```
[BackendHandler] Queue emptied, clearing outage pause state.
```
