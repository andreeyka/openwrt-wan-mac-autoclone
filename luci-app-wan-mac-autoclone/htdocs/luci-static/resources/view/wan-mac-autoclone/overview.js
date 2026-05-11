'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';
'require poll';

/*
 * LuCI view for wan-mac-autoclone.
 *
 * Layout:
 *   1. Live status panel (read-only) powered by ubus wan-mac-autoclone.status.
 *   2. uci-backed settings form (enabled / mode / wan_iface / lan_bridge / poll_interval).
 *   3. Action buttons that call wan-mac-autoclone.reclone and .reset over ubus.
 */

var callStatus  = rpc.declare({
	object: 'wan-mac-autoclone',
	method: 'status'
});

var callReclone = rpc.declare({
	object: 'wan-mac-autoclone',
	method: 'reclone',
	expect: { ok: false }
});

var callReset   = rpc.declare({
	object: 'wan-mac-autoclone',
	method: 'reset',
	expect: { ok: false }
});

function fmtTimestamp(ts) {
	if (!ts || ts === '0' || ts === 0)
		return '-';
	var n = parseInt(ts, 10);
	if (isNaN(n) || n <= 0)
		return '-';
	return new Date(n * 1000).toLocaleString();
}

function renderStatus(status) {
	status = status || {};
	var rows = [
		[ _('Enabled'),       status.enabled ? _('yes') : _('no') ],
		[ _('Mode'),          status.mode || '-' ],
		[ _('Startup policy'), status.policy || '-' ],
		[ _('WAN interface'), status.wan_iface || '-' ],
		[ _('WAN device'),    status.wan_device || '-' ],
		[ _('LAN bridge'),    status.lan_bridge || '-' ],
		[ _('Locked'),        status.locked ? _('yes') : _('no') ],
		[ _('Locked MAC'),    status.locked_mac || '-' ],
		[ _('Source'),        status.locked_source || '-' ],
		[ _('Locked at'),     fmtTimestamp(status.locked_at) ]
	];

	var tbody = rows.map(function(r) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'style': 'width:35%' }, r[0]),
			E('td', { 'class': 'td left' }, r[1])
		]);
	});

	return E('table', { 'class': 'table' }, tbody);
}

function runAction(method, label) {
	ui.showModal(_('Running…'), [
		E('p', { 'class': 'spinning' }, _('Executing %s …').format(label))
	]);
	return method().then(function(res) {
		ui.hideModal();
		if (res && res.ok) {
			ui.addNotification(null, E('p', _('%s finished.').format(label)), 'info');
		} else {
			var msg = (res && res.error) ? res.error : _('Command failed.');
			ui.addNotification(null, E('p', msg), 'danger');
		}
		// Refresh the page to pick up new status.
		window.setTimeout(function() { location.reload(); }, 800);
	}).catch(function(err) {
		ui.hideModal();
		ui.addNotification(null, E('p', '%s'.format(err)), 'danger');
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('wan-mac-autoclone'),
			callStatus().catch(function() { return {}; })
		]);
	},

	render: function(data) {
		var status = data[1] || {};
		var m, s, o;

		m = new form.Map('wan-mac-autoclone', _('WAN MAC Autoclone'),
			_('Capture the MAC of the first LAN client and clone it onto the WAN interface, then lock it. ' +
			  'Useful when the ISP binds the uplink to a specific MAC and the router has to be moved between sites.'));

		// --- Status section (read-only) --------------------------------------
		s = m.section(form.NamedSection, '_status', 'state', _('Current status'));
		s.render = function() {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Current status')),
				renderStatus(status),
				E('div', { 'class': 'cbi-section-node', 'style': 'margin-top:1em' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': ui.createHandlerFn(this, function() {
							return runAction(callReclone, _('Re-clone'));
						})
					}, _('Re-clone now')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'click': ui.createHandlerFn(this, function() {
							if (!confirm(_('Clear the lock and remove the WAN macaddr override?')))
								return;
							return runAction(callReset, _('Reset'));
						})
					}, _('Reset lock'))
				])
			]);
		};

		// --- Settings section -------------------------------------------------
		s = m.section(form.NamedSection, 'global', 'autoclone', _('Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable autoclone'),
			_('Master switch. When off, no hooks fire and no MAC is altered.'));
		o.rmempty  = false;
		o.default  = '1';

		o = s.option(form.ListValue, 'mode', _('Capture mode'),
			_('How to pick the MAC to clone.'));
		o.value('dhcp', _('DHCP lease (recommended)'));
		o.value('arp',  _('First ARP neighbour'));
		o.default = 'dhcp';

		o = s.option(form.ListValue, 'policy', _('Startup policy'),
			_('Whether to keep the first saved MAC or capture a new one on every boot.'));
		o.value('once', _('Capture once, then reuse saved MAC'));
		o.value('boot', _('Capture a new MAC on every boot'));
		o.default = 'once';

		o = s.option(form.Value, 'wan_iface', _('WAN interface'),
			_('Name of the /etc/config/network interface to clone onto.'));
		o.default = 'wan';
		// Try to autocomplete from existing interfaces.
		uci.sections('network', 'interface', function(sec) {
			if (sec['.name']) o.value(sec['.name']);
		});

		o = s.option(form.Value, 'lan_bridge', _('LAN bridge'),
			_('Device that exposes the LAN side. Only used in ARP mode.'));
		o.default = 'br-lan';
		o.depends('mode', 'arp');

		o = s.option(form.Value, 'poll_interval', _('ARP poll interval (s)'),
			_('How often to scan the ARP table. Only used in ARP mode.'));
		o.datatype = 'uinteger';
		o.default  = '15';
		o.depends('mode', 'arp');

		o = s.option(form.DynamicList, 'ignore_mac', _('Ignored MACs (regex)'),
			_('MAC addresses matching any of these patterns are skipped. Useful to ' +
			  'exclude IoT devices or the router itself.'));
		o.rmempty = true;

		return m.render();
	}
});
