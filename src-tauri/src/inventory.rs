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
use crate::game_data::{GameParams, ItemText};
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
// The counters of a section, from the character name: (entries ever taken, at least those in use;
// the next ordering number). Adding an entry moves both on.
const INVENTORY_COUNTERS: (usize, usize) = (453, 34257);
const STORAGE_COUNTERS: (usize, usize) = (34737, 68541);
const STORAGE_MAX: u32 = 99;
// EquipParamGoods' goodsType: what the save editor may add to the inventory (key items live in a
// list of their own).
const GOODS_ADDABLE: [(u32, &str); 3] = [(0, "consumable"), (2, "material"), (6, "chalice")];

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
    /// Items: the most this section holds of it.
    pub max: u32,
    /// The game's icon number (iconId), for game_data::icon.
    pub icon: Option<u32>,
    /// What the hover card shows: from the game's parameter tables.
    pub stats: Option<serde_json::Value>,
}

/// One item the save editor can add (catalog).
#[derive(Serialize)]
pub struct CatalogItem {
    pub id: u32,
    pub name: String,
    pub category: &'static str,
    pub max: u32,
    pub icon: Option<u32>,
    pub description: Option<String>,
}

/// The items the game has names for and the editor can add: consumables, materials, chalices.
pub fn catalog(text: &ItemText, params: &GameParams) -> Vec<CatalogItem> {
    let mut items: Vec<CatalogItem> = params
        .goods
        .ids()
        .filter_map(|id| {
            let kind = params.goods.get(id, "goodsType")? as u32;
            let category = GOODS_ADDABLE.iter().find(|(k, _)| *k == kind)?.1;
            let name = text.goods.get(&id)?;
            if name.is_empty() || name.starts_with('?') {
                return None;
            }
            Some(CatalogItem {
                id,
                name: name.clone(),
                category,
                max: params.goods.get(id, "maxNum").unwrap_or(1.0).max(1.0) as u32,
                icon: params.goods.get(id, "iconId").map(|v| v as u32),
                description: text.goods_info.get(&id).cloned(),
            })
        })
        .collect();
    items.sort_by(|a, b| (a.category, a.id).cmp(&(b.category, b.id)));
    items
}

fn stat(params: &crate::game_data::Param, id: u32, fields: &[(&str, &str)]) -> serde_json::Value {
    serde_json::Value::Object(
        fields
            .iter()
            .filter_map(|(key, field)| Some((key.to_string(), serde_json::json!(params.get(id, field)?.round()))))
            .collect(),
    )
}

/// The hover card's numbers. Bloodborne kept Dark Souls' field names: "magic" is Bloodtinge in
/// requirements and scaling and Arcane in attack and defense, "faith" is Arcane, "thunder" Bolt
/// (checked against the Chikage, the Holy Moonlight Sword, the Blade of Mercy and Tonitrus).
fn stats_of(kind: Kind, id: u32, params: &GameParams) -> Option<serde_json::Value> {
    match kind {
        Kind::Weapon if params.weapons.has(id) => Some(serde_json::json!({
            "attack": stat(&params.weapons, id, &[("physical", "attackBasePhysics"), ("arcane", "attackBaseMagic"), ("fire", "attackBaseFire"), ("bolt", "attackBaseThunder")]),
            "scaling": stat(&params.weapons, id, &[("strength", "correctStrength"), ("skill", "correctAgility"), ("bloodtinge", "correctMagic"), ("arcane", "correctFaith")]),
            "requirements": stat(&params.weapons, id, &[("strength", "properStrength"), ("skill", "properAgility"), ("bloodtinge", "properMagic"), ("arcane", "properFaith")]),
        })),
        Kind::Armor if params.armor.has(id) => Some(serde_json::json!({
            "defense": stat(&params.armor, id, &[("physical", "defensePhysics"), ("blunt", "defenseBlow"), ("thrust", "defenseThrust"), ("arcane", "defenseMagic"), ("fire", "defenseFire"), ("bolt", "defenseThunder")]),
        })),
        Kind::Item if params.goods.has(id) => Some(serde_json::json!({
            "max": params.goods.get(id, "maxNum")?,
        })),
        _ => None,
    }
}

fn icon_of(kind: Kind, id: u32, params: &GameParams) -> Option<u32> {
    let value = match kind {
        Kind::Item => params.goods.get(id, "iconId"),
        Kind::Weapon => params.weapons.get(id, "iconId"),
        Kind::Armor => params.armor.get(id, "iconIdM"),
        Kind::Upgrade => None,
    }?;
    (value > 0.0).then_some(value as u32)
}

#[derive(Serialize)]
pub struct Inventory {
    pub title_id: String,
    pub slot: u8,
    pub fingerprint: String,
    pub entries: Vec<Entry>,
    pub upgrades: Vec<Upgrade>,
}

/// A gem or rune: a 40-byte record from byte 84 of the file (handle, source, type, shape and six
/// effect IDs, 0xFFFFFFFF for none), referenced by an inventory entry or a weapon's slot.
#[derive(Serialize, Debug)]
pub struct Upgrade {
    /// Its position in the list (what an edit refers to) and its handle.
    pub index: u16,
    pub handle: u32,
    pub rune: bool,
    /// Gems: 1 radial, 2 triangle, 4 waning, 8 circle, 63 droplet; runes: 1, 2 (Oath) or 4.
    pub shape: u8,
    pub effects: Vec<Effect>,
    /// Where it is: an inventory or storage entry, or a weapon's slot (the weapon's name).
    pub location: Option<Location>,
    /// In a slot: the weapon's name when the slot is a weapon's (runes have slots of their own).
    pub equipped: bool,
    pub weapon: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct Effect {
    /// Its position among the record's six (what an edit refers to).
    pub slot: u8,
    pub id: u32,
    pub text: Option<String>,
    /// The same kind of effect at its other strengths (the game's effects of the same category),
    /// weakest first: what this effect can be changed to.
    pub options: Vec<EffectOption>,
}

#[derive(Serialize, Debug)]
pub struct EffectOption {
    pub id: u32,
    pub text: String,
}

/// The effects of the same category as `id` that the game names, by rank: the alternatives an
/// edit may choose. A rune's effects and a gem's never mix (their categories differ).
fn effect_options(id: u32, text: &ItemText, params: &GameParams) -> Vec<EffectOption> {
    let Some(category) = params.gem_effects.get(id, "categoryId") else {
        return Vec::new();
    };
    let mut options: Vec<(f64, u32)> = params
        .gem_effects
        .ids()
        .filter(|&other| params.gem_effects.get(other, "categoryId") == Some(category))
        .filter(|other| text.gem_effects.contains_key(other))
        .map(|other| (params.gem_effects.get(other, "effectRank").unwrap_or(0.0), other))
        .collect();
    options.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    options.into_iter().map(|(_, other)| EffectOption { id: other, text: text.gem_effects[&other].clone() }).collect()
}

const UPGRADE: usize = 40;
const NO_EFFECT: u32 = 0xFFFF_FFFF;
const GEM_SHAPES: [u8; 5] = [1, 2, 4, 8, 63];
// Runes: 1 and 2 (Oath) as known, 4 seen in a real save.
const RUNE_SHAPES: [u8; 3] = [1, 2, 4];

/// A gem or rune record: (its offset, handle, whether a rune, shape, effect IDs).
type Record = (usize, u32, bool, u8, [u32; 6]);
/// A weapon's or armor piece's slot block: (its offset, the weapon or armor ID, the five slots'
/// (shape, gem handle)).
type SlotBlock = (usize, u32, [(u32, u32); 5]);

/// The gem and rune records, until the first record that is not one (the list has no length).
fn upgrade_records(bytes: &[u8]) -> Result<Vec<Record>> {
    let mut found = Vec::new();
    let mut at = UPGRADES_START;
    while let Some(record) = bytes.get(at..at + UPGRADE) {
        let (kind, shape) = (record[8], record[12]);
        let valid = match kind {
            1 => GEM_SHAPES.contains(&shape),
            2 => RUNE_SHAPES.contains(&shape),
            _ => false,
        };
        if !valid || record[9..12] != [0, 0, 0] || record[13..16] != [0, 0, 0] {
            break;
        }
        let mut effects = [0u32; 6];
        for (i, effect) in effects.iter_mut().enumerate() {
            *effect = word(record, 16 + i * 4)?;
        }
        found.push((at, word(record, 0)?, kind == 2, shape, effects));
        at += UPGRADE;
        if found.len() > 4096 {
            return Err("Unrecognized gem list.".into());
        }
    }
    Ok(found)
}

/// The weapons' and armor's slot blocks after the gem list: (block offset, its weapon or armor ID,
/// the five slots' (shape, gem handle)).
fn slot_blocks(bytes: &[u8], end: usize) -> Result<Vec<SlotBlock>> {
    let start = UPGRADES_START + upgrade_records(bytes)?.len() * UPGRADE;
    let mut blocks = Vec::new();
    let mut at = start;
    while at + SLOT_BLOCK <= end {
        let handle = word(bytes, at)?;
        // A block starts with its weapon's (0x8080...) or armor piece's (0x9080...) handle; a closed
        // slot's shape (0x80000000) and fillers do not match, and are stepped over 4 bytes at a time.
        if matches!(handle >> 16, 0x8080 | 0x9080) {
            let mut slots = [(0u32, 0u32); 5];
            for (i, slot) in slots.iter_mut().enumerate() {
                *slot = (word(bytes, at + 20 + i * 8)?, word(bytes, at + 24 + i * 8)?);
            }
            blocks.push((at, word(bytes, at + 4)?, slots));
            at += SLOT_BLOCK;
        } else {
            at += 4;
        }
    }
    Ok(blocks)
}

fn upgrades(bytes: &[u8], entries: &[Entry], text: Option<&ItemText>, params: Option<&GameParams>) -> Result<Vec<Upgrade>> {
    let base = character_base(bytes)?.ok_or("The character slot is empty.")?;
    let blocks_end = base.saturating_sub(147);
    let blocks = slot_blocks(bytes, blocks_end)?;
    let blocks_start = UPGRADES_START + upgrade_records(bytes)?.len() * UPGRADE;
    // Every handle a slot holds: weapons' and armor's blocks, and the rune slots, which are not in
    // a block of either.
    let slotted: std::collections::HashSet<u32> = (blocks_start..blocks_end.saturating_sub(4))
        .step_by(4)
        .filter_map(|at| word(bytes, at).ok())
        .filter(|handle| handle >> 24 == 0xC0)
        .collect();
    let mut held = std::collections::HashMap::new();
    for location in [Location::Inventory, Location::Storage] {
        let start = section(bytes, location)?;
        for entry in entries.iter().filter(|e| e.location == location && e.kind == Kind::Upgrade) {
            held.insert(word(bytes, start + usize::from(entry.index) * ENTRY + 4)?, location);
        }
    }
    // Records nothing refers to (gems and runes discarded or used up) are left out.
    Ok(upgrade_records(bytes)?
        .into_iter()
        .enumerate()
        .filter(|(_, (_, handle, ..))| held.contains_key(handle) || slotted.contains(handle))
        .map(|(index, (_, handle, rune, shape, effects))| {
            let block = blocks.iter().find(|(_, _, slots)| slots.iter().any(|(_, gem)| *gem == handle));
            let weapon = block.and_then(|(_, weapon, _)| {
                let (base, _, _) = weapon_parts(*weapon);
                text.and_then(|t| t.weapons.get(&base).cloned())
            });
            Upgrade {
                index: index as u16,
                handle,
                rune,
                shape,
                effects: effects
                    .iter()
                    .enumerate()
                    .filter(|&(_, &id)| id != NO_EFFECT)
                    .map(|(slot, &id)| Effect {
                        slot: slot as u8,
                        id,
                        text: text.and_then(|t| t.gem_effects.get(&id).cloned()),
                        options: match (text, params) {
                            (Some(text), Some(params)) => effect_options(id, text, params),
                            _ => Vec::new(),
                        },
                    })
                    .collect(),
                location: held.get(&handle).copied(),
                equipped: slotted.contains(&handle),
                weapon,
            }
        })
        .collect())
}

#[derive(Deserialize, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Change {
    Amount { location: Location, index: u16, amount: u32 },
    Weapon { location: Location, index: u16, level: u8, imprint: u8 },
    Add { location: Location, id: u32, amount: u32 },
    /// A gem's or rune's effect (by its position among the record's six) changed to another of
    /// the same category.
    Effect { upgrade: u16, slot: u8, effect: u32 },
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

fn entries(bytes: &[u8], text: Option<&ItemText>, params: Option<&GameParams>) -> Result<Vec<Entry>> {
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
                max: 0,
                icon: None,
                stats: None,
            };
            if let Some(params) = params {
                entry.icon = icon_of(kind, item, params);
                entry.stats = stats_of(kind, item, params);
                if kind == Kind::Item {
                    entry.max = item_max(params, item, location).unwrap_or(STORAGE_MAX);
                }
            }
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

/// The most a section holds of an item: the game's maxNum in the inventory, 99 in storage.
fn item_max(params: &GameParams, id: u32, location: Location) -> Option<u32> {
    let max = params.goods.get(id, "maxNum")?.max(1.0) as u32;
    Some(match location {
        Location::Inventory => max,
        Location::Storage => STORAGE_MAX.max(max),
    })
}

pub fn read(user: &Path, title: &str, slot: u8, text: Option<&ItemText>, params: Option<&GameParams>) -> Result<Inventory> {
    let bytes = slot_bytes(&slot_path(user, title, slot)?)?;
    let entries = entries(&bytes, text, params)?;
    Ok(Inventory {
        title_id: title.into(),
        slot,
        fingerprint: format!("{:x}", Sha256::digest(&bytes)),
        upgrades: upgrades(&bytes, &entries, text, params)?,
        entries,
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

/// Adds an item in the section's first free entry: the game's handle and ID words, the amount,
/// the next ordering number, and both counters moved on. An item the section already holds is
/// refused (its amount is what to change).
fn add_item(bytes: &mut [u8], location: Location, id: u32, amount: u32) -> Result<u16> {
    let base = character_base(bytes)?.ok_or("The character slot is empty.")?;
    let start = section(bytes, location)?;
    let (count_at, next_at) = match location {
        Location::Inventory => INVENTORY_COUNTERS,
        Location::Storage => STORAGE_COUNTERS,
    };
    let (count_at, next_at) = (base + count_at, base + next_at);
    let (count, next) = (word(bytes, count_at)?, word(bytes, next_at)?);
    let mut free = None;
    let mut used = 0u32;
    for index in 0..capacity(location) {
        let at = start + index * ENTRY;
        let (handle, entry_id) = (word(bytes, at + 4)?, word(bytes, at + 8)?);
        if entry_id == FREE_ID {
            free.get_or_insert(index);
            continue;
        }
        used += 1;
        if kind_of(handle, entry_id) == Some((Kind::Item, id)) {
            return Err("The character already has this item: change its amount instead.".into());
        }
    }
    // The first counter is at least the entries in use (the game does not lower it when a stack
    // runs out); one below that means this is not the layout this editor knows.
    if count < used {
        return Err("The section's counter does not match its entries.".into());
    }
    let index = free.ok_or("This section is full.")?;
    let at = start + index * ENTRY;
    bytes[at] = next as u8;
    bytes[at + 4..at + 8].copy_from_slice(&(0xB000_0000 | id).to_le_bytes());
    bytes[at + 8..at + 12].copy_from_slice(&(0x4000_0000 | id).to_le_bytes());
    bytes[at + 12..at + 16].copy_from_slice(&amount.to_le_bytes());
    bytes[count_at..count_at + 4].copy_from_slice(&(count + 1).to_le_bytes());
    bytes[next_at..next_at + 4].copy_from_slice(&(next + 1).to_le_bytes());
    Ok(index as u16)
}

/// Applies the changes to one character file in a staged save set, then checks the result.
pub fn rewrite(savedata: &Path, edit: &Edit, text: &ItemText, params: &GameParams) -> Result<()> {
    let user = savedata.parent().ok_or("Invalid save staging folder.")?;
    let path = slot_path(user, &edit.title_id, edit.slot)?;
    let mut bytes = slot_bytes(&path)?;
    let original = bytes.clone();
    if format!("{:x}", Sha256::digest(&bytes)) != edit.fingerprint {
        return Err("The character changed since it was opened. Refresh the inventory.".into());
    }
    if edit.changes.is_empty() {
        return Err("No inventory values changed.".into());
    }
    let mut expected = Vec::new();
    let mut expected_effects = Vec::new();
    for change in &edit.changes {
        match *change {
            Change::Amount { location, index, amount } => {
                if usize::from(index) >= capacity(location) {
                    return Err("Invalid inventory entry.".into());
                }
                let at = section(&bytes, location)? + usize::from(index) * ENTRY;
                let (handle, id) = (word(&bytes, at + 4)?, word(&bytes, at + 8)?);
                let Some((Kind::Item, item)) = kind_of(handle, id) else {
                    return Err("Only items have amounts.".into());
                };
                let max = item_max(params, item, location).ok_or("This item is not in the game's tables.")?;
                if !(1..=max).contains(&amount) {
                    return Err(format!("This item's amount must be between 1 and {max}."));
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
            Change::Effect { upgrade, slot, effect } => {
                let records = upgrade_records(&bytes)?;
                let (at, ..) = *records.get(usize::from(upgrade)).ok_or("Unknown gem.")?;
                let field = at + 16 + usize::from(slot) * 4;
                if slot >= 6 {
                    return Err("Unknown gem effect.".into());
                }
                let current = word(&bytes, field)?;
                let category = |id| params.gem_effects.get(id, "categoryId");
                if current == NO_EFFECT || category(current).is_none() || category(current) != category(effect)
                    || !text.gem_effects.contains_key(&effect)
                {
                    return Err("An effect can only change to another of the same kind.".into());
                }
                bytes[field..field + 4].copy_from_slice(&effect.to_le_bytes());
                expected_effects.push((field, effect));
            }
            Change::Add { location, id, amount } => {
                let kind = params.goods.get(id, "goodsType").ok_or("This item is not in the game's tables.")? as u32;
                if !GOODS_ADDABLE.iter().any(|(k, _)| *k == kind) || id > 0x00FF_FFFF {
                    return Err("Only consumables, materials and chalices can be added.".into());
                }
                let max = item_max(params, id, location).ok_or("This item is not in the game's tables.")?;
                if !(1..=max).contains(&amount) {
                    return Err(format!("This item's amount must be between 1 and {max}."));
                }
                let index = add_item(&mut bytes, location, id, amount)?;
                expected.push((location, index, 0x4000_0000 | id, amount));
            }
        }
    }
    // The edited file must still be a character whose entries are what was asked.
    let after = entries(&bytes, None, None)?;
    crate::save_editor::parse(&bytes, &edit.title_id, edit.slot)?
        .ok_or("Character validation failed after editing.")?;
    for (field, effect) in expected_effects {
        if word(&bytes, field)? != effect {
            return Err("Gem validation failed after editing.".into());
        }
    }
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
    crate::save_editor::mirror(&original, &mut bytes)?;
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
        // A radial gem with one effect, held in the inventory (entry 5).
        put(&mut bytes, UPGRADES_START, 0xC080_0041);
        put(&mut bytes, UPGRADES_START + 4, 0x8001_E460);
        bytes[UPGRADES_START + 8] = 1;
        bytes[UPGRADES_START + 12] = 1;
        put(&mut bytes, UPGRADES_START + 16, 126201);
        for i in 1..6 {
            put(&mut bytes, UPGRADES_START + 16 + i * 4, NO_EFFECT);
        }
        entry(&mut bytes, 5, 0xC080_0041, 0x8001_E460, 1);
        put(&mut bytes, BASE + INVENTORY_COUNTERS.0, 5);
        put(&mut bytes, BASE + INVENTORY_COUNTERS.1, 0x70);
        let block = BASE - 400;
        put(&mut bytes, block, 0x8080_0050);
        put(&mut bytes, block + 4, 2_000_000);
        bytes
    }

    fn params() -> GameParams {
        use crate::game_data::Param;
        GameParams {
            goods: Param::synthetic(&[
                (1000, &[("goodsType", 0.0), ("maxNum", 20.0), ("iconId", 146.0)]),
                (3000, &[("goodsType", 2.0), ("maxNum", 99.0), ("iconId", 83.0)]),
                (4000, &[("goodsType", 1.0), ("maxNum", 1.0), ("iconId", 1.0)]),
            ]),
            weapons: Param::synthetic(&[(2_000_000, &[("attackBasePhysics", 90.0), ("properStrength", 8.0), ("iconId", 7.0)])]),
            armor: Param::synthetic(&[(230000, &[("defensePhysics", 20.0), ("iconIdM", 9.0)])]),
            gem_effects: Param::synthetic(&[
                (126201, &[("categoryId", 1.0), ("effectRank", 1.0)]),
                (126207, &[("categoryId", 1.0), ("effectRank", 7.0)]),
                (122401, &[("categoryId", 2.0), ("effectRank", 1.0)]),
            ]),
        }
    }

    fn text() -> ItemText {
        ItemText {
            goods: HashMap::from([(1000, "Vial".to_string())]),
            armor: HashMap::from([(230000, "Hood".to_string())]),
            weapons: (0..=10).map(|l| (2_000_000 + l * 100, "Blade".to_string())).collect(),
            gem_effects: HashMap::from([
                (126201, "Physical +0.7%".to_string()),
                (126207, "Physical +7%".to_string()),
                (122401, "Blood +1.8%".to_string()),
            ]),
            ..Default::default()
        }
    }

    #[test]
    fn reads_items_weapons_and_armor() {
        let found = entries(&sample(), Some(&text()), Some(&params())).unwrap();
        assert_eq!(found.len(), 4); // the bare fists are not shown; the gem's entry is
        assert_eq!((found[0].kind, found[0].id, found[0].amount), (Kind::Item, 1000, 17));
        assert_eq!(found[0].name.as_deref(), Some("Vial"));
        assert_eq!((found[1].kind, found[1].level, found[1].levels.len()), (Kind::Weapon, 0, 11));
        assert_eq!(found[1].imprints, vec![0]);
        assert_eq!((found[2].kind, found[2].id), (Kind::Armor, 230000));
        assert_eq!((found[0].max, found[0].icon), (20, Some(146)));
        assert_eq!(found[1].stats.as_ref().unwrap()["attack"]["physical"], 90.0);
        assert_eq!(found[1].stats.as_ref().unwrap()["requirements"]["strength"], 8.0);
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
                Change::Amount { location: Location::Inventory, index: 1, amount: 20 },
                Change::Weapon { location: Location::Inventory, index: 2, level: 10, imprint: 0 },
            ],
        };
        rewrite(&savedata, &edit, &text(), &params()).unwrap();
        let after = fs::read(savedata.join("1/CUSA03173/SPRJ0005/userdata0000")).unwrap();
        let found = entries(&after, Some(&text()), None).unwrap();
        assert_eq!(found[0].amount, 20);
        assert_eq!((found[1].id, found[1].level), (2_001_000, 10));
        assert_eq!(word(&after, BASE - 400 + 4).unwrap(), 2_001_000);
        // A stale preview and an ID the game does not have are refused.
        assert!(rewrite(&savedata, &edit, &text(), &params()).is_err());
        let bad = Edit {
            fingerprint: format!("{:x}", Sha256::digest(&after)),
            changes: vec![Change::Weapon { location: Location::Inventory, index: 2, level: 10, imprint: 1 }],
            ..edit
        };
        assert!(rewrite(&savedata, &bad, &text(), &params()).is_err());
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
        let params = crate::game_data::game_params(Path::new(&game)).unwrap();
        let inventory = read(Path::new(&user), &title, 0, Some(&text), Some(&params)).unwrap();
        for entry in &inventory.entries {
            println!("{:?} {:?} {} {:?} x{} +{}", entry.location, entry.kind, entry.id, entry.name, entry.amount, entry.level);
        }
        for gem in &inventory.upgrades {
            println!("gem {} rune {} shape {} {:?} {:?} {:?}", gem.index, gem.rune, gem.shape, gem.location, gem.weapon,
                gem.effects.iter().map(|e| e.text.clone()).collect::<Vec<_>>());
        }
        assert!(inventory.entries.iter().all(|e| e.kind == Kind::Upgrade || e.name.is_some()));
    }

    #[test]
    fn adds_items_with_counters_and_limits() {
        let bytes = sample();
        let (root, savedata) = staged(bytes.clone());
        let add = |amount, id| Edit {
            title_id: "CUSA03173".into(),
            slot: 0,
            fingerprint: format!("{:x}", Sha256::digest(&bytes)),
            changes: vec![Change::Add { location: Location::Inventory, id, amount }],
        };
        // Over the stack limit, a key item and an item already held are refused.
        assert!(rewrite(&savedata, &add(100, 3000), &text(), &params()).is_err());
        assert!(rewrite(&savedata, &add(1, 4000), &text(), &params()).is_err());
        assert!(rewrite(&savedata, &add(1, 1000), &text(), &params()).is_err());
        rewrite(&savedata, &add(99, 3000), &text(), &params()).unwrap();
        let after = fs::read(savedata.join("1/CUSA03173/SPRJ0005/userdata0000")).unwrap();
        let added = entries(&after, None, None).unwrap().into_iter().find(|e| e.id == 3000).unwrap();
        assert_eq!((added.index, added.amount), (4, 99));
        assert_eq!(after[BASE + INVENTORY_FROM_NAME + 4 * ENTRY], 0x70);
        assert_eq!(word(&after, BASE + INVENTORY_COUNTERS.0).unwrap(), 6);
        assert_eq!(word(&after, BASE + INVENTORY_COUNTERS.1).unwrap(), 0x71);
        fs::remove_dir_all(root).unwrap();
    }

    /// Adds to a scratch copy of a real save (never the player's own): BB_TEST_SAVE_USER=<copy>
    /// BB_CHECK_GAME=<dump> cargo test real_add_items -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_add_items() {
        let user = std::path::PathBuf::from(std::env::var("BB_TEST_SAVE_USER").expect("BB_TEST_SAVE_USER"));
        let game = std::env::var("BB_CHECK_GAME").expect("BB_CHECK_GAME");
        let text = crate::game_data::item_text(Path::new(&game), "en").unwrap();
        let params = crate::game_data::game_params(Path::new(&game)).unwrap();
        let title = std::env::var("BB_TEST_SAVE_TITLE").unwrap_or_else(|_| "CUSA00207".into());
        let before = read(&user, &title, 0, Some(&text), Some(&params)).unwrap();
        let held = |id: u32, location: Location| before.entries.iter().any(|e| e.id == id && e.location == location);
        let mut changes = Vec::new();
        if !held(3020, Location::Inventory) {
            changes.push(Change::Add { location: Location::Inventory, id: 3020, amount: 5 });
        }
        if !held(3010, Location::Storage) {
            changes.push(Change::Add { location: Location::Storage, id: 3010, amount: 30 });
        }
        let edit = Edit { title_id: title.clone(), slot: 0, fingerprint: before.fingerprint.clone(), changes };
        rewrite(&user.join("savedata"), &edit, &text, &params).unwrap();
        for entry in read(&user, &title, 0, Some(&text), Some(&params)).unwrap().entries {
            if [3020, 3010].contains(&entry.id) {
                println!("{:?} {} {:?} x{}", entry.location, entry.index, entry.name, entry.amount);
            }
        }
    }

    /// A weapon level and an added item on a scratch copy (never the player's own):
    /// BB_TEST_SAVE_USER=<copy> BB_CHECK_GAME=<dump> cargo test real_weapon_and_item -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_weapon_and_item() {
        let user = std::path::PathBuf::from(std::env::var("BB_TEST_SAVE_USER").expect("BB_TEST_SAVE_USER"));
        let game = std::env::var("BB_CHECK_GAME").expect("BB_CHECK_GAME");
        let text = crate::game_data::item_text(Path::new(&game), "en").unwrap();
        let params = crate::game_data::game_params(Path::new(&game)).unwrap();
        let title = std::env::var("BB_TEST_SAVE_TITLE").unwrap_or_else(|_| "CUSA00207".into());
        let before = read(&user, &title, 0, Some(&text), Some(&params)).unwrap();
        let weapon = before.entries.iter().find(|e| e.kind == Kind::Weapon && e.levels.contains(&5) && e.level != 5).unwrap();
        println!("weapon {:?} +{} -> +5", weapon.name, weapon.level);
        let edit = Edit {
            title_id: title.clone(),
            slot: 0,
            fingerprint: before.fingerprint.clone(),
            changes: vec![
                Change::Weapon { location: weapon.location, index: weapon.index, level: 5, imprint: weapon.imprint },
                Change::Add { location: Location::Inventory, id: 3030, amount: 1 },
            ],
        };
        rewrite(&user.join("savedata"), &edit, &text, &params).unwrap();
    }

    #[test]
    fn gems_read_and_change_within_their_category() {
        let bytes = sample();
        let found = entries(&bytes, None, None).unwrap();
        let gems = upgrades(&bytes, &found, Some(&text()), Some(&params())).unwrap();
        assert_eq!(gems.len(), 1);
        assert_eq!((gems[0].shape, gems[0].location), (1, Some(Location::Inventory)));
        let options: Vec<u32> = gems[0].effects[0].options.iter().map(|o| o.id).collect();
        assert_eq!(options, vec![126201, 126207]);
        let (root, savedata) = staged(bytes.clone());
        let change = |effect| Edit {
            title_id: "CUSA03173".into(),
            slot: 0,
            fingerprint: format!("{:x}", Sha256::digest(&bytes)),
            changes: vec![Change::Effect { upgrade: 0, slot: 0, effect }],
        };
        // Another kind of effect, and an empty effect slot, are refused.
        assert!(rewrite(&savedata, &change(122401), &text(), &params()).is_err());
        let empty = Edit { changes: vec![Change::Effect { upgrade: 0, slot: 1, effect: 126207 }], ..change(126207) };
        assert!(rewrite(&savedata, &empty, &text(), &params()).is_err());
        rewrite(&savedata, &change(126207), &text(), &params()).unwrap();
        let after = fs::read(savedata.join("1/CUSA03173/SPRJ0005/userdata0000")).unwrap();
        assert_eq!(word(&after, UPGRADES_START + 16).unwrap(), 126207);
        fs::remove_dir_all(root).unwrap();
    }

    /// A gem effect raised to its strongest kind on a scratch copy (never the player's own):
    /// BB_TEST_SAVE_USER=<copy> BB_CHECK_GAME=<dump> cargo test real_gem_effect -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_gem_effect() {
        let user = std::path::PathBuf::from(std::env::var("BB_TEST_SAVE_USER").expect("BB_TEST_SAVE_USER"));
        let game = std::env::var("BB_CHECK_GAME").expect("BB_CHECK_GAME");
        let text = crate::game_data::item_text(Path::new(&game), "en").unwrap();
        let params = crate::game_data::game_params(Path::new(&game)).unwrap();
        let title = std::env::var("BB_TEST_SAVE_TITLE").unwrap_or_else(|_| "CUSA00207".into());
        let before = read(&user, &title, 0, Some(&text), Some(&params)).unwrap();
        let gem = before.upgrades.iter().find(|g| !g.rune && g.location == Some(Location::Inventory) && g.effects[0].options.len() > 1).unwrap();
        let best = gem.effects[0].options.last().unwrap();
        println!("gem {}: {:?} -> {}", gem.index, gem.effects[0].text, best.text);
        let edit = Edit {
            title_id: title.clone(),
            slot: 0,
            fingerprint: before.fingerprint.clone(),
            changes: vec![Change::Effect { upgrade: gem.index, slot: 0, effect: best.id }],
        };
        rewrite(&user.join("savedata"), &edit, &text, &params).unwrap();
    }
}
