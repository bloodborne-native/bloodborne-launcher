// SPDX-License-Identifier: GPL-2.0-or-later
//! The game's own item text, read from the player's dump while the launcher runs: names and
//! descriptions of items, weapons and armor in the player's language. Nothing of it is stored or
//! shipped: the save editor shows what the player's own files say.
//!
//! The files: dvdroot_ps4/msg/<language>/item.msgbnd.dcx, a DCX (zlib "DFLT") around a BND4
//! container of FMG text tables. The formats are the FromSoftware ones documented by the modding
//! community (SoulsFormats); this reader is our own and checks every bound it reads.
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

type Result<T> = std::result::Result<T, String>;

fn bytes_at(data: &[u8], offset: usize, size: usize) -> Result<&[u8]> {
    offset
        .checked_add(size)
        .and_then(|end| data.get(offset..end))
        .ok_or_else(|| format!("Truncated game file at {offset:#x}"))
}
fn u32_le(data: &[u8], offset: usize) -> Result<u32> {
    Ok(u32::from_le_bytes(bytes_at(data, offset, 4)?.try_into().unwrap()))
}
fn i32_le(data: &[u8], offset: usize) -> Result<usize> {
    usize::try_from(i32::from_le_bytes(bytes_at(data, offset, 4)?.try_into().unwrap()))
        .map_err(|_| "Negative offset in a game file".into())
}
fn i64_le(data: &[u8], offset: usize) -> Result<usize> {
    usize::try_from(i64::from_le_bytes(bytes_at(data, offset, 8)?.try_into().unwrap()))
        .map_err(|_| "Negative offset in a game file".into())
}

/// A DCX file's contents (zlib, "DFLT", the compression the game's text archives use).
pub fn dcx(data: &[u8]) -> Result<Vec<u8>> {
    if bytes_at(data, 0, 4)? != b"DCX\0" || bytes_at(data, 0x28, 4)? != b"DFLT" {
        return Err("Not a DFLT DCX file".into());
    }
    let size = u32::from_be_bytes(bytes_at(data, 0x1C, 4)?.try_into().unwrap()) as usize;
    let packed = u32::from_be_bytes(bytes_at(data, 0x20, 4)?.try_into().unwrap()) as usize;
    let mut out = Vec::with_capacity(size);
    flate2::read::ZlibDecoder::new(bytes_at(data, 0x4C, packed)?)
        .read_to_end(&mut out)
        .map_err(|e| format!("DCX: {e}"))?;
    if out.len() != size {
        return Err("DCX: unexpected size".into());
    }
    Ok(out)
}

/// A BND4 container's files: (id, data).
pub fn bnd4(data: &[u8]) -> Result<Vec<(u32, &[u8])>> {
    if bytes_at(data, 0, 4)? != b"BND4" {
        return Err("Not a BND4 container".into());
    }
    let count = i32_le(data, 0x0C)?;
    let entry_size = i64_le(data, 0x20)?;
    if count > 4096 || entry_size < 0x24 {
        return Err("Unsupported BND4 layout".into());
    }
    (0..count)
        .map(|i| {
            let entry = 0x40 + i * entry_size;
            let size = i64_le(data, entry + 8)?;
            let offset = i32_le(data, entry + 0x18)?;
            let id = u32_le(data, entry + 0x1C)?;
            Ok((id, bytes_at(data, offset, size)?))
        })
        .collect()
}

/// An FMG text table (version 2, 64-bit offsets): id -> text.
pub fn fmg(data: &[u8]) -> Result<HashMap<u32, String>> {
    if bytes_at(data, 2, 1)?[0] != 2 {
        return Err("Unsupported FMG version".into());
    }
    let groups = i32_le(data, 0x0C)?;
    let strings = i32_le(data, 0x10)?;
    let table = i64_le(data, 0x18)?;
    let mut texts = HashMap::new();
    for group in 0..groups {
        let at = 0x28 + group * 0x10;
        let index = i32_le(data, at)?;
        let first = u32_le(data, at + 4)?;
        let last = u32_le(data, at + 8)?;
        if last < first || (last - first) as usize >= strings {
            return Err("Invalid FMG group".into());
        }
        for (k, id) in (first..=last).enumerate() {
            let string = i64_le(data, table + (index + k) * 8)?;
            if string == 0 {
                continue;
            }
            let mut units = Vec::new();
            let mut at = string;
            loop {
                let unit = u16::from_le_bytes(bytes_at(data, at, 2)?.try_into().unwrap());
                if unit == 0 {
                    break;
                }
                units.push(unit);
                at += 2;
            }
            texts.insert(id, String::from_utf16_lossy(&units));
        }
    }
    Ok(texts)
}

/// The dump's message folder for a launcher language ("pt-BR" -> "porbr"); English otherwise.
fn message_folder(language: &str) -> &'static str {
    match language {
        "da" => "dandk",
        "de" => "deude",
        "es-419" => "spaar",
        "es-ES" => "spaes",
        "fi" => "finfi",
        "fr" => "frafr",
        "it" => "itait",
        "ja" => "jpnjp",
        "ko" => "korkr",
        "nb" => "norno",
        "nl" => "nldnl",
        "pl" => "polpl",
        "pt-BR" => "porbr",
        "pt-PT" => "porpt",
        "ru" => "rusru",
        "sv" => "swese",
        "tr" => "turtr",
        "zh-CN" => "zhocn",
        "zh-TW" => "zhotw",
        _ => "engus",
    }
}

/// The item texts of one language: names (items, weapons, armor) and descriptions.
#[derive(Default, serde::Serialize)]
pub struct ItemText {
    pub goods: HashMap<u32, String>,
    pub weapons: HashMap<u32, String>,
    pub armor: HashMap<u32, String>,
    pub goods_info: HashMap<u32, String>,
    pub goods_caption: HashMap<u32, String>,
    pub weapon_caption: HashMap<u32, String>,
    pub armor_caption: HashMap<u32, String>,
}

// The tables of item.msgbnd: names, short descriptions and long ones (FMG ids in the container).
const GOODS_NAME: u32 = 10;
const WEAPON_NAME: u32 = 11;
const ARMOR_NAME: u32 = 12;
const GOODS_INFO: u32 = 20;
const GOODS_CAPTION: u32 = 24;
const WEAPON_CAPTION: u32 = 25;
const ARMOR_CAPTION: u32 = 26;

/// Reads the item texts from a game folder (the one with eboot.bin), in the given language.
pub fn item_text(game: &Path, language: &str) -> Result<ItemText> {
    let msg = game.join("dvdroot_ps4/msg");
    let mut path = msg.join(message_folder(language)).join("item.msgbnd.dcx");
    if !path.is_file() {
        path = msg.join("engus/item.msgbnd.dcx");
    }
    let raw = std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let container = dcx(&raw)?;
    let mut text = ItemText::default();
    for (id, data) in bnd4(&container)? {
        let slot = match id {
            GOODS_NAME => &mut text.goods,
            WEAPON_NAME => &mut text.weapons,
            ARMOR_NAME => &mut text.armor,
            GOODS_INFO => &mut text.goods_info,
            GOODS_CAPTION => &mut text.goods_caption,
            WEAPON_CAPTION => &mut text.weapon_caption,
            ARMOR_CAPTION => &mut text.armor_caption,
            _ => continue,
        };
        *slot = fmg(data)?;
    }
    if text.goods.is_empty() || text.weapons.is_empty() || text.armor.is_empty() {
        return Err("The game's item names were not found".into());
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One FMG with two groups, built here (no game data in the repository).
    fn sample_fmg() -> Vec<u8> {
        let texts = [(100u32, "First"), (101, "Second"), (200, "Third")];
        let mut out = vec![0u8; 0x28];
        out[2] = 2;
        out[0x0C..0x10].copy_from_slice(&2i32.to_le_bytes());
        out[0x10..0x14].copy_from_slice(&3i32.to_le_bytes());
        for (index, first, last) in [(0i32, 100u32, 101u32), (2, 200, 200)] {
            out.extend_from_slice(&index.to_le_bytes());
            out.extend_from_slice(&first.to_le_bytes());
            out.extend_from_slice(&last.to_le_bytes());
            out.extend_from_slice(&0i32.to_le_bytes());
        }
        let table = out.len();
        out[0x18..0x20].copy_from_slice(&(table as i64).to_le_bytes());
        out.resize(table + texts.len() * 8, 0);
        for (k, (_, text)) in texts.iter().enumerate() {
            let at = out.len();
            out[table + k * 8..table + k * 8 + 8].copy_from_slice(&(at as i64).to_le_bytes());
            for unit in text.encode_utf16() {
                out.extend_from_slice(&unit.to_le_bytes());
            }
            out.extend_from_slice(&[0, 0]);
        }
        out
    }

    #[test]
    fn reads_fmg_groups() {
        let texts = fmg(&sample_fmg()).unwrap();
        assert_eq!(texts[&100], "First");
        assert_eq!(texts[&101], "Second");
        assert_eq!(texts[&200], "Third");
        assert!(fmg(&sample_fmg()[..0x30]).is_err());
    }

    #[test]
    fn language_folders() {
        assert_eq!(message_folder("pt-BR"), "porbr");
        assert_eq!(message_folder("ja"), "jpnjp");
        assert_eq!(message_folder("xx"), "engus");
    }

    /// The player's dump: BB_CHECK_GAME=<dump> cargo test real_item_text -- --ignored --nocapture.
    #[test]
    #[ignore]
    fn real_item_text() {
        let game = std::env::var("BB_CHECK_GAME").expect("BB_CHECK_GAME");
        let text = item_text(Path::new(&game), "en").unwrap();
        println!("{} items, {} weapons, {} armor", text.goods.len(), text.weapons.len(), text.armor.len());
        assert!(text.goods.len() > 100 && text.weapons.len() > 100);
    }
}
