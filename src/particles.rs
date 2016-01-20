pub struct Terrain {
  pub type_id: u32,
  pub pauli: bool,
}

impl Terrain {
  pub fn deserialize(i: u32) -> Option<&'static Terrain> {
    if (i as usize) >= TERRAIN_LIBRARY.len() {
      return None;
    }
    
    Some(&TERRAIN_LIBRARY[i as usize])
  }
}

pub struct Species {
  pub type_id: u32,
  pub pauli: bool,
}

pub struct Agent {
  pub species: &'static Species,
  pub x: i16,
  pub y: i16,
  pub agent_id: u32,
  pub action: u8,
  pub direction: u8,
  pub arg1: u8,
}

pub static TERRAIN_LIBRARY: [Terrain; 2] = [
  Terrain { type_id: 0, pauli: false }, // Grass
  Terrain { type_id: 1, pauli: true  }, // Water
];

pub static GRASS: &'static Terrain = &Terrain { type_id: 0, pauli: false };

pub static SPECIES_LIBRARY: [Species; 2] = [
  Species { type_id: 0, pauli: true  }, // Gremlin
  Species { type_id: 1, pauli: true  }, // Basic avatar
];

pub static GREMLIN: &'static Species = &Species { type_id: 0, pauli: true };
pub static AVATAR : &'static Species = &Species { type_id: 1, pauli: true };

pub struct Cell {
  pub x: i16,
  pub y: i16,
  pub terrain: &'static Terrain,
  pub has_agent: bool,
  pub agent_id: u32,
}

#[cfg(test)]
mod tests {
  use super::*;
  
  #[test]
  fn terrain_type_ids_match_indices() {
    for i in 0..TERRAIN_LIBRARY.len() {
      assert_eq!(TERRAIN_LIBRARY[i].type_id, i as u32);
    }
  }
  
  #[test]
  fn species_type_ids_match_indices() {
    for i in 0..SPECIES_LIBRARY.len() {
      assert_eq!(SPECIES_LIBRARY[i].type_id, i as u32);
    }
  }
}
