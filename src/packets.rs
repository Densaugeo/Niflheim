use particles;

use settings::{WIDTH, HEIGHT};

enum PacketType {
  RegionProperties = 1,
  CellCache = 2,
  AgentCache = 3,
  CellUpdate = 4,
  //AgentUpdate = 5,
  //AgentAction = 6,
}

pub const WALK: u8 = 1;
pub const TERRAFORM: u8 = 2;

trait MoarReads {
  fn read_u32(&self, start: usize) -> u32;
}

impl MoarReads for [u8] {
  fn read_u32(&self, start: usize) -> u32 {
    (self[3 + start] as u32) << 24 |
    (self[2 + start] as u32) << 16 |
    (self[1 + start] as u32) << 8 |
    self[start] as u32
  }
}

pub trait PacketData {
  fn deserialize(buffer: &[u8]) -> Self;
}

pub struct AgentActionPacket {
  pub agent_id: u32,
  pub action: u8,
  pub direction: u8,
  pub arg1: u8,
}

impl PacketData for AgentActionPacket {
  fn deserialize(buffer: &[u8]) -> Self {
    AgentActionPacket {
      agent_id: buffer.read_u32(0),
      action: buffer[15],
      direction: buffer[16],
      arg1: buffer[17],
    }
  }
}

pub trait PacketBuffer {
  fn get_mut_0(&mut self) -> &mut Vec<u8>;
  
  fn finalize(&mut self) -> &Vec<u8> {
    let vector = self.get_mut_0();
    let size = vector.len();
    
    // This should be impossible
    if size > 0x10000 {
      panic!("Packet is too large! Must be no larger than 2^16");
    }
    
    vector[5] = (size & 0xFF) as u8;
    vector[6] = (size / 0x100) as u8;
    
    return vector;
  }
  
  fn push_u8(&mut self, value: u8) {
    self.get_mut_0().push(value);
  }
  
  fn push_u16(&mut self, value: u16) {
    self.get_mut_0().push((value & 0xFF) as u8);
    self.get_mut_0().push((value >> 8) as u8);
  }
  
  fn push_i16(&mut self, value: i16) {
    self.get_mut_0().push((value & 0xFF) as u8);
    self.get_mut_0().push((value >> 8) as u8);
  }
  
  fn push_u32(&mut self, value: u32) {
    self.get_mut_0().push((value & 0xFF) as u8);
    self.get_mut_0().push(((value >> 8) & 0xFF) as u8);
    self.get_mut_0().push(((value >> 16) & 0xFF) as u8);
    self.get_mut_0().push((value >> 24) as u8);
  }
  
  fn push_header(&mut self, packet_type: PacketType) {
    self.push_u32(0x0117BAC0); // Protocol
    self.push_u8(packet_type as u8);
    self.push_u16(11); // Size (bytes)
    self.push_u32(0); // Region ID
  }
}

pub struct RegionPropertiesBuffer(Vec<u8>);

impl RegionPropertiesBuffer {
  pub fn create_from() -> Self {
    let mut result = RegionPropertiesBuffer(Vec::new());
    
    result.push_header(PacketType::RegionProperties);
    
    result.push_u16(1); // Horizontal subregions
    result.push_u16(1); // Vertical subregions
    result.push_u8(WIDTH as u8); // Width
    result.push_u8(HEIGHT as u8); // Height
    
    return result;
  }
}

impl PacketBuffer for RegionPropertiesBuffer {
  fn get_mut_0(&mut self) -> &mut Vec<u8> {
    &mut self.0
  }
}

pub struct CellCacheBuffer(Vec<u8>);

impl CellCacheBuffer {
  pub fn create_from(map: &[[particles::Cell; HEIGHT]; WIDTH]) -> Self {
    let mut result = CellCacheBuffer(Vec::new());
    
    result.push_header(PacketType::CellCache);
    
    result.push_u16(0); // sx
    result.push_u16(0); // sy
    result.push_u8(WIDTH as u8); // Width
    result.push_u8(HEIGHT as u8); // Height
    
    for i in 0..WIDTH {
      for j in 0..HEIGHT {
        result.add_cell(&map[i][j]);
      }
    }
    
    return result;
  }
}

impl PacketBuffer for CellCacheBuffer {
  fn get_mut_0(&mut self) -> &mut Vec<u8> {
    &mut self.0
  }
}

impl CellBuffer for CellCacheBuffer {}

pub struct AgentCacheBuffer(Vec<u8>);

impl AgentCacheBuffer {
  pub fn create_from(cache: &Vec<particles::Agent>) -> Self {
    let mut result = AgentCacheBuffer(Vec::new());
    
    result.push_header(PacketType::AgentCache);
    
    result.push_u16(0); // sx
    result.push_u16(0); // sy
    result.push_u16(2); // Agent count
    
    for agent in cache {
      result.add_agent(agent);
    }
    
    return result;
  }
  
  fn add_agent(&mut self, agent: &particles::Agent) {
    self.push_u32(agent.species.type_id);
    self.push_u32(agent.agent_id);
  }
}

impl PacketBuffer for AgentCacheBuffer {
  fn get_mut_0(&mut self) -> &mut Vec<u8> {
    &mut self.0
  }
}

pub struct CellUpdateBuffer(pub Vec<u8>);

impl CellUpdateBuffer {
  pub fn create_from() -> Self {
    let mut result = CellUpdateBuffer(Vec::new());
    
    result.push_header(PacketType::CellUpdate);
    
    result.push_u16(0); // sx
    result.push_u16(0); // sy
    result.push_u16(0); // Cell count - (probably) unused now
    
    return result;
  }
}

impl PacketBuffer for CellUpdateBuffer {
  fn get_mut_0(&mut self) -> &mut Vec<u8> {
    &mut self.0
  }
}

impl CellBuffer for CellUpdateBuffer {}

pub trait CellBuffer: PacketBuffer {
  fn add_cell(&mut self, cell: &particles::Cell) {
    self.push_i16(cell.x);
    self.push_i16(cell.y);
    self.push_u32(cell.terrain.type_id);
    self.push_u8(cell.has_agent as u8);
    self.push_u32(cell.agent_id);
  }
}
