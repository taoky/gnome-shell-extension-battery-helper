# gnome-shell-extension-battery-helper

![Screenshot1](assets/screenshot.png)

![Screenshot2](assets/screenshot2.png)

![Screenshot3](assets/screenshot3.png)

Currently supports GNOME 45 & 46.

## Requirements

1. `gtk-launch`, `tlp` and `powertop` available.
2. `PowerTOP.desktop` copied to `~/.local/share/applications/`.
3. `pcpuonline.sh` copied to somewhere in `$PATH`.

Optional:

1. By default, `pcpuonline.sh` controls CPU1-7. Modify it to fit your needs (CPU0 cannot be offline).

## Limitation

1. The current battery power will not be automatically updated when the menu is kept open.
2. Supports one battery only.
