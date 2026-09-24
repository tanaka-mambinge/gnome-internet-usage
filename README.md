# Login.net Usage

A GNOME Shell extension that reads the upload and download totals from a MikroTik hotspot status page and shows their combined usage in the top panel.

## Releases

Releases use semantic version tags: `vMAJOR.MINOR.PATCH` (for example, `v0.1.0`). Increase the patch number for fixes, the minor number for compatible features, and the major number for breaking changes. Git tags are the project's release versions. The `version` field in `metadata.json` is reserved for GNOME Extensions' internal use.

Values reported in `MiB` are converted to decimal `MB` (`1 MiB = 1.048576 MB`). The total is displayed in decimal `GB` to one decimal place. Set a maximum usage in the preferences to show progress toward that limit. Leave the maximum at `0` to show usage only.

## Settings

- **Status page address:** defaults to `http://login.net/status`.
- **Check usage every:** defaults to 60 seconds.
- **Maximum usage:** decimal GB; `0` disables the progress bar.
- When the status page cannot be read, the panel shows a warning icon; open the panel item for the error details and status page link.

For a local install, copy this folder into `~/.local/share/gnome-shell/extensions/internetusage@t12e.dev/`, compile its settings schema with `glib-compile-schemas ~/.local/share/gnome-shell/extensions/internetusage@t12e.dev/schemas`, then enable **Login.net Usage** in the Extensions app. The extension preferences let you change the address, refresh interval, and usage limit.

## Test without logging out

On Wayland, GNOME's development kit can run a separate Shell session in a window. GNOME 49 and later require the `mutter-devkit` package. On Nobara or Fedora, install it with `sudo dnf install mutter-devkit`. Then start the development Shell from a terminal in your current session:

```sh
dbus-run-session -- gnome-shell --devkit --wayland
```

In the new Shell window, open a terminal and enable the extension:

```sh
gnome-extensions enable internetusage@t12e.dev
```

For code changes, copy the updated files into the installed extension folder, compile the schema if it changed, then close the development Shell with `Alt`+`F2`, enter `debugexit`, and launch the command again. This runs separately from your regular desktop session. See the [GNOME extension development guide](https://gjs.guide/extensions/development/creating.html#testing-the-extension) for details.
