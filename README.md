# Login.net Usage

A GNOME Shell extension that reads the upload and download totals from a MikroTik hotspot status page and shows their combined usage in the top panel.

## Releases

Releases use semantic version tags: `vMAJOR.MINOR.PATCH` (for example, `v0.1.0`). Increase the patch number for fixes, the minor number for compatible features, and the major number for breaking changes. Git tags are the project's release versions. The `version` field in `metadata.json` is reserved for GNOME Extensions' internal use.

Values reported in `MiB` are converted to decimal `MB` (`1 MiB = 1.048576 MB`). The total, download, and upload amounts are displayed in decimal `GB` to two decimal places.

## Settings

- **Menu alignment:** left, center (default), or right relative to the panel item.
- **Status page address:** defaults to `http://login.net/status`.
- **Check usage every:** defaults to 60 seconds.
- **Use 12-hour time:** off by default, so the update time uses a 24-hour clock.
- When the status page cannot be read, the panel shows a warning icon; open the panel item for the error details and status page link.

## Install from Git

Clone the repository into GNOME's extension folder, compile its settings schema, then enable it:

```sh
mkdir -p ~/.local/share/gnome-shell/extensions
git clone https://github.com/tanaka-mambinge/gnome-internet-usage.git ~/.local/share/gnome-shell/extensions/internetusage@iamt12e
glib-compile-schemas ~/.local/share/gnome-shell/extensions/internetusage@iamt12e/schemas
gnome-extensions enable internetusage@iamt12e
```

### Install with an AI agent

If you want an AI agent to install the extension, copy and send it this prompt:

```text
Install the Login.net Usage GNOME Shell extension for the current user, then verify that it is active.

Before changing anything, confirm that this computer is running a GNOME session, that GNOME Shell is version 45, 46, 47, 48, 49, or 50, and that `git`, `glib-compile-schemas`, and `gnome-extensions` are available. If any check fails, stop and report the blocker. Do not use sudo or install system packages.

Install from https://github.com/tanaka-mambinge/gnome-internet-usage.git into `~/.local/share/gnome-shell/extensions/internetusage@iamt12e`. If that destination already exists, do not overwrite or modify it; report what exists and ask me before proceeding.

After confirming the destination does not exist, run these steps for the current user:
1. Create `~/.local/share/gnome-shell/extensions` if needed.
2. Clone the repository into `~/.local/share/gnome-shell/extensions/internetusage@iamt12e`.
3. Compile its settings schema with `glib-compile-schemas ~/.local/share/gnome-shell/extensions/internetusage@iamt12e/schemas`.
4. Enable the extension with `gnome-extensions enable internetusage@iamt12e`.
5. Check `gnome-extensions info internetusage@iamt12e` and report whether its state is active. If any step fails, stop and report the error without trying another installation method.
```

The extension preferences let you change the status page address, refresh interval, and time format.

## Test without logging out

On Wayland, GNOME's development kit can run a separate Shell session in a window. GNOME 49 and later require the `mutter-devkit` package. On Nobara or Fedora, install it with `sudo dnf install mutter-devkit`. Then start the development Shell from a terminal in your current session:

```sh
dbus-run-session -- gnome-shell --devkit --wayland
```

In the new Shell window, open a terminal and enable the extension:

```sh
gnome-extensions enable internetusage@iamt12e
```

For code changes, copy the updated files into the installed extension folder, compile the schema if it changed, then close the development Shell with `Alt`+`F2`, enter `debugexit`, and launch the command again. This runs separately from your regular desktop session. See the [GNOME extension development guide](https://gjs.guide/extensions/development/creating.html#testing-the-extension) for details.
