import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class InternetUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Usage'});
        window.add(page);

        const panelGroup = new Adw.PreferencesGroup({
            title: 'Panel menu',
            description: 'Choose how the menu lines up with its panel item.',
        });
        page.add(panelGroup);

        const alignments = ['left', 'center', 'right'];
        const alignmentRow = new Adw.ComboRow({
            title: 'Menu alignment',
            model: Gtk.StringList.new(['Left', 'Center', 'Right']),
        });
        alignmentRow.selected = alignments.indexOf(settings.get_string('menu-alignment'));
        alignmentRow.connect('notify::selected', () => {
            settings.set_string('menu-alignment', alignments[alignmentRow.selected]);
        });
        panelGroup.add(alignmentRow);

        const timeGroup = new Adw.PreferencesGroup({
            title: 'Time display',
            description: 'Choose how the update time is shown.',
        });
        page.add(timeGroup);

        const timeFormatRow = new Adw.SwitchRow({title: 'Use 12-hour time'});
        settings.bind('use-12-hour-time', timeFormatRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        timeGroup.add(timeFormatRow);

        const connectionGroup = new Adw.PreferencesGroup({
            title: 'Connection',
            description: 'Choose the hotspot status page and how often to check it.',
        });
        page.add(connectionGroup);

        const urlRow = new Adw.EntryRow({title: 'Status page address'});
        urlRow.set_text(settings.get_string('status-url'));
        urlRow.connect('changed', () => settings.set_string('status-url', urlRow.get_text()));
        connectionGroup.add(urlRow);

        const refreshRow = new Adw.SpinRow({
            title: 'Check usage every (seconds)',
            adjustment: new Gtk.Adjustment({
                lower: 15,
                upper: 3600,
                step_increment: 15,
                page_increment: 60,
                value: settings.get_uint('refresh-interval'),
            }),
        });
        refreshRow.connect('notify::value', () => settings.set_uint('refresh-interval', Math.round(refreshRow.value)));
        connectionGroup.add(refreshRow);

    }
}
