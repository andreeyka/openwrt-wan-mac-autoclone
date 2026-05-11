# WAN MAC Autoclone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish an OpenWrt WAN MAC autoclone package pair with UCI, LuCI, startup policy selection, repo hygiene, and publish instructions.

**Architecture:** Keep the existing two-package layout. The shell CLI remains the source of truth for capture, validation, state, and network writes; LuCI talks through UCI and rpcd.

**Tech Stack:** OpenWrt package Makefiles, BusyBox/POSIX shell, UCI, procd, hotplug.d, rpcd, LuCI JavaScript.

---

### Task 1: Add startup policy to core package

**Files:**
- Modify: `wan-mac-autoclone/files/etc/config/wan-mac-autoclone`
- Modify: `wan-mac-autoclone/files/usr/sbin/wan-mac-autoclone`
- Modify: `wan-mac-autoclone/files/etc/init.d/wan-mac-autoclone`

- [ ] Add `option policy 'once'` to default UCI config with comments for `once` and `boot`.
- [ ] Load `policy` in the CLI and expose it in `status` JSON.
- [ ] Implement `boot_prepare`: in `policy=boot`, clear state and remove existing managed `macaddr`; in `policy=once`, re-apply locked MAC if present.
- [ ] Update init.d boot path to call `boot_prepare`.
- [ ] Ensure ARP poller starts on boot when `policy=boot` clears the lock and mode is `arp`.

### Task 2: Fix shell robustness

**Files:**
- Modify: `wan-mac-autoclone/files/usr/sbin/wan-mac-autoclone`
- Modify: `wan-mac-autoclone/files/usr/libexec/rpcd/wan-mac-autoclone`

- [ ] Make ignore-list matching deterministic without relying on a subshell return value.
- [ ] Escape JSON strings in `status` output.
- [ ] Avoid shared fixed temp log filenames in rpcd action calls.
- [ ] Keep commands BusyBox-compatible.

### Task 3: Add LuCI policy control

**Files:**
- Modify: `luci-app-wan-mac-autoclone/htdocs/luci-static/resources/view/wan-mac-autoclone/overview.js`

- [ ] Show `policy` in the live status table.
- [ ] Add a ListValue setting for `policy` with `once` and `boot`.
- [ ] Keep `mode` as the capture source selector.

### Task 4: Prepare repository

**Files:**
- Create: `.gitignore`
- Create: `LICENSE`
- Modify: `README.md`
- Delete: `.DS_Store` files

- [ ] Add GPL-2.0-or-later license text.
- [ ] Ignore macOS metadata and build artifacts.
- [ ] Document `policy`, package layout, build, install, LuCI, CLI, and GitHub publish commands.
- [ ] Remove committed/untracked macOS metadata files.

### Task 5: Verify

**Files:**
- Read-only verification across package files.

- [ ] Run shell syntax checks with `sh -n` for shell scripts.
- [ ] Run JSON parser checks for menu and ACL files.
- [ ] Run git status review.
- [ ] Commit implementation changes.
