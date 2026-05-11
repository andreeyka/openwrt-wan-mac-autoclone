# WAN MAC Autoclone Design

## Goal

Build an OpenWrt package set that can automatically clone a LAN client's MAC
address onto the WAN interface, expose configuration through UCI and LuCI, and
support OpenWrt 23.05, 24.10, and current snapshot-style releases.

## Packages

The project ships two packages:

- `wan-mac-autoclone`: shell CLI, UCI config, hotplug hook, init script, rpcd
  plugin.
- `luci-app-wan-mac-autoclone`: LuCI JavaScript view, menu entry, ACL.

The base package must be fully usable without LuCI.

## Capture Modes

The capture source is controlled by `option mode`:

- `dhcp`: capture the MAC from DHCP add/update hotplug events. This is the
  default and best option for normal LAN clients.
- `arp`: run a procd-managed poller that scans `ip neigh show dev <lan_bridge>`
  until it finds a valid unicast neighbour MAC.

Both modes share the same validation and ignore-list logic.

## Startup Policy

The capture policy is controlled by a separate UCI option:

- `option policy 'once'`: capture only when no locked MAC is stored in
  `/etc/config/wan-mac-autoclone`. On boot, if a locked MAC exists, re-apply it
  to `/etc/config/network` and do not capture a new one.
- `option policy 'boot'`: clear the stored lock on every router boot, then
  capture again using the configured `mode`.

Manual CLI/LuCI actions keep their direct meaning:

- `reset`: clear lock and remove the WAN `macaddr` override.
- `reclone`: clear lock and immediately attempt a new capture.
- `apply <mac>`: validate, write, and lock the provided MAC.

## Network Write Behaviour

The package writes the cloned MAC to a `config device` section in
`/etc/config/network`, using `option macaddr`. It resolves the target device
from `network.<wan_iface>.device`, then legacy `ifname`, then ubus runtime
status when available. If no matching `config device` exists, it creates one.

After writing or clearing `macaddr`, it commits `network` and bounces the WAN
interface with `ifup <wan_iface>`, falling back to network reload.

## State

State lives in:

```text
config state 'state'
        option locked '0'
        option locked_mac ''
        option locked_source ''
        option locked_at ''
        option managed_device_section ''
```

The daemon manages this section. LuCI may trigger state transitions through
ubus, but should not hand-edit state fields.

## LuCI

LuCI provides:

- Live status from `ubus call wan-mac-autoclone status`.
- Settings for `enabled`, `mode`, `policy`, `wan_iface`, `lan_bridge`,
  `poll_interval`, and `ignore_mac`.
- Action buttons for `reclone` and `reset`.

## Repo Readiness

The repository should include a license, gitignore, clean README, no macOS
metadata files, and ready-to-run GitHub CLI commands for publishing.

## Error Handling And Compatibility

The shell code should remain POSIX/BusyBox friendly. JSON output must be valid
for values produced by UCI and system commands. LuCI ACLs must grant UCI read
access to `wan-mac-autoclone` and `network`, and ubus access to status/reclone/reset.

## Testing

The project should include lightweight host-side shell tests for validation,
ignore-list behaviour, policy transitions, and JSON status shape where practical.
OpenWrt buildroot compilation remains the final integration test.
