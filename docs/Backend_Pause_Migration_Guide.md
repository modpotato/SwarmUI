# Migration Guide: Backend Pause-On-Outage Feature

## Overview

This guide helps existing SwarmUI users understand and optionally adopt the new Backend Pause-On-Outage feature introduced in this update.

## No Action Required for Most Users

**Default Behavior**: The feature is **OFF by default**. Your SwarmUI installation will continue to work exactly as before with no configuration changes needed.

## Who Should Enable This Feature?

Consider enabling if you:
- Run SwarmUI on a personal machine with occasional backend restarts
- Experience transient network issues with remote backends
- Want queued generations to survive brief outages
- Run SwarmUI in development/testing environments
- Prefer graceful degradation over fail-fast behavior

## Who Should Keep It Disabled?

Keep it disabled (default) if you:
- Run SwarmUI in a high-availability production environment
- Prefer immediate failure notification over delayed failures
- Have stable, reliable backends that rarely go down
- Want predictable timeout behavior
- Are new to SwarmUI and want to start with proven behavior

## Upgrade Process

### Step 1: Verify Current Behavior (Optional)

Before enabling, confirm your current behavior:
1. Check your `Data/Settings.fds` or settings UI
2. Look for `[Backends]` section
3. Verify `PauseOnOutage` is absent or set to `false`

### Step 2: Backup Your Settings (Recommended)

```bash
# Linux/Mac
cp Data/Settings.fds Data/Settings.fds.backup

# Windows
copy Data\Settings.fds Data\Settings.fds.backup
```

### Step 3: Enable the Feature

#### Option A: UI Configuration (Recommended)
1. Open SwarmUI in your browser
2. Navigate to Server tab → Backends section
3. Find "Pause On Outage" setting
4. Enable the checkbox
5. Set "Outage Pause TTL Minutes" (default 240 is good)
6. Click Save

#### Option B: Manual Configuration
Edit `Data/Settings.fds`:
```
[Backends]
PauseOnOutage = true
OutagePauseTTLMinutes = 240
```

Then restart SwarmUI or trigger a settings reload.

### Step 4: Test the Feature (Optional)

With test images only:
1. Queue a generation request
2. Disable/stop your backend(s)
3. Wait for pause to activate (after MaxTimeoutMinutes)
4. Verify status shows "paused"
5. Re-enable/restart backend(s)
6. Verify request completes successfully

## Configuration Recommendations by Use Case

### Personal Desktop Use
```
[Backends]
PauseOnOutage = true
OutagePauseTTLMinutes = 60
MaxTimeoutMinutes = 2  # Optional: faster pause activation
```
**Rationale**: Short timeout, reasonable TTL for personal use

### Remote API Use
```
[Backends]
PauseOnOutage = true
OutagePauseTTLMinutes = 30
MaxTimeoutMinutes = 5
```
**Rationale**: Account for network hiccups, moderate TTL

### Shared Server (Multiple Users)
```
[Backends]
PauseOnOutage = true
OutagePauseTTLMinutes = 120
MaxTimeoutMinutes = 10
```
**Rationale**: Longer timeouts for multiple users, reasonable TTL

### Production (High Uptime Expected)
```
[Backends]
PauseOnOutage = false  # Keep default
```
**Rationale**: Fail-fast is better for well-managed production systems

## Changes to Expect

### When Disabled (Default)
No changes to your experience:
- Requests fail immediately when no backends available
- Global timeout fails all requests after MaxTimeoutMinutes
- Status shows "disabled" or "error" when backends down

### When Enabled
New behavior during outages:
- **Status Bar**: Shows "Queue is paused: waiting for backends to recover"
- **Logs**: New informational messages about pause state
- **Requests**: Stay in queue during outage (not failed immediately)
- **Recovery**: Automatic resume when backends return
- **Safety**: Auto-fail after OutagePauseTTLMinutes if outage persists

## Potential Issues and Solutions

### Issue: Requests taking too long to fail
**Cause**: OutagePauseTTLMinutes is too high
**Solution**: Reduce OutagePauseTTLMinutes to a smaller value (e.g., 15-30 minutes)

### Issue: Requests failing before backend recovers
**Cause**: OutagePauseTTLMinutes is too low for your typical recovery time
**Solution**: Increase OutagePauseTTLMinutes or improve backend recovery time

### Issue: Not seeing "paused" status
**Cause**: MaxTimeoutMinutes hasn't elapsed yet, or backend isn't truly down
**Solution**: Wait longer or check backend status. Pause only activates after MaxTimeoutMinutes

### Issue: UI feels different
**Cause**: New status messages during pause
**Solution**: This is expected. The "paused" status indicates working behavior. If you prefer old behavior, set PauseOnOutage = false

## Rolling Back

If you want to revert to old behavior:

### Option 1: Disable in UI
1. Server tab → Backends section
2. Uncheck "Pause On Outage"
3. Save settings

### Option 2: Edit Config
Change in `Data/Settings.fds`:
```
[Backends]
PauseOnOutage = false
```

### Option 3: Restore Backup
```bash
# Linux/Mac
cp Data/Settings.fds.backup Data/Settings.fds

# Windows
copy Data\Settings.fds.backup Data\Settings.fds
```

Then restart SwarmUI.

## FAQ

### Q: Will this affect my existing queued requests?
**A**: No. The feature only affects behavior during backend outages. Normal operation is unchanged.

### Q: Can I change these settings while SwarmUI is running?
**A**: Yes. Settings take effect immediately when saved through the UI.

### Q: Does this work with all backend types?
**A**: Yes. It works with ComfyUI, Swarm-API, and all other backend types.

### Q: Will my requests wait forever during an outage?
**A**: No. The OutagePauseTTLMinutes setting acts as a safety net. Default is 4 hours.

### Q: What if I want unlimited pause duration?
**A**: Set `OutagePauseTTLMinutes = 0` or negative. Not recommended for production.

### Q: Does this increase memory usage?
**A**: Negligibly. Only 2 additional fields per BackendHandler instance (~16 bytes).

### Q: Can I see when pause mode is active?
**A**: Yes. Check the status bar in the UI or call the GetCurrentStatus API endpoint.

### Q: Will webhooks fire during pause?
**A**: "Queue End" webhooks will NOT fire during pause (correct behavior). They only fire when queue truly empties.

## Monitoring and Debugging

### Log Messages to Watch

**Successful Pause/Resume:**
```
[BackendHandler] Entering outage pause mode for 3 pending requests. Waiting for backends to recover.
[BackendHandler] Backends recovered, exiting outage pause mode. Resuming 3 pending requests.
```

**TTL Expiration:**
```
[BackendHandler] Outage pause TTL of 240 minutes exceeded. Failing 3 requests.
```

**State Cleanup:**
```
[BackendHandler] Queue emptied, clearing outage pause state.
```

### Status API

Check current status via API:
```bash
curl http://localhost:7801/API/GetCurrentStatus
```

Look for `backend_status.status = "paused"` when in pause mode.

## Best Practices After Migration

1. **Monitor First Week**: Watch logs and status for any unexpected behavior
2. **Adjust TTL**: Fine-tune OutagePauseTTLMinutes based on your typical recovery times
3. **Document**: Note your configuration choices for team members
4. **Test Recovery**: Occasionally test backend restart scenarios
5. **User Communication**: Inform users that requests may survive backend restarts

## Need Help?

- **Documentation**: See `Backend_Pause_On_Outage.md` for detailed feature description
- **Testing**: See `Backend_Pause_Testing.md` for validation scenarios
- **Reference**: See `Backend_Pause_Quick_Reference.md` for quick lookups
- **Issues**: File a GitHub issue if you encounter problems

## Version Compatibility

- **Minimum Version**: [Current Version]
- **Backward Compatible**: Yes (with default settings)
- **Forward Compatible**: Settings will be preserved in future versions
- **Config Format**: Standard .fds format (no special migration needed)

## Summary Checklist

- [ ] Read this migration guide
- [ ] Backup settings (optional but recommended)
- [ ] Decide whether to enable based on use case
- [ ] Configure PauseOnOutage and OutagePauseTTLMinutes if enabling
- [ ] Test with non-critical requests first (optional)
- [ ] Monitor logs for first few days
- [ ] Adjust TTL if needed
- [ ] Document configuration for your team
