# gnome-shell-extension-battery-helper

![Screenshot1](assets/screenshot.png)

![Screenshot2](assets/screenshot2.png)

## Requirements

1. `gtk-launch`, `tlp` and `powertop` available.
2. `PowerTOP.desktop` copied to `~/.local/share/applications/`.
3. Allow NOPASSWD sudo for `tlp fullcharge` and `tlp setcharge`.

Optional:

1. Allow NOPASSWD sudo for `powertop`, and modify `pkexec` to `sudo` in `PowerTOP.desktop`.

## Limiation

1. The current battery power will not be automatically updated when the menu is kept open.
2. Supports one battery only.

