// SPDX-License-Identifier: GPL-2.0-or-later
//! A character's inventory and storage in a decrypted Bloodborne save, and verified edits of them.
//! Format facts (entry layout, the sections' places relative to the character name, the weapon
//! table above the inventory) were checked against Noxde/Bloodborne-save-editor d8d0365 (GPL-3.0);
//! this parser is our own and refuses anything it does not recognize.
//!
//! An entry is 16 bytes: an ordering number, a handle (its high byte the kind: 0x80 weapon, 0x90
//! armor, 0xB0 item, 0xC0 gem or rune), the ID (a weapon's carries its level and imprint) and the
//! amount. A free entry has the ID 0xFFFFFFFF. Each weapon and armor piece also has a 60-byte block
//! above the inventory, keyed by the same handle and ID, with its five gem slots.
use crate::game_data::ItemText;
use crate::save_editor::{character_base, slot_bytes, slot_path};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

type Result<T> = std::result::Result<T, String>;

const ENTRY: usize = 16;
// The sections' sizes in entries (the 1,984th inventory entry's bytes belong to what follows it).
fn capacity(location: Location) -> usize {
    match location {
        Location::Inventory => 1983,
        Location::Storage => 1984,
    }
}
const INVENTORY_FROM_NAME: usize = 469;
const STORAGE_FROM_INVENTORY: usize = 34268;
const FREE_ID: u32 = 0xFFFF_FFFF;
const BARE_FISTS: u32 = 1_000_000; // the empty hand slots the game keeps as weapons
const UPGRADES_START: usize = 84; // gems and runes, before the weapon table
const SLOT_BLOCK: usize = 60;

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Location {
    Inventory,
    Storage,
}

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Item,
    Weapon,
    Armor,
    Upgrade,
}

#[derive(Serialize, Debug)]
pub struct Entry {
    pub location: Location,
    /// The entry's position in its section (what an edit refers to).
    pub index: u16,
    pub kind: Kind,
    /// Items: the item; weapons: the full weapon ID (level and imprint included); armor: the piece.
    pub id: u32,
    pub amount: u32,
    pub name: Option<String>,
    pub description: Option<String>,
    /// Weapons: +0 to +10, and 0 none, 1 Uncanny, 2 Lost.
    pub level: u8,
    pub imprint: u8,
    /// Weapons: the levels and imprints the player's game has names for (valid IDs).
    pub levels: Vec<u8>,
    pub imprints: Vec<u8>,
    /// The game's own name of each imprint's variant, in the player's language.
    pub imprint_names: Vec<String>,
}

#[derive(Serialize)]
pub struct Inventory {
    pub title_id: String,
    pub slot: u8,
    pub fingerprint: String,
    pub entries: Vec<Entry>,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Change {
    Amount { location: Location, index: u16, amount: u32 },
    Weapon { location: Location, index: u16, level: u8, imprint: u8 },
}

#[derive(Deserialize)]
pub struct Edit {
    pub title_id: String,
    pub slot: u8,
    pub fingerprint: String,
    pub changes: Vec<Change>,
}

fn word(bytes: &[u8], at: usize) -> Result<u32> {
    Ok(u32::from_le_bytes(
        bytes.get(at..at + 4).ok_or("Truncated inventory.")?.try_into().unwrap(),
    ))
}

/// Where a section starts in the character file.
fn section(bytes: &[u8], location: Location) -> Result<usize> {
    let base = character_base(bytes)?.ok_or("The character slot is empty.")?;
    let inventory = base + INVENTORY_FROM_NAME;
    let start = match location {
        Location::Inventory => inventory,
        Location::Storage => inventory + STORAGE_FROM_INVENTORY,
    };
    if start + capacity(location) * ENTRY > bytes.len() {
        return Err("Unrecognized inventory layout.".into());
    }
    Ok(start)
}

/// A weapon ID's parts: (base ID, level, imprint).
fn weapon_parts(id: u32) -> (u32, u8, u8) {
    let base = id / 100_000 * 100_000;
    ((base), ((id % 10_000) / 100) as u8, ((id % 100_000) / 10_000) as u8)
}
fn weapon_id(base: u32, level: u8, imprint: u8) -> u32 {
    base + u32::from(imprint) * 10_000 + u32::from(level) * 100
}

fn kind_of(handle: u32, id: u32) -> Option<(Kind, u32)> {
    match (handle >> 24, id >> 24) {
        (0xB0, 0x40) => Some((Kind::Item, id & 0x00FF_FFFF)),
        (0x90, 0x10) => Some((Kind::Armor, id & 0x0FFF_FFFF)),
        (0x80, _) => Some((Kind::Weapon, id)),
        (0xC0, _) => Some((Kind::Upgrade, id)),
        _ => None,
    }
}

fn entries(bytes: &[u8], text: Option<&ItemText>) -> Result<Vec<Entry>> {
    let mut found = Vec::new();
    for location in [Location::Inventory, Location::Storage] {
        let start = section(bytes, location)?;
        for index in 0..capacity(location) {
            let at = start + index * ENTRY;
            let (handle, id, amount) = (word(bytes, at + 4)?, word(bytes, at + 8)?, word(bytes, at + 12)?);
            if id == FREE_ID {
                continue;
            }
            let Some((kind, item)) = kind_of(handle, id) else {
                return Err(format!("Unrecognized inventory entry {index}."));
            };
            if kind == Kind::Weapon && item == BARE_FISTS {
                continue;
            }
            let mut entry = Entry {
                location,
                index: index as u16,
                kind,
                id: item,
                amount,
                name: None,
                description: None,
                level: 0,
                imprint: 0,
                levels: Vec::new(),
                imprints: Vec::new(),
                imprint_names: Vec::new(),
            };
            if let Some(text) = text {
                match kind {
                    Kind::Item => {
                        entry.name = text.goods.get(&item).cloned();
                        entry.description = text.goods_info.get(&item).cloned();
                    }
                    Kind::Armor => entry.name = text.armor.get(&item).cloned(),
                    Kind::Weapon => {
                        let (base, level, imprint) = weapon_parts(item);
                        entry.level = level;
                        entry.imprint = imprint;
                        entry.name = text.weapons.get(&base).cloned();
                        entry.levels = (0..=10)
                            .filter(|&l| text.weapons.contains_key(&weapon_id(base, l, imprint)))
                            .collect();
                        entry.imprints = (0..=2)
                            .filter(|&i| text.weapons.contains_key(&weapon_id(base, level, i)))
                            .collect();
                        entry.imprint_names = entry
                            .imprints
                            .iter()
                            .map(|&i| text.weapons[&weapon_id(base, 0, i)].clone())
                            .collect();
                    }
                    Kind::Upgrade => {}
                }
            }
            found.push(entry);
        }
    }
    Ok(found)
}

pub fn read(user: &Path, title: &str, slot: u8, text: Option<&ItemText>) -> Result<Inventory> {
    let bytes = slot_bytes(&slot_path(user, title, slot)?)?;
    Ok(Inventory {
        title_id: title.into(),
        slot,
        fingerprint: format!("{:x}", Sha256::digest(&bytes)),
        entries: entries(&bytes, text)?,
    })
}

/// The 60-byte block above the inventory for this handle and ID: exactly one, or an error.
fn slot_block(bytes: &[u8], handle: u32, id: u32) -> Result<usize> {
    let base = character_base(bytes)?.ok_or("The character slot is empty.")?;
    let end = base.checked_sub(147).ok_or("Invalid character layout.")?;
    let mut key = [0u8; 8];
    key[..4].copy_from_slice(&handle.to_le_bytes());
    key[4..].copy_from_slice(&id.to_le_bytes());
    let mut matches = (UPGRADES_START..end.saturating_sub(SLOT_BLOCK))
        .filter(|&at| bytes[at..at + 8] == key);
    match (matches.next(), matches.next()) {
        (Some(at), None) => Ok(at),
        (None, _) => Err("The weapon's slot block was not found.".into()),
        _ => Err("The weapon's slot block is ambiguous.".into()),
    }
}

/// Applies the changes to one character file in a staged save set, then checks the result.
pub fn rewrite(savedata: &Path, edit: &Edit, text: &ItemText) -> Result<()> {
    let user = savedata.parent().ok_or("Invalid save staging folder.")?;
    let path = slot_path(user, &edit.title_id, edit.slot)?;
    let mut bytes = slot_bytes(&path)?;
    if format!("{:x}", Sha256::digest(&bytes)) != edit.fingerprint {
        return Err("The character changed since it was opened. Refresh the inventory.".into());
    }
    if edit.changes.is_empty() {
        return Err("No inventory values changed.".into());
    }
    let mut expected = Vec::new();
    for change in &edit.changes {
        match *change {
            Change::Amount { location, index, amount } => {
                if !(1..=999).contains(&amount) {
                    return Err("Item amounts must be between 1 and 999.".into());
                }
                let at = section(&bytes, location)? + usize::from(index) * ENTRY;
                let (handle, id) = (word(&bytes, at + 4)?, word(&bytes, at + 8)?);
                if !matches!(kind_of(handle, id), Some((Kind::Item, _))) || usize::from(index) >= capacity(location) {
                    return Err("Only items have amounts.".into());
                }
                bytes[at + 12..at + 16].copy_from_slice(&amount.to_le_bytes());
                expected.push((location, index, id, amount));
            }
            Change::Weapon { location, index, level, imprint } => {
                if usize::from(index) >= capacity(location) {
                    return Err("Invalid inventory entry.".into());
                }
                let at = section(&bytes, location)? + usize::from(index) * ENTRY;
                let (handle, id, amount) = (word(&bytes, at + 4)?, word(&bytes, at + 8)?, word(&bytes, at + 12)?);
                if !matches!(kind_of(handle, id), Some((Kind::Weapon, _))) || id == BARE_FISTS {
                    return Err("Only weapons have levels.".into());
                }
                let (base, _, _) = weapon_parts(id);
                let new_id = weapon_id(base, level, imprint);
                // Only IDs the player's own game names: a level or imprint this weapon has.
                if level > 10 || imprint > 2 || !text.weapons.contains_key(&new_id) {
                    return Err("This weapon has no such level or imprint.".into());
                }
                let block = slot_block(&bytes, handle, id)?;
                bytes[at + 8..at + 12].copy_from_slice(&new_id.to_le_bytes());
                bytes[block + 4..block + 8].copy_from_slice(&new_id.to_le_bytes());
                expected.push((location, index, new_id, amount));
            }
        }
    }
    // The edited file must still be a character whose entries are what was asked.
    let after = entries(&bytes, None)?;
    crate::save_editor::parse(&bytes, &edit.title_id, edit.slot)?
        .ok_or("Character validation failed after editing.")?;
    for (location, index, id, amount) in expected {
        let found = after
            .iter()
            .find(|e| e.location == location && e.index == index)
            .ok_or("Inventory validation failed after editing.")?;
        let raw = word(&bytes, section(&bytes, location)? + usize::from(index) * ENTRY + 8)?;
        if raw != id || found.amount != amount {
            return Err("Inventory validation failed after editing.".into());
        }
    }
    fs::write(path, bytes).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    const BASE: usize = 0xc000;

    fn put(bytes: &mut [u8], at: usize, value: u32) {
        bytes[at..at + 4].copy_from_slice(&value.to_le_bytes());
    }

    /// A synthetic character: the editor's sample, two items, a weapon with its slot block, armor.
    fn sample() -> Vec<u8> {
        let mut bytes = vec![0; 0x140000];
        let inventory = BASE + INVENTORY_FROM_NAME;
        bytes[inventory..inventory + 4].copy_from_slice(&[0x40, 0xf0, 0xff, 0xff]);
        bytes[inventory + 34028..inventory + 34032].copy_from_slice(b"FACE");
        for (i, unit) in "Hunter".encode_utf16().enumerate() {
            bytes[BASE + 1 + i * 2..BASE + 3 + i * 2].copy_from_slice(&unit.to_le_bytes());
        }
        for (relative, value) in [(-103isize, 12u32), (-95, 11), (-79, 22), (-71, 9), (-63, 6), (-55, 7), (-23, 17)] {
            put(&mut bytes, BASE.checked_add_signed(relative).unwrap(), value);
        }
        for (location, start) in [(Location::Inventory, inventory), (Location::Storage, inventory + STORAGE_FROM_INVENTORY)] {
            for index in 0..capacity(location) {
                put(&mut bytes, start + index * ENTRY + 8, FREE_ID);
            }
        }
        let entry = |bytes: &mut Vec<u8>, index: usize, handle: u32, id: u32, amount: u32| {
            let at = inventory + index * ENTRY;
            put(bytes, at + 4, handle);
            put(bytes, at + 8, id);
            put(bytes, at + 12, amount);
        };
        entry(&mut bytes, 0, 0x8080_004e, BARE_FISTS, 1);
        entry(&mut bytes, 1, 0xB000_03E8, 0x4000_03E8, 17); // item 1000
        entry(&mut bytes, 2, 0x8080_0050, 2_000_000, 1); // weapon 2000000 +0
        entry(&mut bytes, 3, 0x9080_0051, 0x1003_8270, 1); // armor 230000
        let block = BASE - 400;
        put(&mut bytes, block, 0x8080_0050);
        put(&mut bytes, block + 4, 2_000_000);
        bytes
    }

    fn text() -> ItemText {
        ItemText {
            goods: HashMap::from([(1000, "Vial".to_string())]),
            armor: HashMap::from([(230000, "Hood".to_string())]),
            weapons: (0..=10).map(|l| (2_000_000 + l * 100, "Blade".to_string())).collect(),
            ..Default::default()
        }
    }

    #[test]
    fn reads_items_weapons_and_armor() {
        let found = entries(&sample(), Some(&text())).unwrap();
        assert_eq!(found.len(), 3); // the bare fists are not shown
        assert_eq!((found[0].kind, found[0].id, found[0].amount), (Kind::Item, 1000, 17));
        assert_eq!(found[0].name.as_deref(), Some("Vial"));
        assert_eq!((found[1].kind, found[1].level, found[1].levels.len()), (Kind::Weapon, 0, 11));
        assert_eq!(found[1].imprints, vec![0]);
        assert_eq!((found[2].kind, found[2].id), (Kind::Armor, 230000));
    }

    fn staged(bytes: Vec<u8>) -> (std::path::PathBuf, std::path::PathBuf) {
        let root = std::env::temp_dir().join(format!("bb-inventory-{}", uuid::Uuid::new_v4()));
        let set = root.join("user/savedata/1/CUSA03173/SPRJ0005");
        fs::create_dir_all(&set).unwrap();
        fs::write(set.join("userdata0000"), bytes).unwrap();
        (root.clone(), root.join("user/savedata"))
    }

    #[test]
    fn edits_amounts_and_weapon_levels_in_both_places() {
        let bytes = sample();
        let (root, savedata) = staged(bytes.clone());
        let edit = Edit {
            title_id: "CUSA03173".into(),
            slot: 0,
            fingerprint: format!("{:x}", Sha256::digest(&bytes)),
            changes: vec![
                Change::Amount { location: Location::Inventory, index: 1, amount: 99 },
                Change::Weapon { location: Location::Inventory, index: 2, level: 10, imprint: 0 },
            ],
        };
        rewrite(&savedata, &edit, &text()).unwrap();
        let after = fs::read(savedata.join("1/CUSA03173/SPRJ0005/userdata0000")).unwrap();
        let found = entries(&after, Some(&text())).unwrap();
        assert_eq!(found[0].amount, 99);
        assert_eq!((found[1].id, found[1].level), (2_001_000, 10));
        assert_eq!(word(&after, BASE - 400 + 4).unwrap(), 2_001_000);
        // A stale preview and an ID the game does not have are refused.
        assert!(rewrite(&savedata, &edit, &text()).is_err());
        let bad = Edit {
            fingerprint: format!("{:x}", Sha256::digest(&after)),
            changes: vec![Change::Weapon { location: Location::Inventory, index: 2, level: 10, imprint: 1 }],
            ..edit
        };
        assert!(rewrite(&savedata, &bad, &text()).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    /// A copy of a real save and the player's dump (read-only): BB_TEST_SAVE_USER=<user dir>
    /// BB_CHECK_GAME=<dump> cargo test real_inventory -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_inventory() {
        let user = std::env::var("BB_TEST_SAVE_USER").expect("BB_TEST_SAVE_USER");
        let game = std::env::var("BB_CHECK_GAME").expect("BB_CHECK_GAME");
        let text = crate::game_data::item_text(Path::new(&game), "en").unwrap();
        let title = std::env::var("BB_TEST_SAVE_TITLE").unwrap_or_else(|_| "CUSA00207".into());
        let inventory = read(Path::new(&user), &title, 0, Some(&text)).unwrap();
        for entry in &inventory.entries {
            println!("{:?} {:?} {} {:?} x{} +{}", entry.location, entry.kind, entry.id, entry.name, entry.amount, entry.level);
        }
        assert!(inventory.entries.iter().all(|e| e.kind == Kind::Upgrade || e.name.is_some()));
    }
}
