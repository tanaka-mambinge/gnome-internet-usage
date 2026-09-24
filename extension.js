import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

function cleanHtml(value) {
    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function parseDataAmount(value) {
    const match = value.match(/([\d,.]+)\s*(B|KiB|MiB|GiB|TiB|KB|MB|GB|TB)\b/i);
    if (!match)
        return null;

    const amount = Number.parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2].toUpperCase();
    const powers = {
        B: 0, KIB: 1, MIB: 2, GIB: 3, TIB: 4,
        KB: 1, MB: 2, GB: 3, TB: 4,
    };
    const base = unit.endsWith('IB') ? 1024 : 1000;
    const bytes = amount * base ** powers[unit];
    return bytes / 1_000_000;
}

function parseStatusPage(html) {
    const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    let uploadMb = null;
    let downloadMb = null;
    let ipAddress = '';

    for (const [, row] of rows) {
        const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
            .map(([, cell]) => cleanHtml(cell));
        if (cells.length < 2)
            continue;

        const label = cells[0].toLowerCase().replace(/\s+/g, ' ').replace(/:$/, '');
        if (label.includes('bytes up/down') || label.includes('bytes up / down')) {
            const amounts = [...cells[1].matchAll(/([\d,.]+\s*(?:B|KiB|MiB|GiB|TiB|KB|MB|GB|TB))\b/gi)];
            if (amounts.length >= 2) {
                uploadMb = parseDataAmount(amounts[0][1]);
                downloadMb = parseDataAmount(amounts[1][1]);
            }
        } else if (label === 'ip address') {
            ipAddress = cells[1];
        }
    }

    if (uploadMb === null || downloadMb === null ||
        !Number.isFinite(uploadMb) || !Number.isFinite(downloadMb))
        throw new Error('Could not find upload and download totals on the status page.');

    return {uploadMb, downloadMb, totalMb: uploadMb + downloadMb, ipAddress};
}

function formatGb(mb) {
    return `${(mb / 1000).toFixed(1)} GB`;
}

function formatMb(mb) {
    return `${mb.toFixed(1)} MB`;
}

const MENU_ALIGNMENTS = {left: 0, center: 0.5, right: 1};

export default class InternetUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._session = new Soup.Session({timeout: 15});
        this._cancellable = null;
        this._timerId = 0;
        this._usage = null;
        this._lastUpdated = null;

        const menuAlignment = MENU_ALIGNMENTS[this._settings.get_string('menu-alignment')];
        this._indicator = new PanelMenu.Button(menuAlignment, this.metadata.name, false);
        this._applyMenuAlignment();
        this._panelIcon = new St.Icon({
            icon_name: 'dialog-warning-symbolic',
            style_class: 'system-status-icon',
            accessible_name: 'Usage unavailable',
            visible: false,
        });
        this._indicator.add_child(this._panelIcon);
        this._panelLabel = new St.Label({
            text: '— GB',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(this._panelLabel);

        this._summaryItem = new PopupMenu.PopupMenuItem('Loading usage…', {reactive: false});
        this._indicator.menu.addMenuItem(this._summaryItem);
        this._trafficItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._indicator.menu.addMenuItem(this._trafficItem);
        this._ipItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._indicator.menu.addMenuItem(this._ipItem);
        this._progressItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this._progressTrack = new St.Widget({
            width: 220,
            height: 8,
            style: 'background-color: rgba(127, 127, 127, 0.35); border-radius: 4px;',
        });
        this._progressFill = new St.Widget({
            width: 0,
            height: 8,
            style: 'background-color: #3584e4; border-radius: 4px;',
        });
        this._progressTrack.add_child(this._progressFill);
        this._progressItem.add_child(this._progressTrack);
        this._indicator.menu.addMenuItem(this._progressItem);
        this._progressLabelItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._indicator.menu.addMenuItem(this._progressLabelItem);
        this._updatedItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._indicator.menu.addMenuItem(this._updatedItem);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addAction('Refresh now', () => this._fetchUsage());
        this._indicator.menu.addAction('Open status page', () => this._openStatusPage());
        this._indicator.menu.addAction('Usage settings', () => this.openPreferences());

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
            if (key === 'menu-alignment') {
                this._applyMenuAlignment();
                return;
            }

            this._scheduleRefresh();
            this._fetchUsage();
        });
        this._scheduleRefresh();
        this._fetchUsage();
    }

    disable() {
        if (this._timerId)
            GLib.Source.remove(this._timerId);
        this._timerId = 0;
        this._cancellable?.cancel();
        this._cancellable = null;
        this._session?.abort();
        this._session = null;
        if (this._settings && this._settingsChangedId)
            this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = 0;
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }

    _openStatusPage() {
        const url = this._settings.get_string('status-url').trim();
        try {
            Gio.AppInfo.launch_default_for_uri(url, null);
        } catch (error) {
            this._summaryItem.label.text = 'Could not open the status page.';
        }
    }

    _applyMenuAlignment() {
        const alignment = MENU_ALIGNMENTS[this._settings.get_string('menu-alignment')];
        this._indicator.menu._arrowAlignment = alignment;
        this._indicator.menu.setSourceAlignment(alignment);
    }

    _scheduleRefresh() {
        if (this._timerId)
            GLib.Source.remove(this._timerId);
        const seconds = Math.max(15, this._settings.get_uint('refresh-interval'));
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._fetchUsage();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _fetchUsage() {
        const url = this._settings.get_string('status-url').trim();
        const message = Soup.Message.new('GET', url);
        if (!message) {
            this._showError('Check the status page address in settings.');
            return;
        }

        this._cancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        this._summaryItem.label.text = 'Loading usage…';
        this._trafficItem.visible = false;
        this._ipItem.visible = false;
        this._progressItem.visible = false;
        this._progressLabelItem.visible = false;
        this._updatedItem.visible = false;

        this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            cancellable,
            (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    if (cancellable.is_cancelled())
                        return;
                    if (message.get_status() < 200 || message.get_status() >= 300)
                        throw new Error(`Status page returned HTTP ${message.get_status()}.`);
                    const html = new TextDecoder('utf-8').decode(bytes.get_data());
                    this._usage = parseStatusPage(html);
                    this._lastUpdated = new Date();
                    this._updateDisplay();
                } catch (error) {
                    if (!cancellable.is_cancelled() && this._cancellable === cancellable)
                        this._showError(error.message || 'Could not load usage.');
                }
            }
        );
    }

    _updateDisplay() {
        if (!this._usage)
            return;

        const {totalMb, uploadMb, downloadMb, ipAddress} = this._usage;
        const capGb = this._settings.get_double('max-usage-gb');
        const totalGb = totalMb / 1000;
        this._panelLabel.text = formatGb(totalMb);
        this._panelLabel.visible = true;
        this._panelIcon.visible = false;
        this._indicator.accessible_name = `Internet usage: ${formatGb(totalMb)}`;
        this._summaryItem.label.text = `Total used: ${formatGb(totalMb)}`;
        this._trafficItem.visible = true;
        this._trafficItem.label.text = `Downloaded ${formatMb(downloadMb)} · Uploaded ${formatMb(uploadMb)}`;
        this._ipItem.label.text = ipAddress ? `IP address: ${ipAddress}` : 'IP address unavailable';
        this._ipItem.visible = true;
        this._progressItem.visible = capGb > 0;
        this._progressLabelItem.visible = capGb > 0;
        if (capGb > 0) {
            const fraction = Math.min(1, totalGb / capGb);
            this._progressFill.set_width(Math.round(220 * fraction));
            this._progressLabelItem.label.text = `${formatGb(totalMb)} of ${capGb.toFixed(1)} GB`;
        }
        this._updatedItem.label.text = `Updated ${this._lastUpdated.toLocaleTimeString()}`;
        this._updatedItem.visible = true;
    }

    _showError(message) {
        this._panelLabel.visible = false;
        this._panelIcon.icon_name = 'dialog-warning-symbolic';
        this._panelIcon.accessible_name = 'Usage unavailable';
        this._panelIcon.visible = true;
        this._indicator.accessible_name = 'Internet usage unavailable';
        this._summaryItem.label.text = 'Could not read usage. Check connection and status page.';
        this._trafficItem.visible = false;
        this._ipItem.visible = false;
        this._progressItem.visible = false;
        this._progressLabelItem.visible = false;
        this._updatedItem.label.text = '';
        this._updatedItem.visible = false;
    }
}
