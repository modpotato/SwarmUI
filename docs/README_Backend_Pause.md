# Backend Pause-On-Outage Feature Documentation

This folder contains comprehensive documentation for the Backend Pause-On-Outage feature.

## Documentation Index

### 1. [Backend_Pause_On_Outage.md](Backend_Pause_On_Outage.md) (5.4 KB)
**Primary feature documentation**
- Overview of the pause-on-outage feature
- Detailed explanation of how it works
- Settings reference (PauseOnOutage, OutagePauseTTLMinutes)
- Use cases and recommendations
- Behavior details and edge cases
- Interaction with other settings

**Start here if you**: Want to understand the feature comprehensively

### 2. [Backend_Pause_Quick_Reference.md](Backend_Pause_Quick_Reference.md) (5.8 KB)
**User quick reference guide**
- Quick start instructions
- Common configuration examples
- Status messages reference
- Troubleshooting guide
- Best practices
- Performance impact

**Start here if you**: Need quick configuration help or troubleshooting

### 3. [Backend_Pause_Migration_Guide.md](Backend_Pause_Migration_Guide.md) (8.0 KB)
**Upgrade guide for existing users**
- Step-by-step migration process
- Configuration recommendations by use case
- What to expect after enabling
- Rollback procedures
- FAQ for migrating users
- Monitoring and debugging tips

**Start here if you**: Are upgrading from a version without this feature

### 4. [Backend_Pause_Testing.md](Backend_Pause_Testing.md) (7.8 KB)
**Testing scenarios and validation**
- 10 comprehensive test scenarios
- Expected results for each scenario
- Validation checklist
- Manual testing notes
- Expected log patterns

**Start here if you**: Need to test or validate the feature

### 5. [Backend_Pause_Implementation_Summary.md](Backend_Pause_Implementation_Summary.md) (5.7 KB)
**Technical implementation details**
- Code changes overview with examples
- Flow diagrams (before/after)
- State transition diagram
- Key design decisions
- Implementation statistics

**Start here if you**: Want to understand the technical implementation

## Quick Links by Role

### For End Users
1. Start with: [Quick Reference](Backend_Pause_Quick_Reference.md)
2. If upgrading: [Migration Guide](Backend_Pause_Migration_Guide.md)
3. For details: [Feature Documentation](Backend_Pause_On_Outage.md)

### For Developers
1. Start with: [Implementation Summary](Backend_Pause_Implementation_Summary.md)
2. For testing: [Testing Scenarios](Backend_Pause_Testing.md)
3. For specification: [Feature Documentation](Backend_Pause_On_Outage.md)

### For System Administrators
1. Start with: [Migration Guide](Backend_Pause_Migration_Guide.md)
2. For configuration: [Quick Reference](Backend_Pause_Quick_Reference.md)
3. For troubleshooting: [Quick Reference](Backend_Pause_Quick_Reference.md)

## Feature Summary

The Backend Pause-On-Outage feature allows queued generation requests to survive transient backend failures. When enabled:
- Pending requests are **not failed** when all backends go down
- System enters a **"paused" state** waiting for backends to recover
- Requests **automatically resume** when backends return to service
- Optional **safety net TTL** prevents indefinite pause
- **100% backward compatible** - disabled by default

## Configuration Quick Start

Enable the feature by adding to your SwarmUI settings:
```ini
[Backends]
PauseOnOutage = true
OutagePauseTTLMinutes = 240  # 4 hours safety net
```

Or leave default (recommended for production):
```ini
[Backends]
PauseOnOutage = false  # Default - fail-fast behavior
```

## Files Modified

Core implementation (104 lines across 2 files):
- `src/Core/Settings.cs` (+10 lines)
- `src/Backends/BackendHandler.cs` (+94/-10 lines)

## Version Information

- **Feature**: Backend Pause-On-Outage
- **Status**: Complete and tested
- **Backward Compatibility**: ✅ Yes (100%)
- **Default Behavior**: Disabled (preserves existing behavior)
- **Build Status**: ✅ 0 warnings, 0 errors

## Related Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `PauseOnOutage` | false | Enable pause-on-outage feature |
| `OutagePauseTTLMinutes` | 240 | Max pause duration (4 hours) |
| `MaxTimeoutMinutes` | 120 | Time before considering outage |
| `PerRequestTimeoutMinutes` | 10080 | Per-request timeout (1 week) |

## Support

For questions or issues:
1. Check the [Quick Reference](Backend_Pause_Quick_Reference.md) for common problems
2. Review the [Migration Guide](Backend_Pause_Migration_Guide.md) FAQ
3. Test with scenarios from [Testing Guide](Backend_Pause_Testing.md)
4. File a GitHub issue if problems persist

## Documentation Statistics

- **Total Pages**: 5
- **Total Size**: ~32.7 KB
- **Total Words**: ~7,500
- **Test Scenarios**: 10
- **Configuration Examples**: 15+
- **Code Examples**: 20+

## Last Updated

This documentation set was created for the initial release of the Backend Pause-On-Outage feature.
