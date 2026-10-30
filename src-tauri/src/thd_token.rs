//! The Hunter's Dream sign-in token, kept like the online password (online_password.rs): a file of
//! its own, readable by the player's user account alone (0600 on Unix), outside the settings
//! database, its backups and launcher.json. The token is a password: it never reaches the web page
//! and no message or log line contains it.
use std::fs;
use std::io::Write;
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};

fn file(data: &Path) -> PathBuf {
    data.join("thd-token")
}

/// The saved token, if there is one.
pub fn saved(data: &Path) -> Option<String> {
    fs::read_to_string(file(data)).ok().map(|token| token.trim().to_string()).filter(|token| !token.is_empty())
}

pub fn save(data: &Path, token: &str) -> Result<(), String> {
    if token.is_empty() {
        return forget(data);
    }
    fs::create_dir_all(data).map_err(|e| e.to_string())?;
    let pending = data.join("thd-token.pending");
    let _ = fs::remove_file(&pending);
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);
    let mut out = options.open(&pending).map_err(|e| format!("Could not save the sign-in: {e}"))?;
    out.write_all(token.as_bytes()).map_err(|e| format!("Could not save the sign-in: {e}"))?;
    drop(out);
    fs::rename(&pending, file(data)).map_err(|e| format!("Could not save the sign-in: {e}"))
}

pub fn forget(data: &Path) -> Result<(), String> {
    match fs::remove_file(file(data)) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(format!("Could not remove the sign-in: {e}")),
        _ => Ok(()),
    }
}

/// A token an earlier build kept among the settings (`thd_token`): it moves into the file once,
/// unless a token is already there (that one is newer). True when `legacy` held a token, which
/// the caller then removes from the settings.
pub fn adopt(data: &Path, legacy: &str) -> Result<bool, String> {
    let legacy = legacy.trim();
    if legacy.is_empty() {
        return Ok(false);
    }
    if saved(data).is_none() {
        save(data, legacy)?;
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("bb-thd-token-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn saved_token_is_private_and_forgotten() {
        let dir = temp("saved");
        assert_eq!(saved(&dir), None);
        save(&dir, "secret").unwrap();
        assert_eq!(saved(&dir).as_deref(), Some("secret"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(fs::metadata(file(&dir)).unwrap().permissions().mode() & 0o777, 0o600);
        }
        save(&dir, "newer").unwrap();
        assert_eq!(saved(&dir).as_deref(), Some("newer"));
        save(&dir, "").unwrap();
        assert_eq!(saved(&dir), None);
        forget(&dir).unwrap();
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn an_old_setting_moves_into_the_file_once() {
        let dir = temp("adopt");
        assert!(!adopt(&dir, "").unwrap());
        assert!(!adopt(&dir, "  ").unwrap());
        assert_eq!(saved(&dir), None);
        assert!(adopt(&dir, "old").unwrap());
        assert_eq!(saved(&dir).as_deref(), Some("old"));
        // A token already in the file is newer: the old setting is dropped, not copied over it.
        save(&dir, "current").unwrap();
        assert!(adopt(&dir, "older").unwrap());
        assert_eq!(saved(&dir).as_deref(), Some("current"));
        fs::remove_dir_all(&dir).unwrap();
    }
}
