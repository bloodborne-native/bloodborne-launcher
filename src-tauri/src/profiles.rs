// SPDX-License-Identifier: GPL-2.0-or-later
//! SQLite owns identities; save files stay on disk. Legacy manifests are retained for recovery.
use crate::{database as db, saves};
use db::{err, Result};
use serde::Serialize;
use sqlx::{Connection, Row, SqliteConnection};
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct Registry {
    pub original_name: String,
    pub original_user_dir: PathBuf,
    pub active: String,
}
#[derive(Serialize)]
pub struct ProfileList {
    pub setup_required: bool,
    pub has_existing_saves: bool,
    pub active: String,
    pub profiles: Vec<saves::Profile>,
}
async fn registry(connection: &mut SqliteConnection) -> Result<Option<Registry>> {
    // The original row remains as a tombstone if deleted: its root still owns shared GPU caches.
    let row = sqlx::query("SELECT p.name, s.original_user_dir, s.active_profile_id FROM launcher_state s JOIN profiles p ON p.id='original' WHERE s.id=1")
        .fetch_optional(connection).await.map_err(err)?;
    row.map(|r| {
        Ok(Registry {
            original_name: r.try_get("name").map_err(err)?,
            original_user_dir: PathBuf::from(
                r.try_get::<String, _>("original_user_dir").map_err(err)?,
            ),
            active: r.try_get("active_profile_id").map_err(err)?,
        })
    })
    .transpose()
}
/// An app container's root: the folder under `.../Containers/Data/Application/`.
fn container_root(path: &Path) -> Option<&Path> {
    path.ancestors().find(|a| a.parent().and_then(Path::file_name) == Some("Application".as_ref()))
}
/// `path` moved from its earlier container into the container `data` is in; None if it is
/// already there or not in a container.
fn in_this_container(path: &Path, data: &Path) -> Option<PathBuf> {
    let (old, here) = (container_root(path)?, container_root(data)?);
    if old == here {
        return None;
    }
    Some(here.join(path.strip_prefix(old).ok()?))
}
/// iOS: the app's container path changes when the app is installed again or updated, while the
/// files move with it. Every stored path under an earlier container (the original saves folder,
/// save sets, backups; where nothing may be created any more: "Operation not permitted") is moved
/// to this container. Elsewhere nothing changes.
pub fn relocate_container(data: &Path) -> Result<()> {
    if !cfg!(target_os = "ios") {
        return Ok(());
    }
    db::block(async {
        let mut connection = db::connect(data).await?;
        let mut tx = connection.begin_with("BEGIN IMMEDIATE").await.map_err(err)?;
        for (table, key, column) in [
            ("launcher_state", "id", "original_user_dir"),
            ("save_sets", "id", "user_dir"),
            ("backups", "id", "path"),
        ] {
            let rows: Vec<(String, String)> =
                sqlx::query_as(&format!("SELECT CAST({key} AS TEXT), {column} FROM {table}"))
                    .fetch_all(&mut *tx)
                    .await
                    .map_err(err)?;
            for (id, stored) in rows {
                let Some(moved) = in_this_container(Path::new(&stored), data) else { continue };
                sqlx::query(&format!("UPDATE {table} SET {column}=? WHERE CAST({key} AS TEXT)=?"))
                    .bind(moved.to_string_lossy().to_string())
                    .bind(id)
                    .execute(&mut *tx)
                    .await
                    .map_err(err)?;
            }
        }
        tx.commit().await.map_err(err)
    })
}

pub fn require(data: &Path) -> Result<Registry> {
    db::block(async {
        let mut connection = db::connect(data).await?;
        registry(&mut connection)
            .await?
            .ok_or_else(|| "Create your first profile before launching the game.".into())
    })
}
fn name(value: &str, profiles: &[saves::Profile], except: Option<&str>) -> Result<String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 80 || value.chars().any(char::is_control) {
        return Err(
            "Use a profile name between 1 and 80 characters, without control characters.".into(),
        );
    }
    if profiles
        .iter()
        .any(|p| Some(p.id.as_str()) != except && p.name.to_lowercase() == value.to_lowercase())
    {
        return Err("A profile with this name already exists.".into());
    }
    Ok(value.into())
}
async fn insert_owner(connection: &mut SqliteConnection, profile: &saves::Profile) -> Result<()> {
    sqlx::query("INSERT INTO profiles (id,name,name_key,created_at) VALUES (?,?,?,?)")
        .bind(&profile.id)
        .bind(&profile.name)
        .bind(profile.name.to_lowercase())
        .bind(db::now())
        .execute(&mut *connection)
        .await
        .map_err(err)?;
    sqlx::query("INSERT INTO save_sets (id,profile_id,user_dir) VALUES (?,?,?)")
        .bind(&profile.id)
        .bind(&profile.id)
        .bind(profile.path.to_string_lossy().as_ref())
        .execute(connection)
        .await
        .map_err(err)?;
    Ok(())
}
async fn owned(
    connection: &mut SqliteConnection,
    data: &Path,
    state: &Registry,
) -> Result<Vec<saves::Profile>> {
    let deleted: Vec<String> =
        sqlx::query_scalar("SELECT id FROM profiles WHERE deleted_at IS NOT NULL")
            .fetch_all(&mut *connection)
            .await
            .map_err(err)?;
    let mut physical = saves::list_excluding(data, &state.original_user_dir, &deleted)?;
    let mut tx = connection
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(err)?;
    for profile in &mut physical {
        let record=sqlx::query("SELECT p.name,s.user_dir FROM profiles p JOIN save_sets s ON s.profile_id=p.id WHERE p.id=?").bind(&profile.id).fetch_optional(&mut *tx).await.map_err(err)?;
        if let Some(record) = record {
            let stored_path: String = record.try_get("user_dir").map_err(err)?;
            if Path::new(&stored_path) != profile.path {
                return Err("Save ownership path does not match its profile.".into());
            }
            profile.name = record.try_get("name").map_err(err)?;
        } else {
            // Complete legacy or interrupted-create directories always acquire a profile owner.
            insert_owner(&mut tx, profile).await?;
        }
        sqlx::query("DELETE FROM backups WHERE save_set_id=?")
            .bind(&profile.id)
            .execute(&mut *tx)
            .await
            .map_err(err)?;
        for backup in &profile.backups {
            sqlx::query(
                "INSERT INTO backups (id,save_set_id,path,created_at,bytes) VALUES (?,?,?,?,?)",
            )
            .bind(&backup.id)
            .bind(&profile.id)
            .bind(
                data.join("save-backups")
                    .join(&profile.id)
                    .join(&backup.id)
                    .to_string_lossy()
                    .as_ref(),
            )
            .bind(backup.created as i64)
            .bind(backup.bytes as i64)
            .execute(&mut *tx)
            .await
            .map_err(err)?;
        }
    }
    let ids: Vec<String> = sqlx::query_scalar("SELECT id FROM profiles WHERE deleted_at IS NULL")
        .fetch_all(&mut *tx)
        .await
        .map_err(err)?;
    if ids.iter().any(|id| !physical.iter().any(|p| &p.id == id)) {
        return Err("A profile folder is missing. Restore it before launching.".into());
    }
    if !physical.iter().any(|p| p.id == state.active) {
        return Err("The active profile is missing.".into());
    }
    tx.commit().await.map_err(err)?;
    for profile in &mut physical {
        crate::trophies::refresh(connection, profile).await?;
    }
    Ok(physical)
}
pub fn list(data: &Path, original: &Path) -> Result<ProfileList> {
    db::block(async {
        let mut connection = db::connect(data).await?;
        if let Some(state) = registry(&mut connection).await? {
            let profiles = owned(&mut connection, data, &state).await?;
            return Ok(ProfileList {
                setup_required: false,
                has_existing_saves: profiles.iter().any(|p| p.bytes > 0),
                active: state.active,
                profiles,
            });
        }
        let existing = saves::list(data, original)?;
        Ok(ProfileList {
            setup_required: true,
            has_existing_saves: existing.iter().any(|p| p.bytes > 0),
            active: String::new(),
            profiles: Vec::new(),
        })
    })
}
pub fn initialize(
    data: &Path,
    original: &Path,
    legacy_active: &str,
    first_name: &str,
) -> Result<()> {
    db::block(async {
        let mut connection = db::connect(data).await?;
        let mut tx = connection
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(err)?;
        if registry(&mut tx).await?.is_some() {
            return Err("Profile setup is already complete.".into());
        }
        let original = if original.is_absolute() {
            original.into()
        } else {
            std::env::current_dir().map_err(err)?.join(original)
        };
        let mut existing = saves::list(data, &original)?;
        existing[0].name = name(first_name, &existing, Some("original"))?;
        if !existing.iter().any(|p| p.id == legacy_active) {
            return Err("The previously selected save profile is missing.".into());
        }
        for profile in &existing {
            insert_owner(&mut tx, profile).await?;
        }
        sqlx::query(
            "INSERT INTO launcher_state (id,active_profile_id,original_user_dir) VALUES (1,?,?)",
        )
        .bind(legacy_active)
        .bind(original.to_string_lossy().as_ref())
        .execute(&mut *tx)
        .await
        .map_err(err)?;
        tx.commit().await.map_err(err)?;
        Ok(())
    })
}
pub fn selected(data: &Path) -> Result<saves::Profile> {
    let state = require(data)?;
    list(data, &state.original_user_dir)?
        .profiles
        .into_iter()
        .find(|p| p.id == state.active)
        .ok_or_else(|| "The active profile is missing.".into())
}
pub fn operation(data: &Path, profile: Option<&str>, kind: &str) -> Result<String> {
    db::block(async {
        let mut connection = db::connect(data).await?;
        let id = db::operation_id();
        sqlx::query("INSERT INTO pending_operations (id,profile_id,kind,status,created_at) VALUES (?,?,?,'pending',?)").bind(&id).bind(profile).bind(kind).bind(db::now()).execute(&mut connection).await.map_err(err)?;
        Ok(id)
    })
}
pub fn finish(data: &Path, id: &str, result: &Result<()>) -> Result<()> {
    db::block(async {
        let mut connection = db::connect(data).await?;
        sqlx::query("UPDATE pending_operations SET status=?,error=? WHERE id=?")
            .bind(if result.is_ok() { "complete" } else { "failed" })
            .bind(result.as_ref().err())
            .bind(id)
            .execute(&mut connection)
            .await
            .map_err(err)?;
        Ok(())
    })
}
pub fn change(
    data: &Path,
    action: &str,
    id: &str,
    new_name: Option<&str>,
    source: Option<&str>,
) -> Result<()> {
    let state = require(data)?;
    let profiles = list(data, &state.original_user_dir)?.profiles;
    match action {
        "select" | "rename" => db::block(async {
            if !profiles.iter().any(|p| p.id == id) {
                return Err("Unknown profile.".into());
            }
            let mut connection = db::connect(data).await?;
            if action == "select" {
                sqlx::query("UPDATE launcher_state SET active_profile_id=? WHERE id=1")
                    .bind(id)
                    .execute(&mut connection)
                    .await
                    .map_err(err)?;
            } else {
                let name = name(new_name.unwrap_or_default(), &profiles, Some(id))?;
                sqlx::query("UPDATE profiles SET name=?,name_key=? WHERE id=?")
                    .bind(&name)
                    .bind(name.to_lowercase())
                    .bind(id)
                    .execute(&mut connection)
                    .await
                    .map_err(err)?;
            }
            Ok(())
        }),
        "delete" => {
            let op = mark_deleted(data, id)?;
            cleanup_deleted(data, &state, id, &op)
        }
        "create" => {
            let name = name(new_name.unwrap_or_default(), &profiles, None)?;
            if source.is_some() {
                return Err("New profiles always start with empty saves.".into());
            }
            let op = operation(data, None, "create_profile")?;
            let result = (|| {
                saves::create(data, &state.original_user_dir, &name, None)?;
                list(data, &state.original_user_dir)?;
                Ok(())
            })();
            finish(data, &op, &result)?;
            result
        }
        _ => Err("Unknown profile operation.".into()),
    }
}
fn mark_deleted(data: &Path, id: &str) -> Result<String> {
    db::block(async {
        let mut connection = db::connect(data).await?;
        let mut tx = connection
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(err)?;
        let active: String =
            sqlx::query_scalar("SELECT active_profile_id FROM launcher_state WHERE id=1")
                .fetch_one(&mut *tx)
                .await
                .map_err(err)?;
        if active == id {
            return Err("Switch to another profile before deleting this one.".into());
        }
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL")
                .fetch_one(&mut *tx)
                .await
                .map_err(err)?;
        if count <= 1 {
            return Err("Keep at least one profile.".into());
        }
        let updated = sqlx::query(
            "UPDATE profiles SET deleted_at=?,name_key=? WHERE id=? AND deleted_at IS NULL",
        )
        .bind(db::now())
        .bind(format!("\u{1}deleted:{id}"))
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(err)?;
        if updated.rows_affected() != 1 {
            return Err("Unknown profile.".into());
        }
        sqlx::query("DELETE FROM trophy_unlocks WHERE profile_id=?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(err)?;
        sqlx::query("DELETE FROM backups WHERE save_set_id IN (SELECT id FROM save_sets WHERE profile_id=?)").bind(id).execute(&mut *tx).await.map_err(err)?;
        let op = db::operation_id();
        sqlx::query("INSERT INTO pending_operations (id,profile_id,kind,status,created_at) VALUES (?,?,'delete_profile','pending',?)").bind(&op).bind(id).bind(db::now()).execute(&mut *tx).await.map_err(err)?;
        tx.commit().await.map_err(err)?;
        Ok(op)
    })
}
fn cleanup_deleted(data: &Path, state: &Registry, id: &str, op: &str) -> Result<()> {
    let result = saves::delete_profile_files(data, &state.original_user_dir, id);
    // Failed cleanup stays pending. Startup can resume it idempotently without re-adoption.
    if result.is_ok() {
        finish(data, op, &result)?;
    }
    result.map_err(|e| format!("Profile removed, but some files could not be deleted: {e}. Resolve the file error and restart the launcher to retry cleanup."))
}
/// Only called at process startup, before commands or background work can begin.
pub fn recover_operations(data: &Path) -> Result<()> {
    let pending = db::block(async {
        let mut connection = db::connect(data).await?;
        let entries: Vec<(String, String)> = sqlx::query_as("SELECT o.id,o.profile_id FROM pending_operations o JOIN profiles p ON p.id=o.profile_id WHERE o.kind='delete_profile' AND o.status='pending' AND p.deleted_at IS NOT NULL").fetch_all(&mut connection).await.map_err(err)?;
        Ok(entries)
    })?;
    if !pending.is_empty() {
        let state = require(data)?;
        for (op, id) in pending {
            if let Err(error) = cleanup_deleted(data, &state, &id, &op) {
                eprintln!("Profile cleanup: {error}");
            }
        }
    }
    db::block(async {
        let mut connection = db::connect(data).await?;
        if let Some(state) = registry(&mut connection).await? {
            owned(&mut connection, data, &state).await?;
        }
        sqlx::query("UPDATE pending_operations SET status='interrupted',error='Launcher stopped before completion; published files reconciled at startup' WHERE status='pending' AND kind!='delete_profile'")
            .execute(&mut connection).await.map_err(err)?;
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn paths_follow_the_ios_container() {
        let apps = "/private/var/mobile/Containers/Data/Application";
        let data = PathBuf::from(format!("{apps}/NEW/Documents"));
        let moved = in_this_container(Path::new(&format!("{apps}/OLD/Documents/user")), &data);
        assert_eq!(moved, Some(PathBuf::from(format!("{apps}/NEW/Documents/user"))));
        assert_eq!(in_this_container(&data.join("user"), &data), None);
        assert_eq!(in_this_container(Path::new("/Users/me/user"), &data), None);
        assert_eq!(in_this_container(&data, Path::new("/Users/me/data")), None);
    }
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = fs::canonicalize(std::env::temp_dir())
                .unwrap()
                .join(format!("bb-profile-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn original(&self) -> PathBuf {
            self.0.join("custom-user")
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn fresh_setup_required_once_then_every_save_has_an_owner() {
        let f = Fixture::new();
        let original = f.original();
        assert!(list(&f.0, &original).unwrap().setup_required);
        assert!(!f.0.join("profiles.json").exists());
        assert!(selected(&f.0).is_err());
        assert!(change(&f.0, "create", "", Some("B"), None).is_err());
        assert!(initialize(&f.0, &original, "original", " ").is_err());
        initialize(&f.0, &original, "original", "Pablo").unwrap();
        assert!(!list(&f.0, &original).unwrap().setup_required);
        assert!(initialize(&f.0, &original, "original", "Overwrite").is_err());
        change(&f.0, "create", "", Some("Second"), None).unwrap();
        let profiles = list(&f.0, &original).unwrap().profiles;
        let second = profiles.iter().find(|p| p.name == "Second").unwrap();
        assert_eq!(selected(&f.0).unwrap().name, "Pablo");
        change(&f.0, "select", &second.id, None, None).unwrap();
        assert_eq!(selected(&f.0).unwrap().path, second.path);
        change(&f.0, "rename", &second.id, Some("Renamed"), None).unwrap();
        assert_eq!(selected(&f.0).unwrap().name, "Renamed");
        assert!(change(&f.0, "create", "", Some("pablo"), None).is_err());
        assert!(change(&f.0, "select", "../escape", None, None).is_err());
    }
    fn second(f: &Fixture) -> String {
        change(&f.0, "create", "", Some("Second"), None).unwrap();
        list(&f.0, &f.original())
            .unwrap()
            .profiles
            .into_iter()
            .find(|p| p.name == "Second")
            .unwrap()
            .id
    }
    #[test]
    fn deletion_removes_owned_saves_backups_and_trophies_only() {
        let f = Fixture::new();
        let original = f.original();
        initialize(&f.0, &original, "original", "First").unwrap();
        let id = second(&f);
        let user = saves::user_dir(&f.0, &original, &id).unwrap();
        fs::create_dir_all(user.join("savedata")).unwrap();
        fs::write(user.join("savedata/data"), b"synthetic deleted save").unwrap();
        saves::backup(&f.0, &original, &id).unwrap();
        db::block(async {
            let mut db = db::connect(&f.0).await?;
            sqlx::query("INSERT INTO trophy_unlocks VALUES (?,'synthetic',1,1)")
                .bind(&id)
                .execute(&mut db)
                .await
                .map_err(err)?;
            Ok(())
        })
        .unwrap();
        change(&f.0, "delete", &id, None, None).unwrap();
        assert!(!f.0.join("save-profiles").join(&id).exists());
        assert!(!f.0.join("save-backups").join(&id).exists());
        assert_eq!(selected(&f.0).unwrap().id, "original");
        assert_eq!(list(&f.0, &original).unwrap().profiles.len(), 1);
        db::block(async {
            let mut db = db::connect(&f.0).await?;
            for query in [
                "SELECT COUNT(*) FROM trophy_unlocks WHERE profile_id=?",
                "SELECT COUNT(*) FROM backups WHERE save_set_id=?",
            ] {
                let count: i64 = sqlx::query_scalar(query)
                    .bind(&id)
                    .fetch_one(&mut db)
                    .await
                    .map_err(err)?;
                assert_eq!(count, 0);
            }
            Ok(())
        })
        .unwrap();
        change(&f.0, "create", "", Some("Second"), None).unwrap();
    }
    #[test]
    fn active_last_unknown_and_repeated_deletions_are_rejected() {
        let f = Fixture::new();
        initialize(&f.0, &f.original(), "original", "First").unwrap();
        assert!(change(&f.0, "delete", "original", None, None).is_err());
        let id = second(&f);
        assert!(change(&f.0, "delete", "original", None, None).is_err());
        assert!(change(&f.0, "delete", "../outside", None, None).is_err());
        change(&f.0, "delete", &id, None, None).unwrap();
        assert!(change(&f.0, "delete", &id, None, None).is_err());
        assert_eq!(selected(&f.0).unwrap().id, "original");
    }
    #[test]
    fn deleting_original_preserves_shared_cache_and_never_readopts_it() {
        let f = Fixture::new();
        let original = f.original();
        fs::create_dir_all(original.join("savedata")).unwrap();
        fs::write(original.join("savedata/data"), b"synthetic legacy save").unwrap();
        fs::create_dir(original.join("shader_cache")).unwrap();
        fs::write(original.join("shader_cache/synthetic"), b"synthetic cache").unwrap();
        initialize(&f.0, &original, "original", "First").unwrap();
        let id = second(&f);
        change(&f.0, "select", &id, None, None).unwrap();
        change(&f.0, "delete", "original", None, None).unwrap();
        recover_operations(&f.0).unwrap();
        assert!(!original.join("savedata").exists());
        assert_eq!(
            fs::read(original.join("shader_cache/synthetic")).unwrap(),
            b"synthetic cache"
        );
        assert_eq!(selected(&f.0).unwrap().id, id);
        assert_eq!(list(&f.0, &original).unwrap().profiles.len(), 1);
    }
    #[test]
    fn interrupted_deletion_resumes_cleanup_without_reappearing() {
        let f = Fixture::new();
        let original = f.original();
        initialize(&f.0, &original, "original", "First").unwrap();
        let id = second(&f);
        saves::backup(&f.0, &original, &id).unwrap();
        let op = mark_deleted(&f.0, &id).unwrap();
        fs::remove_dir_all(f.0.join("save-profiles").join(&id)).unwrap();
        assert_eq!(list(&f.0, &original).unwrap().profiles.len(), 1);
        recover_operations(&f.0).unwrap();
        recover_operations(&f.0).unwrap();
        assert!(!f.0.join("save-backups").join(&id).exists());
        db::block(async {
            let mut db = db::connect(&f.0).await?;
            let status: String =
                sqlx::query_scalar("SELECT status FROM pending_operations WHERE id=?")
                    .bind(&op)
                    .fetch_one(&mut db)
                    .await
                    .map_err(err)?;
            assert_eq!(status, "complete");
            Ok(())
        })
        .unwrap();
    }
    #[test]
    #[cfg(unix)]
    fn deletion_cleanup_rejects_symlinked_folders_without_touching_target() {
        let f = Fixture::new();
        let original = f.original();
        initialize(&f.0, &original, "original", "First").unwrap();
        let id = second(&f);
        mark_deleted(&f.0, &id).unwrap();
        let folder = f.0.join("save-profiles").join(&id);
        fs::remove_dir_all(&folder).unwrap();
        let outside = f.0.join("outside");
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("keep"), b"synthetic protected file").unwrap();
        std::os::unix::fs::symlink(&outside, &folder).unwrap();
        recover_operations(&f.0).unwrap();
        assert_eq!(
            fs::read(outside.join("keep")).unwrap(),
            b"synthetic protected file"
        );
        assert_eq!(list(&f.0, &original).unwrap().profiles.len(), 1);
        fs::remove_file(&folder).unwrap();
        recover_operations(&f.0).unwrap();
    }
    #[test]
    fn new_profiles_never_copy_existing_saves() {
        let f = Fixture::new();
        let original = f.original();
        fs::create_dir_all(original.join("savedata")).unwrap();
        fs::write(original.join("savedata/data"), b"synthetic legacy save").unwrap();
        initialize(&f.0, &original, "original", "Migrated").unwrap();
        assert!(change(&f.0, "create", "", Some("Copy"), Some("original")).is_err());
        change(&f.0, "create", "", Some("New"), None).unwrap();
        let profiles = list(&f.0, &original).unwrap().profiles;
        let fresh = profiles.iter().find(|p| p.name == "New").unwrap();
        assert_eq!(fresh.bytes, 0);
        assert!(fresh.backups.is_empty());
        assert!(!fresh.path.join("savedata/data").exists());
        assert_eq!(
            fs::read(original.join("savedata/data")).unwrap(),
            b"synthetic legacy save"
        );
        assert_eq!(profiles.len(), 2);
    }
    #[test]
    fn upgrade_adopts_custom_original_and_legacy_profiles_in_place() {
        let f = Fixture::new();
        let original = f.original();
        fs::create_dir_all(original.join("savedata")).unwrap();
        fs::write(original.join("savedata/data"), b"synthetic existing save").unwrap();
        let id = saves::create(&f.0, &original, "Legacy copy", Some("original")).unwrap();
        let bid = saves::backup(&f.0, &original, &id).unwrap();
        assert!(list(&f.0, &original).unwrap().has_existing_saves);
        initialize(&f.0, &original, &id, "First owner").unwrap();
        let profiles = list(&f.0, &original).unwrap();
        assert_eq!(profiles.profiles.len(), 2);
        assert_eq!(profiles.active, id);
        assert_eq!(profiles.profiles[0].path, original);
        assert_eq!(profiles.profiles[0].name, "First owner");
        assert_eq!(selected(&f.0).unwrap().backups[0].id, bid);
        assert_eq!(
            fs::read(original.join("savedata/data")).unwrap(),
            b"synthetic existing save"
        );
        change(&f.0, "rename", "original", Some("Renamed owner"), None).unwrap();
        assert_eq!(require(&f.0).unwrap().original_name, "Renamed owner");
        // Config changes after setup cannot silently reassign the first owner's save directory.
        assert_eq!(
            list(&f.0, &f.0.join("other-user")).unwrap().profiles[0].path,
            original
        );
    }
    #[test]
    fn setup_failure_is_atomic_and_interrupted_create_is_adopted() {
        let f = Fixture::new();
        let original = f.original();
        let a = saves::create(&f.0, &original, "Same", None).unwrap();
        let _b = saves::create(&f.0, &original, "same", None).unwrap();
        assert!(initialize(&f.0, &original, "original", "Owner").is_err());
        db::block(async {
            let mut connection = db::connect(&f.0).await?;
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM profiles")
                .fetch_one(&mut connection)
                .await
                .map_err(err)?;
            assert_eq!(count, 0);
            Ok(())
        })
        .unwrap();
        fs::remove_dir_all(f.0.join("save-profiles").join(a)).unwrap();
        initialize(&f.0, &original, "original", "Owner").unwrap();
        let op = operation(&f.0, None, "create_profile").unwrap();
        let created = saves::create(&f.0, &original, "Recovered", None).unwrap();
        recover_operations(&f.0).unwrap();
        assert!(list(&f.0, &original)
            .unwrap()
            .profiles
            .iter()
            .any(|p| p.id == created));
        db::block(async {
            let mut connection = db::connect(&f.0).await?;
            let status: String =
                sqlx::query_scalar("SELECT status FROM pending_operations WHERE id=?")
                    .bind(op)
                    .fetch_one(&mut connection)
                    .await
                    .map_err(err)?;
            assert_eq!(status, "interrupted");
            Ok(())
        })
        .unwrap();
    }
    #[test]
    fn restoring_saves_preserves_trophy_history_and_owner() {
        let f = Fixture::new();
        let original = f.original();
        fs::create_dir_all(original.join("savedata")).unwrap();
        fs::write(original.join("savedata/data"), b"synthetic save").unwrap();
        initialize(&f.0, &original, "original", "Owner").unwrap();
        let backup = saves::backup(&f.0, &original, "original").unwrap();
        db::block(async {
            let mut connection = db::connect(&f.0).await?;
            sqlx::query("INSERT INTO trophy_unlocks VALUES ('original','SYNTHETIC',1,123)")
                .execute(&mut connection)
                .await
                .map_err(err)?;
            Ok(())
        })
        .unwrap();
        fs::write(original.join("savedata/data"), b"synthetic changed save").unwrap();
        saves::restore(&f.0, &original, "original", &backup).unwrap();
        let list = list(&f.0, &original).unwrap();
        assert_eq!(list.profiles[0].backups.len(), 2);
        db::block(async {
            let mut connection = db::connect(&f.0).await?;
            let unlock: i64 = sqlx::query_scalar(
                "SELECT unlocked_at FROM trophy_unlocks WHERE profile_id='original'",
            )
            .fetch_one(&mut connection)
            .await
            .map_err(err)?;
            assert_eq!(unlock, 123);
            Ok(())
        })
        .unwrap();
        assert_eq!(selected(&f.0).unwrap().name, "Owner");
    }
    #[test]
    fn corrupt_database_never_triggers_fresh_setup_or_fallback() {
        let f = Fixture::new();
        let original = f.original();
        fs::write(f.0.join("launcher.db"), b"not a database").unwrap();
        assert!(list(&f.0, &original).is_err());
        assert!(initialize(&f.0, &original, "original", "New").is_err());
        assert_eq!(
            fs::read(f.0.join("launcher.db")).unwrap(),
            b"not a database"
        );
    }
}
