# wan-mac-autoclone

Automatically clones the MAC address of the first LAN client onto the WAN
interface of an OpenWrt router, then locks it. Useful when your ISP binds the
uplink to a specific MAC and you move the router between sites — no more
clicking "Override MAC" by hand after every relocation.

Tested on OpenWrt 23.05 / 24.10 / SNAPSHOT (DSA).

---

## What it does

1. On first boot (or after `wan-mac-autoclone reset`) the package waits for a
   LAN client to appear.
2. It picks that client's MAC and writes it as `macaddr` on the `config device`
   section backing your WAN interface in `/etc/config/network`.
3. The state is **locked** — the package will not silently change the WAN MAC
   again. The MAC survives reboots, sysupgrades (config retained) and config
   reloads.
4. Moving the router to a new uplink? Run `wan-mac-autoclone reset` or click
   "Reset lock" in LuCI. The next time a LAN client connects, its MAC will be
   captured.

Two capture modes, switchable via UCI or LuCI:

| Mode | How it works | When to use |
| --- | --- | --- |
| `dhcp` (default) | Hooks `/etc/hotplug.d/dhcp/` and captures the first DHCP lease handed out. | Anything with DHCP on LAN — i.e. virtually always. |
| `arp` | A small procd-managed poller scans `ip neigh show dev br-lan` every N seconds. | Devices with static IPs that never DHCP. |

Startup policy is a separate setting:

| Policy | Behaviour |
| --- | --- |
| `once` (default) | If a MAC is already locked in `/etc/config/wan-mac-autoclone`, boot reuses it. If no MAC is locked, the next LAN client is captured and saved. |
| `boot` | Every router boot clears the saved lock and captures again using the selected mode. |

---

## Packages

This repo ships two opkg packages:

* **`wan-mac-autoclone`** — the daemon, hotplug hook, uci config and CLI.
* **`luci-app-wan-mac-autoclone`** — JS-based LuCI view at
  *Network → MAC Autoclone* with live status, settings form and re-clone /
  reset buttons.

The LuCI app is optional. The base package is fully usable from the shell.

---

## Install

### Option A — quick install of pre-built ipks

```sh
# On the router
opkg update
opkg install ./wan-mac-autoclone_*.ipk ./luci-app-wan-mac-autoclone_*.ipk
# Apply LuCI ACLs immediately so the new menu shows up:
/etc/init.d/rpcd reload
```

### Option B — build from source against an OpenWrt feed

```sh
# In your OpenWrt buildroot
git clone https://github.com/<you>/openwrt-wan-mac-autoclone.git \
    package/wan-mac-autoclone
# wan-mac-autoclone has both Makefiles inside; the feeds index will pick
# them up if you symlink the subdirs into your feeds/<your-feed>:
ln -s ../../package/wan-mac-autoclone/wan-mac-autoclone        feeds/myfeed/
ln -s ../../package/wan-mac-autoclone/luci-app-wan-mac-autoclone feeds/myfeed/
./scripts/feeds update myfeed && ./scripts/feeds install -a -p myfeed
make menuconfig   # enable Network → wan-mac-autoclone (and the LuCI app)
make package/wan-mac-autoclone/compile V=s
```

---

## Configuration

Default `/etc/config/wan-mac-autoclone`:

```
config autoclone 'global'
    option enabled       '1'
    option mode          'dhcp'
    option policy        'once'
    option wan_iface     'wan'
    option lan_bridge    'br-lan'
    option poll_interval '15'
    list   ignore_mac    '^00:00:00:00:00:00$'
    list   ignore_mac    '^ff:ff:ff:ff:ff:ff$'

config state 'state'
    option locked        '0'
    option locked_mac    ''
    option locked_source ''
    option locked_at     ''
    option managed_device_section ''
```

The `state` section is managed by the daemon — do not edit it by hand. You can,
however, edit it via the LuCI app (the "Reset lock" button just unsets these
fields and removes the `macaddr` override from `/etc/config/network`).

### Per-option reference

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `1` | Master switch. With `0`, no hooks fire and nothing is changed. |
| `mode` | `dhcp` | `dhcp` or `arp`. See table above. |
| `policy` | `once` | `once` reuses the saved MAC after the first capture; `boot` captures a new MAC on every router boot. |
| `wan_iface` | `wan` | UCI name of the network interface to clone onto. |
| `lan_bridge` | `br-lan` | Bridge / device to scan in ARP mode. |
| `poll_interval` | `15` | ARP poll period, seconds. |
| `ignore_mac` | `^00:00:00:00:00:00$`, `^ff:ff:ff:ff:ff:ff$` | List of MAC regex patterns to skip. Multicast MACs are skipped automatically. |

---

## CLI

```
Usage: wan-mac-autoclone <command> [args]

Commands:
  apply <mac> [source]   Set MAC on WAN and lock state to it.
  tick                   Pick a candidate MAC (per mode) and apply if unlocked.
  reclone                Clear lock, then run tick.
  reset                  Clear lock AND remove macaddr override from network.
  status                 Print current state as JSON.
  boot                   Apply startup policy (called by init.d).
  init                   Re-apply locked MAC without evaluating startup policy.
  poll                   ARP-mode poll loop (procd service).
```

Typical workflow when moving the router to a new ISP / new apartment:

```sh
ssh root@router
wan-mac-autoclone reset
# Reconnect the cable / power-cycle the router. The first LAN client that
# requests DHCP will donate its MAC to the WAN side.
wan-mac-autoclone status      # confirm
```

---

## How the WAN MAC is actually set

Modern OpenWrt (≥21.02) recommends overriding the MAC on the *device* section,
not on the *interface* section. This package follows that convention:

1. Resolves the device for the `wan` interface via `uci get network.wan.device`,
   falling back to `network.wan.ifname` and finally to `ubus
   network.interface.wan status .l3_device`.
2. Looks for an existing `config device` with that `name`. If absent, creates a
   new anonymous one.
3. Sets `option macaddr '<captured-mac>'` and commits `network`.
4. Calls `ifup wan` (with a fallback to `/etc/init.d/network reload`).

Because the override lives in `/etc/config/network` like any other manual MAC
clone, it is preserved across reboots, `sysupgrade -c`, and config reverts.

---

## ubus API

`luci-app-wan-mac-autoclone` talks to the daemon through rpcd:

| Method | Effect |
| --- | --- |
| `wan-mac-autoclone status` | Returns current state as a JSON object. |
| `wan-mac-autoclone reclone` | Clears the lock and runs a fresh capture. |
| `wan-mac-autoclone reset` | Clears the lock and removes the macaddr override. |

Try them with `ubus`:

```sh
ubus call wan-mac-autoclone status
ubus call wan-mac-autoclone reclone
ubus call wan-mac-autoclone reset
```

---

## Create the GitHub repository

From this project directory:

```sh
git add .
git commit -m "feat: add OpenWrt WAN MAC autoclone packages"
gh repo create openwrt-wan-mac-autoclone --public --source=. --remote=origin --push
```

For a private repository, replace `--public` with `--private`.

After publishing, update the clone URL in this README if your GitHub owner/name
differs from `openwrt-wan-mac-autoclone`.

---

## Logs

Everything goes through `logger -t wan-mac-autoclone`. Tail with:

```sh
logread -f -e wan-mac-autoclone
```

---

## License

GPL-2.0-or-later. See `LICENSE`.
