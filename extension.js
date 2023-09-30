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

/* exported init */

const {GObject, Gio, GLib} = imports.gi;

const Main = imports.ui.main;

const PopupMenu = imports.ui.popupMenu;
const QuickSettings = imports.ui.quickSettings;

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;

function logErrorAndNotify(msg) {
    logError(msg);
    Main.notifyError(`Battery Helper failed: ${msg}`);
}

function runProgramWithNotify(cmd, comment) {
    let res = GLib.shell_parse_argv(cmd);
    let success = res[0];
    let argv = res[1];
    if (!success) {
        logErrorAndNotify(`Glib.shell_parse_argv cannot parse cmd: ${cmd}`);
    } else {
        try {
            let proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            proc.wait_check_async(null, (_proc, result) => {
                try {
                    if (_proc.wait_check_finish(result))
                        log(`${comment} successfully executed`);
                    else
                        logErrorAndNotify(`the process to execute the ${comment} failed`);
                } catch (e) {
                    logErrorAndNotify(e);
                }
            });
        } catch (e) {
            logErrorAndNotify(e);
        }
    }
}

function getBatteryPower() {
    const file = Gio.File.new_for_path('/sys/class/power_supply/BAT0/power_now');
    const [success, contents] = file.load_contents(null);
    if (!success || !contents.length)
        throw new Error('Unsuccessful file load contents');

    const decoder = new TextDecoder('utf-8');
    const contentsString = decoder.decode(contents);
    const number = parseInt(contentsString);

    return number / 1000000;
}

const BatteryMenuToggle = GObject.registerClass(
    class BatteryMenuToggle extends QuickSettings.QuickMenuToggle {
        _init() {
            const ICON_NAME = 'battery-good-symbolic';
            super._init({
                title: 'Battery',
                iconName: ICON_NAME,
                toggleMode: true,
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
                }
            });

            this._itemsSection.addAction('Open Powertop', () => {
                runProgramWithNotify('gtk-launch PowerTOP', 'powertop');
            });

            this._menuItem.tlpBatteryCare = new PopupMenu.PopupSubMenuMenuItem('TLP Battery Care', true, {});
            this._menuItem.tlpBatteryCare.icon.icon_name = 'battery-full-charged-symbolic';
            this._itemsSection.addMenuItem(this._menuItem.tlpBatteryCare);
            this._menuItem.tlpBatteryCare.menu.addAction('Force fullcharge until reboot', () => {
                runProgramWithNotify('sudo tlp fullcharge', 'tlp fullcharge');
            });
            this._menuItem.tlpBatteryCare.menu.addAction('Restore to default', () => {
                runProgramWithNotify('sudo tlp setcharge', 'tlp setcharge');
            });

            this.menu.addMenuItem(this._itemsSection);
        }
    }
);

const BatteryMenuIndicator = GObject.registerClass(
    class BatteryMenuIndicator extends QuickSettings.SystemIndicator {
        _init() {
            super._init();

            this.quickSettingsItems.push(new BatteryMenuToggle());

            this.connect('destroy', () => {
                this.quickSettingsItems.forEach(item => item.destroy());
            });

            QuickSettingsMenu._indicators.add_child(this);
            QuickSettingsMenu._addItems(this.quickSettingsItems);

            // Ensure it above background apps
            for (const item of this.quickSettingsItems) {
                QuickSettingsMenu.menu._grid.set_child_below_sibling(item,
                    QuickSettingsMenu._backgroundApps.quickSettingsItems[0]);
            }
        }
    }
);


class Extension {
    enable() {
        this._indicator = new BatteryMenuIndicator();
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init() {
    return new Extension();
}
