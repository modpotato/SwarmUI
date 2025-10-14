# Backend Pause-On-Outage - Quick Reference

## Quick Start

### Enable the Feature
Edit your SwarmUI settings to add:
```
[Backends]
PauseOnOutage = true
OutagePauseTTLMinutes = 240  # Optional: 4 hours default
```

### What You'll See
When backends go down with queued requests:
- **Status Bar**: "Queue is paused: waiting for backends to recover" (warning/yellow)
- **Logs**: "[BackendHandler] Entering outage pause mode for N pending requests"
- **Behavior**: Requests stay in queue, auto-resume when backends return

## Common Configurations

### Personal/Dev Instance (Recommended)
```
PauseOnOutage = true
OutagePauseTTLMinutes = 60  # 1 hour safety net
```
**Use case**: For personal use where you may restart backends frequently

### Production with Occasional Restarts
```
PauseOnOutage = true
OutagePauseTTLMinutes = 15  # 15 minutes for quick restarts
```
**Use case**: Production where backends may restart but should recover quickly

### Production High-Availability (Default)
```
PauseOnOutage = false  # Default setting
```
**Use case**: Production with good backend reliability, prefer fail-fast

### Testing/Development
```
PauseOnOutage = true
OutagePauseTTLMinutes = 0  # No TTL, pause indefinitely
MaxTimeoutMinutes = 1  # Fast pause activation for testing
```
**Use case**: Testing the pause behavior

## How It Works

### Normal Flow (PauseOnOutage = false)
```
Queue Request → No Backend → Immediate Fail ❌
```

### Pause Flow (PauseOnOutage = true)
```
Queue Request → No Backend → Wait → Backend Returns → Complete ✅
                              ↓
                         TTL Expired → Timeout ❌
```

## Status Messages

| Status | Meaning | Action |
|--------|---------|--------|
| "Running" | Backends available | Normal operation |
| "Loading" | Backends starting | Wait for initialization |
| "Paused: waiting for backends to recover" | In pause mode | Check backend status, wait or fix backends |
| "Some backends disabled" | Configuration issue | Enable backends in settings |
| "Errored" | Backend failures | Check logs for errors |

## Logs to Watch For

### Entering Pause
```
[BackendHandler] No backends are available! Waiting for backends to become available...
[BackendHandler] Entering outage pause mode for 5 pending requests. Waiting for backends to recover.
```

### Exiting Pause (Success)
```
[BackendHandler] Backends recovered, exiting outage pause mode. Resuming 5 pending requests.
```

### Exiting Pause (TTL)
```
[BackendHandler] Outage pause TTL of 240 minutes exceeded. Failing 5 requests.
```

## Troubleshooting

### Q: Requests still failing immediately
**A**: Check that `PauseOnOutage = true` in your settings. Default is `false`.

### Q: Requests failing after some time during pause
**A**: Check `OutagePauseTTLMinutes`. If > 0, requests will fail after that duration. Set to 0 for indefinite pause.

### Q: Status doesn't show "paused"
**A**: Pause only activates after `MaxTimeoutMinutes` (default 120). Check backend status is actually down.

### Q: Requests not resuming when backend returns
**A**: Check logs for "Backends recovered" message. Verify backend status is RUNNING, not ERRORED or IDLE.

### Q: "Queue End" webhook firing during pause
**A**: This shouldn't happen. If it does, file a bug report with logs.

## Related Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `MaxTimeoutMinutes` | 120 | Minutes before considering backend unresponsive (pause trigger) |
| `PerRequestTimeoutMinutes` | 10080 | Max time individual request can wait (1 week default) |
| `PauseOnOutage` | false | Enable pause-on-outage feature |
| `OutagePauseTTLMinutes` | 240 | Max pause duration before auto-fail (4 hours) |

## Best Practices

1. **Set appropriate TTL**: Don't pause indefinitely in production
2. **Monitor logs**: Watch for pause/resume events
3. **Test configuration**: Try short timeouts first to verify behavior
4. **Backend health**: Address root causes of outages, don't rely on pause as a fix
5. **User communication**: If using pause, inform users that requests will survive backend restarts

## Advanced: State Machine

```
┌─────────────┐
│   Normal    │ ◄──────────────────────┐
│ Processing  │                        │
└──────┬──────┘                        │
       │                               │
       │ MaxTimeoutMinutes elapsed     │
       │ + All backends down           │
       ↓                               │
┌─────────────┐                        │
│   Paused    │ ─ Backend recovers ───┘
│  (Waiting)  │
└──────┬──────┘
       │
       │ TTL exceeded
       ↓
┌─────────────┐
│   Failed    │
│  (Timeout)  │
└─────────────┘
```

## Performance Impact

- **CPU**: Negligible (one additional conditional check per loop iteration)
- **Memory**: Minimal (2 additional fields: bool + long)
- **I/O**: None (no additional disk/network operations)
- **Latency**: None when disabled; potential benefit when enabled (no queue clear)

## Compatibility

- ✅ **Backward Compatible**: Default behavior unchanged
- ✅ **Hot Reload**: Settings changes apply immediately
- ✅ **Multiple Backends**: Works with any number of backends
- ✅ **Backend Types**: Works with all backend types (ComfyUI, Swarm-API, etc.)
- ✅ **Webhooks**: Preserves webhook behavior
- ✅ **UI**: Status bar updates automatically

## Version Info

- **Introduced**: [Current Version]
- **Modified Files**: `Settings.cs`, `BackendHandler.cs`
- **Documentation**: See `Backend_Pause_On_Outage.md` for full details
- **Testing**: See `Backend_Pause_Testing.md` for test scenarios
