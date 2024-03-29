const q = require('quote-unquote');
const { get_stdout } = require("../utils");
const kde = require("./kde");
const lxde = require("./lxde");
const { run, download_image } = require('../utils');


function get_wallpaper() {
    const desktop = process.env.XDG_CURRENT_DESKTOP;
    if (is_gnome_compliant(desktop)) {
        return parse_dconf(
            "gsettings",
            ["get", "org.gnome.desktop.background", "picture-uri"],
        );
    }

    const matcher = {
        "KDE": () => kde.get(),
        "X-Cinnamon" : () => parse_dconf(
            "dconf",
            ["read", "/org/cinnamon/desktop/background/picture-uri"],
        ),
        "MATE": () => parse_dconf(
            "dconf",
            ["read", "/org/mate/desktop/background/picture-filename"],
        ),
        "XFCE": () => get_stdout(
            "xfconf-query",
            [
                "-c",
                "xfce4-desktop",
                "-p",
                "/backdrop/screen0/monitor0/workspace0/last-image",
            ],
        ),
        "LXDE": () => lxde.get(),
        "Deepin": () => parse_dconf(
            "dconf",
            [
                "read",
                "/com/deepin/wrap/gnome/desktop/background/picture-uri",
            ],
        ),
    }
    if(matcher[desktop]){
        return matcher[desktop]();
    } else {
        throw new Error(`unsupported desktop ${desktop}`)
    }
}

function is_gnome_compliant(desktop) {
    return desktop.includes("GNOME") || desktop == "Unity" || desktop == "Pantheon"
}


function parse_dconf(command, args) {
    const out = get_stdout(command, args);
    const stdout = q.unquote(out);
    if (stdout.starts_with("file://")) {
        stdout = stdout.substring(7);
    }
    return stdout;
}


function set_from_path(path) {
    const desktop = process.env.XDG_CURRENT_DESKTOP;

    if (is_gnome_compliant(desktop)) {
        let uri = q.double(`file://${path}`);
        return run(
            "gsettings",
            ["set", "org.gnome.desktop.background", "picture-uri", uri],
        );
    }

    const matcher = {
        "KDE": () => kde.set(path),
        "X-Cinnamon": () =>run(
            "dconf",
            [
                "write",
                "/org/cinnamon/desktop/background/picture-uri",
                q.double(`file://${path}`),
            ],
        ),
        "MATE": () => run(
            "dconf",
            [
                "write",
                "/org/mate/desktop/background/picture-filename",
                q.double(path),
            ],
        ),
        "XFCE": () => run(
            "xfconf-query",
            [
                "-c",
                "xfce4-desktop",
                "-p",
                "/backdrop/screen0/monitor0/workspace0/last-image",
                "-s",
                path,
            ],
        ),
        "LXDE": () => run("pcmanfm", ["-w", path]),
        "Deepin": () => run(
            "dconf",
            [
                "write",
                "/com/deepin/wrap/gnome/desktop/background/picture-uri",
                q.double(`file://${path}`),
            ],
        ),
        "i3": () => run("feh", ["--bg-fill", path]),
    }

    if(matcher[desktop]){
        return matcher[desktop]()
    } else {
        throw new Error(`Unsupported desktop ${desktop}`)
    }
}


async function set_from_url(url) {
    const desktop = process.env.XDG_CURRENT_DESKTOP;

    const matcher = {
        // only some GNOME-based desktops support urls for picture-uri
        "GNOME" : () => run(
            "gsettings",
            [
                "set",
                "org.gnome.desktop.background",
                "picture-uri",
                q.double(url),
            ],
        ),
        "ubuntu:GNOME": () => run(
            "gsettings",
            [
                "set",
                "org.gnome.desktop.background",
                "picture-uri",
                q.double(url),
            ],
        ),
        "i3": () => run("feh", ["--bg-fill", url])
    }

    if(matcher[desktop]){
        return matcher[desktop]()
    } else {
        try{
            download_image(url).then((data) => {
                set_from_path(data);
            }).catch(console.error);
        } catch (e) {
            console.error(e.message);
        }
    }
}

module.exports = { get_wallpaper, set_from_url, set_from_path }
