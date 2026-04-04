# Crostini Networking: LAN Access for PAI Services

**Platform:** ChromeOS (Crostini/Penguin container)
**Last Updated:** 2026-03-27

---

## Overview

PAI services run inside the Crostini (Penguin) container. The Chromebook's LAN IP (e.g. `pixel.lan`) is the ChromeOS host — **not** the container. Traffic to `pixel.lan:<port>` reaches the Chromebook but won't reach services in Crostini without explicit iptables DNAT rules.

### Network Topology

```
External device → pixel.lan (192.168.127.193)  ← ChromeOS host (wlan0)
                                                       ↓  iptables DNAT required
                                               Crostini container (100.115.92.196)
                                                       ↓
                                               PAI services (0.0.0.0:PORT)
```

### Crostini Container IPs

```
172.17.0.1        Docker bridge (internal)
100.115.92.196    Crostini internal / Tailscale IP
```

---

## ChromeOS Port Forwarding UI (Correct Setup)

Chrome Settings → Advanced → Developers → Linux → **Port forwarding**

**Two things are required — both are easy to miss:**

1. **Add all service ports** to the list (Port number + Label)
2. **Enable the toggle** at the top of the Port Forwarding section — ports are listed but disabled by default

After enabling the toggle, **restart Linux** (Shut down Linux from the same settings page, then re-enable). This causes `patchpanel` to install the DNAT rules on the ChromeOS host's iptables.

> **Root cause of the original issue:** The ports were configured in the list but the enable toggle was off. `patchpanel` ignores configured ports until forwarding is explicitly enabled.

Verify rules were installed (run from **crosh shell**, not Crostini terminal):

```bash
# In crosh (Ctrl+Alt+T → shell)
sudo iptables -t nat -L PREROUTING -n -v
```

If you see only the Docker rule and nothing for your service ports, proceed to the manual fix below.

---

## Manual iptables Fix (Required after each reboot)

These rules must be run from **inside the Crostini container** (not crosh). They are wiped on reboot.

### Add DNAT Rules

```bash
# Frontend services
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 4444 -j DNAT --to-destination 100.115.92.196:4444
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 4242 -j DNAT --to-destination 100.115.92.196:4242
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 5172 -j DNAT --to-destination 100.115.92.196:5172
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 5173 -j DNAT --to-destination 100.115.92.196:5173
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 5174 -j DNAT --to-destination 100.115.92.196:5174

# Allow forwarding to Crostini
sudo iptables -A FORWARD -p tcp -d 100.115.92.196 -j ACCEPT
```

### Verify Rules Applied

```bash
sudo iptables -t nat -L PREROUTING -n -v
# Should show DNAT entries for each port alongside the Docker rule
```

---

## Port Reference

| Port | Service | Notes |
|------|---------|-------|
| 4100 | awareness-dashboard-server | Backend API |
| 4200 | cyber-alert-mgr-server | Backend API |
| 4242 | memory-dashboard | Discord memory server |
| 4444 | markdown-editor | Web-based PAI markdown viewer |
| 5172 | observability-dashboard | Agent monitoring frontend |
| 5173 | awareness-dashboard | Awareness frontend |
| 5174 | cyber-alert-mgr | Cyber Alert Manager frontend |
| 8888 | voice-server | Server-side only — not forwarded |

**Note:** Ports 4100 and 4200 (backends) are not in the DNAT list above because they are accessed via Vite proxy from the frontend containers — add them if you need direct external API access.

---

## Why curl from Crostini Fails (Hairpin NAT)

Testing with `curl http://pixel.lan:PORT` or `curl http://192.168.127.193:PORT` from **within Crostini** will always hang or fail. This is expected — the request goes out of Crostini, hits the Chromebook's external IP, and ChromeOS does not loop it back into Crostini (no hairpin NAT support).

**Always test from an external device** (phone, another laptop on the same WiFi).

---

## Persistent Fix Attempt

Try restarting Linux from Chrome settings (Settings → Advanced → Developers → Linux → Shut down Linux, then re-enable). This sometimes causes `patchpanel` to correctly install the DNAT rules. If PREROUTING still shows no entries after restart, use the manual fix above.

There is currently no supported method to persist custom iptables rules across reboots on ChromeOS without developer mode.
