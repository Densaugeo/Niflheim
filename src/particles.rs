extern crate byteorder;

use byteorder::{LittleEndian, WriteBytesExt};

pub struct Terrain {
  type_id: u32,
  pub pauli: bool,
}

impl Terrain {
  pub fn serialize(&self) -> u32 {
    self.type_id
  }
  
  pub fn deserialize(i: u32) -> Option<&'static Terrain> {
    if (i as usize) >= TERRAIN_LIBRARY.len() {
      return None;
    }
    
    Some(&TERRAIN_LIBRARY[i as usize])
  }
}

pub struct Species {
  type_id: u32,
  pub pauli: bool,
}

impl Species {
  pub fn serialize(&self) -> u32 {
    self.type_id
  }
  
  pub fn deserialize(i: u32) -> Option<&'static Species> {
    if (i as usize) >= SPECIES_LIBRARY.len() {
      return None;
    }
    
    Some(&SPECIES_LIBRARY[i as usize])
  }
}

#[derive(Copy, Clone)]
pub struct Agent {
  pub species: &'static Species,
  pub x: i16,
  pub y: i16,
  pub agent_id: u32,
  pub action: u8,
  pub direction: u8,
  pub arg1: u8,
}

impl Agent {
  pub fn serialize(&self, vector: &mut Vec<u8>) {
    vector.write_u32::<LittleEndian>(self.species.type_id).unwrap();
    vector.write_u32::<LittleEndian>(self.agent_id).unwrap();
  }
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

#[derive(Copy, Clone)]
pub struct Cell {
  pub x: i16,
  pub y: i16,
  pub terrain: &'static Terrain,
  pub has_agent: bool,
  pub agent_id: u32,
}

impl Cell {
  pub fn serialize(&self, vector: &mut Vec<u8>) {
    vector.write_i16::<LittleEndian>(self.x).unwrap();
    vector.write_i16::<LittleEndian>(self.y).unwrap();
    vector.write_u32::<LittleEndian>(self.terrain.serialize()).unwrap();
    vector.push(self.has_agent as u8);
    vector.write_u32::<LittleEndian>(self.agent_id).unwrap();
  }
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
