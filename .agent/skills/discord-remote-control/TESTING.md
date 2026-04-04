# Testing Strategy - Discord Remote Control

## Phase 1 Testing: Bot Connection & Scaffold

### Pre-Flight Checklist (Manual)

Before running the bot, verify Discord setup:

- [ ] Discord Developer Portal app created (https://discord.com/developers/applications)
- [ ] Bot added to application
- [ ] Message Content Intent enabled (required!)
- [ ] Server Members Intent enabled (required!)
- [ ] Bot invited to your Discord server
- [ ] Environment variables set in `$PAI_DIR/.env`:
  ```bash
  DISCORD_BOT_TOKEN=<your-token>
  DISCORD_GUILD_ID=<your-server-id>
  DISCORD_CHANNEL_ID=<#general-channel-id>
  DISCORD_ALLOWED_USER_IDS=<your-user-id>
  GROQ_API_KEY=<your-groq-key>
  ```

---

## Test 1: Configuration Validation

**Objective**: Verify config.ts properly validates environment variables

### Manual Test
```bash
# Test missing env var
unset DISCORD_BOT_TOKEN
cd .agent/skills/discord-remote-control/service
bun config.ts  # Should show clear error about DISCORD_BOT_TOKEN
```

**Expected Output**:
```
❌ Configuration Error:
  - DISCORD_BOT_TOKEN not set
  - ...
Please set these variables in $PAI_DIR/.env and try again.
```

### Unit Test (Optional - Phase 9)
```bash
bun test service/__tests__/config.test.ts
```

---

## Test 2: Bot Connectivity

**Objective**: Verify bot connects to Discord and logs ready event

### Setup
1. Ensure `$PAI_DIR/.env` is properly configured
2. Open Discord and verify your server has the bot offline initially

### Start the Service
```bash
cd .agent/skills/discord-remote-control
./scripts/start.sh
```

**Expected Output**:
```
🚀 Starting Discord Remote Control Service...
✅ Service started (PID: 12345)
📋 Log file: .agent/skills/discord-remote-control/service.log
   View logs: tail -f service.log
```

### Verify Bot Comes Online
```bash
# In another terminal, monitor logs
tail -f .agent/skills/discord-remote-control/service.log
```

**Expected Logs**:
```
🚀 Starting Discord Remote Control Service...
✅ Bot logged in as sam-discord-remote#1234
📡 Listening for messages in:
   - Guild ID: 123456789
   - Channel ID: 987654321
   - DMs from allowed users: 555555555
📡 Service running. Press Ctrl+C to stop.
```

**Discord Verification**:
- Bot should appear in your server member list as online
- Bot name should match your Discord app name

---

## Test 3: Service Lifecycle Management

**Objective**: Verify start/stop/status scripts work correctly

### Test Service Start
```bash
./scripts/start.sh
echo $?  # Should be 0 (success)
```

### Test Service Status
```bash
./scripts/status.sh
# Should show: Status: ✅ RUNNING
```

### Test Idempotent Start (call twice)
```bash
./scripts/start.sh
./scripts/start.sh  # Should say "already running"
```

### Test Graceful Stop
```bash
./scripts/stop.sh
sleep 1
./scripts/status.sh  # Should show: Status: ❌ NOT RUNNING
```

### Test Stop Without Running
```bash
./scripts/stop.sh  # Should handle gracefully
```

---

## Test 4: Message Logging (Phase 1 Only)

**Objective**: Verify router logs incoming messages (basic handler)

### Steps
1. Ensure bot is running: `./scripts/status.sh`
2. Send messages in Discord:
   - Text in #general channel
   - DM to the bot (if allowed)
3. Check logs:
   ```bash
   tail -f service.log
   ```

**Expected Log Output**:
```
📨 Message from your_username:
   Channel: Guild #987654321
   Content: Hello bot!
```

**Router Verification**:
- Bot logs messages from allowed users
- Bot logs messages from #general channel
- Bot ignores messages from unauthorized channels (silent)

---

## Test 5: Error Handling

### Test Config Error (Missing Token)
```bash
unset DISCORD_BOT_TOKEN
./scripts/start.sh
# Should fail with clear message
```

### Test Invalid Token
```bash
export DISCORD_BOT_TOKEN="invalid.token.here"
./scripts/start.sh
# Bot should fail to login, check logs
tail -f service.log | grep -i error
```

### Test Network Disconnect
```bash
./scripts/start.sh
# Let it run, then disconnect internet
# Should attempt reconnection (not yet implemented - Phase 9)
# Reconnect internet
# Bot should come back online
```

---

## Phase 1 Success Criteria

- ✅ Config validation catches missing env vars
- ✅ Bot successfully authenticates with Discord
- ✅ Bot appears online in Discord server
- ✅ Bot logs "ready" event to stdout
- ✅ Service start/stop/status scripts work correctly
- ✅ Message logging appears in service.log
- ✅ Graceful shutdown on SIGINT

---

## Troubleshooting

### Bot Won't Login
**Check**:
1. `DISCORD_BOT_TOKEN` is correct (copy from Discord Dev Portal)
2. Bot has permission to view channels
3. No rate limiting (wait 5 minutes)

**Debug**:
```bash
# Check token format (should be long string)
echo $DISCORD_BOT_TOKEN | wc -c  # Should be 70+ chars

# Check logs for specific error
tail -20 service.log | grep -i "error\|invalid"
```

### Bot Doesn't Appear Online
**Check**:
1. Message Content Intent is enabled in Discord Dev Portal
2. Bot has "View Channels" permission in server
3. Server ID matches `DISCORD_GUILD_ID`

### Messages Not Being Logged
**Check**:
1. Send message with your own account
2. Verify `DISCORD_ALLOWED_USER_IDS` includes your user ID
3. Send in correct channel (#general, ID must match `DISCORD_CHANNEL_ID`)
4. Check logs: `tail -f service.log`

---

## Next: Phase 2 Testing

Once message router is implemented, we'll add:
- Access control tests (authorized/unauthorized users)
- Message type detection tests (text/image/file/voice)
- Typing indicator verification
