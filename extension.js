/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */


import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
const notifyTitle = "Battery Helper";

function logErrorAndNotify(msg) {
    logError(msg);
    Main.notifyError(notifyTitle, `Battery Helper failed: ${msg}`);
}

function runProgramWithNotify(cmd, comment, notifyWhenSuccess = false) {
    let res = GLib.shell_parse_argv(cmd);
    let success = res[0];
    let argv = res[1];
    if (!success) {
        logErrorAndNotify(`${cmd} cannot be parsed by Glib.shell_parse_argv`);
    } else {
        try {
            let proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            proc.wait_check_async(null, (_proc, result) => {
                try {
                    if (_proc.wait_check_finish(result)) {
                        log(`${comment} successfully executed`);
                        if (notifyWhenSuccess)
                            Main.notify(notifyTitle, `${comment} executed successfully`);
                    } else {
                        logErrorAndNotify(`${comment} failed`);
                    }
                } catch (e) {
                    logErrorAndNotify(e);
                }
            });
        } catch (e) {
            logErrorAndNotify(e);
        }
    }
}

function readUTF8File(path) {
    const file = Gio.File.new_for_path(path);
    const [success, contents] = file.load_contents(null);
    if (!success || !contents.length)
        throw new Error('Unsuccessful file load contents');

    const decoder = new TextDecoder('utf-8');
    return decoder.decode(contents);
}

function getBatteryPower() {
    const contentsString = readUTF8File('/sys/class/power_supply/BAT0/power_now');
    const number = parseInt(contentsString);

    return number / 1000000;
}

function isPerformanceCPUOnline() {
    // CPU0 is always online
    // CPU1-7 are performance CPUs
    // CPU8-15 are efficiency CPUs
    for (let i = 1; i < 8; i++) {
        const path = `/sys/devices/system/cpu/cpu${i}/online`;
        const res = readUTF8File(path)[0];
        if (res === '0')
            return false;
    }
    return true;
}

const BatteryMenuToggle = GObject.registerClass(
    class BatteryMenuToggle extends QuickSettings.QuickMenuToggle {
        _init() {
            const ICON_NAME = 'battery-good-symbolic';
            super._init({
                title: 'Battery',
                iconName: ICON_NAME,
                toggleMode: false,
            });

            // Compatible with GNOME 43+
            // this.label = 'Battery';

            // This function is unique to this class. It adds a nice header with an
            // icon, title and optional subtitle. It's recommended you do so for
            // consistency with other menus.
            this.menu.setHeader(ICON_NAME, 'Battery Helper');

            // You may also add sections of items to the menu
            this._itemsSection = new PopupMenu.PopupMenuSection();

            this._menuItem = {};
            this._menuItem.currentPower = new PopupMenu.PopupMenuItem('Current Battery Power: ?', {});
            this._itemsSection.addMenuItem(this._menuItem.currentPower);

            this._menuItem.pcputoggle = new PopupMenu.PopupMenuItem('(Getting CPU1-7 status)', {});
            this._itemsSection.addMenuItem(this._menuItem.pcputoggle);
            const PCPUDISABLE = 'Disable Performance CPUs';
            const PCPUENABLE = 'Enable Performance CPUs';
            this._menuItem.pcputoggle.connect('activate', (item, _event) => {
                let text = '';
                if (item.label.text === PCPUDISABLE) {
                    text = 'disable';
                } else if (item.label.text === PCPUENABLE) {
                    text = 'enable';
                } else {
                    logErrorAndNotify('Unknown label text for pcputoggle item');
                    return;
                }

                runProgramWithNotify(`pkexec pcpuonline.sh ${text}`, `pcpuonline.sh ${text}`, true);
            });

            this.menu.connect('open-state-changed', async (menu, open) => {
                if (open) {
                    let currentPower;
                    try {
                        currentPower = await getBatteryPower();
                        currentPower = `${currentPower.toFixed(2)}W`;
                    } catch (e) {
                        logError(e);
                        currentPower = 'unknown';
                    }
                    this._menuItem.currentPower.label.text = `Current Battery Power: ${currentPower}`;

                    let performanceCPUOnline;
                    try {
                        performanceCPUOnline = isPerformanceCPUOnline();
                    } catch (e) {
                        logError(e);
                        performanceCPUOnline = null;
                    }

                    if (performanceCPUOnline !== null) {
                        if (performanceCPUOnline)
                            this._menuItem.pcputoggle.label.text = PCPUDISABLE;
                        else
                            this._menuItem.pcputoggle.label.text = PCPUENABLE;
                        this._menuItem.pcputoggle.sensitive = true;
                    } else {
                        this._menuItem.pcputoggle.sensitive = false;
                    }
                }
            });

            this._itemsSection.addAction('Open Powertop', () => {
                runProgramWithNotify('gtk-launch PowerTOP', 'powertop');
            });

            this._menuItem.tlpBatteryCare = new PopupMenu.PopupSubMenuMenuItem('TLP Battery Care', true, {});
            this._menuItem.tlpBatteryCare.icon.icon_name = 'battery-full-charged-symbolic';
            this._itemsSection.addMenuItem(this._menuItem.tlpBatteryCare);
            this._menuItem.tlpBatteryCare.menu.addAction('Force fullcharge until reboot', () => {
                runProgramWithNotify('pkexec tlp fullcharge', 'tlp fullcharge', true);
            });
            this._menuItem.tlpBatteryCare.menu.addAction('Restore to default', () => {
                runProgramWithNotify('pkexec tlp setcharge', 'tlp setcharge', true);
            });

            this.menu.addMenuItem(this._itemsSection);
        }
    }
);

const BatteryMenuIndicator = GObject.registerClass(
    class BatteryMenuIndicator extends QuickSettings.SystemIndicator {
    }
);


export default class BatteryExtension extends Extension {
    enable() {
        this._indicator = new BatteryMenuIndicator();
        this._indicator.quickSettingsItems.push(new BatteryMenuToggle(this));

        QuickSettingsMenu.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
        this._indicator = null;
    }
}
