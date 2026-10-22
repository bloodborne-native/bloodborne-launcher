// SPDX-License-Identifier: GPL-2.0-or-later
//! Base HP and stamina progression for Bloodborne 1.09.
//! Numeric values checked against the public Bloodborne Wiki Vitality and Endurance tables
//! (https://www.bloodborne-wiki.com/2015/05/vitality.html and
//! https://www.bloodborne-wiki.com/2015/05/endurance.html, CC BY-SA 3.0).
//! No wiki text or game data files are included. The 12/11 values match a copied game save.

const HP_FROM_VITALITY_7_TO_99: [u16; 93] = [
    511, 530, 552, 573, 594, 616, 638, 658, 682, 698, 718, 742, 766, 792, 821, 849, 878, 908, 938,
    970, 1001, 1034, 1066, 1100, 1123, 1147, 1170, 1193, 1216, 1239, 1261, 1283, 1304, 1325, 1346,
    1366, 1386, 1405, 1424, 1442, 1458, 1474, 1489, 1500, 1508, 1517, 1526, 1535, 1544, 1553, 1562,
    1571, 1580, 1588, 1597, 1606, 1615, 1623, 1632, 1641, 1649, 1658, 1666, 1675, 1683, 1692, 1700,
    1709, 1717, 1725, 1734, 1742, 1750, 1758, 1767, 1775, 1783, 1791, 1799, 1807, 1814, 1822, 1830,
    1837, 1845, 1852, 1860, 1867, 1874, 1881, 1888, 1894, 1900,
];

const STAMINA_FROM_ENDURANCE_8_TO_99: [u16; 92] = [
    88, 90, 91, 93, 95, 97, 98, 100, 102, 104, 106, 108, 110, 112, 115, 117, 119, 121, 124, 126,
    129, 131, 133, 136, 139, 141, 144, 146, 149, 152, 154, 157, 160, 160, 160, 160, 160, 160, 161,
    161, 161, 161, 161, 161, 162, 162, 162, 162, 162, 162, 163, 163, 163, 163, 163, 163, 164, 164,
    164, 164, 164, 164, 165, 165, 165, 165, 165, 165, 166, 166, 166, 166, 166, 166, 167, 167, 167,
    167, 167, 167, 168, 168, 168, 168, 168, 168, 169, 169, 169, 169, 169, 170,
];

pub fn hp(vitality: u32) -> Option<u32> {
    let index = vitality.checked_sub(7)? as usize;
    HP_FROM_VITALITY_7_TO_99.get(index).copied().map(u32::from)
}

pub fn stamina(endurance: u32) -> Option<u32> {
    let index = endurance.checked_sub(8)? as usize;
    STAMINA_FROM_ENDURANCE_8_TO_99
        .get(index)
        .copied()
        .map(u32::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn known_growth_points() {
        assert_eq!(hp(12), Some(616));
        assert_eq!(hp(13), Some(638));
        assert_eq!(hp(50), Some(1500));
        assert_eq!(hp(99), Some(1900));
        assert_eq!(stamina(11), Some(93));
        assert_eq!(stamina(12), Some(95));
        assert_eq!(stamina(40), Some(160));
        assert_eq!(stamina(99), Some(170));
        assert_eq!(hp(6), None);
        assert_eq!(stamina(7), None);
    }
}
