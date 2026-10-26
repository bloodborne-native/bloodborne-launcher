//! What differs between operating systems: the data folder, the package's layout, the game's
//! programs and online module, opening a folder, finding and stopping the game, the system
//! language. Everything else in the launcher is the same on every system.
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// The user's home folder.
pub fn home() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

/// The launcher's data folder. macOS keeps the name its players already have.
pub fn data_dir() -> PathBuf {
    let here = || PathBuf::from(".");
    if cfg!(target_os = "macos") {
        home().map_or_else(here, |h| h.join("Library/Application Support")).join("bloodborne_mac")
    } else if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from).or_else(home).unwrap_or_else(here).join("bloodborne-native")
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .or_else(|| home().map(|h| h.join(".local/share")))
            .unwrap_or_else(here)
            .join("bloodborne-native")
    }
}

/// A program's file name on this system ("bb-probe", "bb-probe.exe").
pub fn exe(name: &str) -> String {
    format!("{name}{}", std::env::consts::EXE_SUFFIX)
}

/// A packaged launcher's folders: on macOS the app bundle (programs in Contents/MacOS, the game's
/// scripts in Contents/Resources/game); elsewhere one folder with the programs and game/.
pub struct Package {
    /// The launcher's own folder: the game's programs are beside it.
    pub programs: PathBuf,
    /// game/ (run.sh, scripts/, patches/) and python/.
    pub resources: PathBuf,
}

pub fn package(exe_dir: &Path) -> Option<Package> {
    let resources = if cfg!(target_os = "macos") {
        exe_dir.parent()?.join("Resources")
    } else {
        exe_dir.to_path_buf()
    };
    resources.join("game/run.sh").is_file().then(|| Package { programs: exe_dir.to_path_buf(), resources })
}

/// The packaged Python (python/bin/python3, or python/python.exe on Windows).
pub fn packaged_python(resources: &Path) -> PathBuf {
    if cfg!(windows) { resources.join("python/python.exe") } else { resources.join("python/bin/python3") }
}

/// The packaged bash when there is one, else the system's (run.sh needs bash 4 or newer: on macOS
/// Homebrew's, not /bin/bash 3.2).
pub fn bash(programs: Option<&Path>) -> PathBuf {
    let bundled = programs.map(|dir| dir.join(exe("bash")));
    let system: &[&str] = if cfg!(target_os = "macos") {
        &["/opt/homebrew/bin/bash", "/usr/local/bin/bash", "/bin/bash"]
    } else if cfg!(windows) {
        &[]
    } else {
        &["/usr/bin/bash", "/bin/bash"]
    };
    bundled
        .into_iter()
        .chain(system.iter().map(PathBuf::from))
        .find(|p| p.is_file())
        .unwrap_or_else(|| PathBuf::from(exe("bash")))
}

/// The online module (the runtime's gpu/bbnet20): its file in the package, or in the runtime's
/// build (out/gpu-arm64 on Apple Silicon, out/gpu elsewhere).
pub fn net_module(game_root: &Path, packaged: bool) -> PathBuf {
    let name = if cfg!(target_os = "macos") {
        "libbbnet20.dylib"
    } else if cfg!(windows) {
        "bbnet20.dll"
    } else {
        "libbbnet20.so"
    };
    if packaged && cfg!(target_os = "macos") {
        return game_root.join("../../Frameworks").join(name);
    }
    let build = if cfg!(all(target_os = "macos", target_arch = "aarch64")) { "out/gpu-arm64" } else { "out/gpu" };
    game_root.join(build).join(name)
}

/// PATH for run.sh: bash's folder first, then the system's programs.
pub fn game_path(bash: &Path) -> OsString {
    let mut dirs: Vec<PathBuf> = bash.parent().map(Path::to_path_buf).into_iter().collect();
    if cfg!(windows) {
        dirs.extend(std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect::<Vec<_>>()).unwrap_or_default());
    } else {
        dirs.extend(["/usr/bin", "/bin", "/usr/sbin", "/sbin"].map(PathBuf::from));
    }
    std::env::join_paths(dirs).unwrap_or_default()
}

/// Shows a folder in the system's file manager.
pub fn open_folder(path: &Path) -> Result<(), String> {
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(windows) {
        "explorer"
    } else {
        "xdg-open"
    };
    Command::new(opener).arg(path).spawn().map(|_| ()).map_err(|e| format!("{opener}: {e}"))
}

/// Whether a program of this name runs (the game, also when started outside the launcher).
pub fn running(name: &str) -> Result<bool, String> {
    if cfg!(windows) {
        let out = Command::new("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {}", exe(name)), "/NH"])
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err("Could not check whether the game is running.".into());
        }
        return Ok(String::from_utf8_lossy(&out.stdout).to_lowercase().contains(&exe(name).to_lowercase()));
    }
    let status = Command::new("pgrep").args(["-x", name]).stdout(Stdio::null()).status().map_err(|e| e.to_string())?;
    match status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err("Could not check whether the game is running.".into()),
    }
}

/// Asks a process to quit (SIGTERM; a close request on Windows): the game saves and exits.
pub fn stop(pid: u32) {
    let _ = if cfg!(windows) {
        Command::new("taskkill").args(["/PID", &pid.to_string()]).status()
    } else {
        Command::new("kill").arg(pid.to_string()).status()
    };
}

/// The system's preferred language as a tag ("pt-BR"). An app started from the desktop may have
/// no LANG, so each system's own setting comes first.
pub fn system_language() -> String {
    let native = if cfg!(target_os = "macos") {
        // "(\n    \"pt-BR\",\n    en\n)": the first item, quoted or not
        Command::new("defaults").args(["read", "-g", "AppleLanguages"]).output().ok().and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .map(|l| l.trim().trim_end_matches(',').trim_matches('"'))
                .find(|l| !l.is_empty() && *l != "(" && *l != ")")
                .map(str::to_string)
        })
    } else if cfg!(windows) {
        Command::new("powershell")
            .args(["-NoProfile", "-Command", "(Get-Culture).Name"])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .filter(|l| !l.is_empty())
    } else {
        None
    };
    native
        .or_else(|| {
            ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"]
                .iter()
                .filter_map(|v| std::env::var(v).ok())
                .find_map(|v| locale_tag(&v))
        })
        .unwrap_or_default()
}

/// "pt_BR.UTF-8" or "pt_BR:en" (POSIX locales) as "pt-BR"; "C" and "POSIX" are none.
fn locale_tag(value: &str) -> Option<String> {
    let first = value.split(':').next()?.split(['.', '@']).next()?.trim();
    (!first.is_empty() && first != "C" && first != "POSIX").then(|| first.replace('_', "-"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn posix_locales_become_language_tags() {
        assert_eq!(locale_tag("pt_BR.UTF-8").as_deref(), Some("pt-BR"));
        assert_eq!(locale_tag("de_DE@euro").as_deref(), Some("de-DE"));
        assert_eq!(locale_tag("zh_TW:en").as_deref(), Some("zh-TW"));
        assert_eq!(locale_tag("C.UTF-8"), None);
        assert_eq!(locale_tag("POSIX"), None);
        assert_eq!(locale_tag(""), None);
    }

    #[test]
    fn programs_and_modules_are_named_for_this_system() {
        let root = Path::new("/game");
        let module = net_module(root, false);
        assert!(module.starts_with("/game/out"));
        assert_eq!(exe("bb-probe"), format!("bb-probe{}", std::env::consts::EXE_SUFFIX));
        if cfg!(target_os = "macos") {
            assert!(net_module(root, true).ends_with("Frameworks/libbbnet20.dylib"));
        }
    }
}
