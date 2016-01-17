extern crate rand;
extern crate byteorder;

use std::thread::sleep_ms;
use rand::Rng;
use byteorder::{ByteOrder, LittleEndian, BigEndian, ReadBytesExt, WriteBytesExt};

use std::io::Read;
use std::io::Write;

mod particles;
use particles::{Agent, Terrain, Cell};

const WIDTH: usize = 16;
const HEIGHT: usize = 16;

// Packet types
const REGION_PROPERTIES: u8 = 1;
const CELL_CACHE: u8 = 2;
const AGENT_CACHE: u8 = 3;
const CELL_UPDATE: u8 = 4;
const AGENT_UPDATE: u8 = 5;
const AGENT_ACTION: u8 = 6;

// Agent actions
const WALK: u8 = 1;
const TERRAFORM: u8 = 2;

#[derive(Copy, Clone)]
struct AgentActionPacket {
  agent_id: u32,
  action: u8,
  direction: u8,
  arg1: u8,
}

impl AgentActionPacket {
  fn new() -> AgentActionPacket {
    AgentActionPacket {
      agent_id: 0,
      action: 0,
      direction: 0,
      arg1: 0,
    }
  }
  
  fn from_buffer(&mut self, buffer: &[u8]) -> () {
    self.agent_id = LittleEndian::read_u32(&buffer[11..15]);
    self.action = buffer[15];
    self.direction = buffer[16];
    self.arg1 = buffer[17];
  }
}

fn main () {
  let mut map = [[Cell { x: 0, y: 0, terrain: particles::GRASS, has_agent: false, agent_id: 0 }; HEIGHT]; WIDTH];
  
  for i in 0..WIDTH {
    for j in 0..HEIGHT {
      map[i][j] = Cell { x: i as i16, y: j as i16, terrain: particles::GRASS, has_agent: false, agent_id: 0 };
    }
  }
  
  let mut some_agents: Vec<Agent> = Vec::new();
  
  some_agents.push(Agent { species: particles::GREMLIN, x: 0, y: 0, agent_id: 0, action: 0, direction: 0, arg1: 0 });
  some_agents.push(Agent { species: particles::AVATAR, x: 0, y: 0, agent_id: 1, action: 0, direction: 0, arg1: 0 });
  
  // Spawn the first agent
  
  map[4][4].has_agent = true;
  map[4][4].agent_id = 0;
  some_agents[0].x = 4;
  some_agents[0].y = 4;
  
  // Spawn the second agent
  
  map[2][2].has_agent = true;
  map[2][2].agent_id = 1;
  some_agents[1].x = 2;
  some_agents[1].y = 2;
  
  let mut rng = rand::thread_rng();
  
  // Node's built-in IPC channels
  let mut out_stream = std::io::stdout();
  let (tx, rx) = std::sync::mpsc::channel();
  
  std::thread::spawn(move || {
    let mut in_stream = std::io::stdin();
    let mut bytes: [u8; 18] = [0; 18];
    let mut packet = AgentActionPacket::new();
    
    loop {
      in_stream.read(&mut bytes).unwrap();
      packet.from_buffer(&bytes);
      tx.send(packet).unwrap();
    }
    
    /*for byte in in_stream.bytes() {
      tx.send(byte.unwrap()).unwrap();
    }*/
  });
  
  // Notify relay server for:
  
  // region-properties
  out_stream.write(&packetize_region_properties()).unwrap();
  out_stream.flush().unwrap();
  
  // agent-cache
  out_stream.write(&packetize_agent_cache(&some_agents)).unwrap();
  out_stream.flush().unwrap();
  
  // cell-cache
  out_stream.write(&packetize_cell_cache(&map)).unwrap();
  out_stream.flush().unwrap();
  
  let mut recv_result: Result<AgentActionPacket, std::sync::mpsc::TryRecvError>;
  
  // Main sim loop
  loop {
    // AI phase
    some_agents[0].action = WALK;
    some_agents[0].direction = rng.gen_range(0, 9);
    some_agents[0].arg1 = 0;
    
    // Respond-to-requests phase
    loop {
      recv_result = rx.try_recv();
      
      match recv_result {
        Ok(packet) => {
          some_agents[1].action = packet.action;
          some_agents[1].direction = packet.direction;
          some_agents[1].arg1 = packet.arg1;
        },
        _ => { break; }
      }
    }
    
    let mut update_packet = packetize_cell_update();
    
    // Movement phase
    for i in 0..some_agents.len() {
      if some_agents[i].action == 0 {
        // Agent is not attempting an action
        continue;
      }
      
      if some_agents[i].direction > 8 {
        // Invalid direction
        continue;
      }
      
      let move_x: [i16; 9] = [0, 1, 1, 1, 0, -1, -1, -1, 0];
      let move_y: [i16; 9] = [0, -1, 0, 1, 1, 1, 0, -1, -1];
      
      let target_x: i16 = some_agents[i].x + move_x[(some_agents[i].direction) as usize];
      let target_y: i16 = some_agents[i].y + move_y[(some_agents[i].direction) as usize];
      
      if target_x < 0 || WIDTH as i16 <= target_x || target_y < 0 || HEIGHT as i16 <= target_y {
        // Target Cell is outside the Region's bounds
        continue;
      }
      
      match some_agents[i].action {
        WALK => {
          if some_agents[i].direction == 0 {
            // Agent is not attempting to move
            continue;
          }
          
          // Separate scopes for target_cell and source_cell, to keep rustc happy
          {
            let target_cell = &mut map[target_x as usize][target_y as usize];
            
            if target_cell.terrain.pauli || target_cell.has_agent && some_agents[target_cell.agent_id as usize].species.pauli {
              // Target cell is pauli
              continue;
            }
            
            // Now we can move
            
            // Update target_cell and queue notification
            target_cell.has_agent = true;
            target_cell.agent_id = some_agents[i].agent_id;
            target_cell.serialize(&mut update_packet);
          }
          
          {
            // Update source_cell before agent coords (so source_cell can be found from old coords)
            let source_cell = &mut map[some_agents[i].x as usize][some_agents[i].y as usize];
            source_cell.has_agent = false;
            source_cell.serialize(&mut update_packet);
          }
          
          // Update agent
          some_agents[i].x = target_x;
          some_agents[i].y = target_y;
        },
        TERRAFORM => {
          let target_cell = &mut map[target_x as usize][target_y as usize];
          
          let new_terrain = match particles::Terrain::deserialize(some_agents[i].arg1 as u32) {
            None => continue, // New Terrain type not recognized
            Some(val) => val
          };
          
          if target_cell.has_agent && new_terrain.pauli {
            // Can't make cell pauli while it is occupied
            continue;
          }
          
          // Now change Cell and queue update
          target_cell.terrain = new_terrain;
          target_cell.serialize(&mut update_packet);
        },
        _ => {}
      }
    }
    
    // Reset Agent intentions
    for i in 0..some_agents.len() {
      some_agents[i].action = 0;
    }
    
    // Send notifications
    set_packet_size(&mut update_packet);
    out_stream.write(&update_packet).unwrap();
    out_stream.flush().unwrap();
    
    sleep_ms(1000);
  }
}

fn make_base_packet(packet_type: u8) -> Vec<u8> {
  let mut packet: Vec<u8> = Vec::new();
  
  packet.write_u32::<BigEndian>(0xC0BA1701).unwrap(); // Protocol
  packet.push(packet_type);
  packet.write_u16::<LittleEndian>(11).unwrap(); // Size (bytes)
  packet.write_u32::<LittleEndian>(0).unwrap(); // Region ID
  
  return packet;
}

fn set_packet_size(packet: &mut Vec<u8>) {
  let size = packet.len();
  
  if size > 0x10000 {
    panic!("CELL_CACHE packet is too large! Must be smaller than 2^16");
  }
  
  packet[5] = (size & 0xFF) as u8;
  packet[6] = (size / 0x100) as u8;
}

fn packetize_region_properties() -> Vec<u8> {
  let mut packet = make_base_packet(REGION_PROPERTIES);
  
  packet.write_u16::<LittleEndian>(1).unwrap(); // Horizontal subregions
  packet.write_u16::<LittleEndian>(1).unwrap(); // Vertical subregions
  packet.push(WIDTH as u8); // Width
  packet.push(HEIGHT as u8); // Height
  
  set_packet_size(&mut packet);
  
  return packet;
}

fn packetize_cell_cache(map: &[[Cell; HEIGHT]; WIDTH]) -> Vec<u8> {
  let mut packet = make_base_packet(CELL_CACHE);
  
  packet.write_u16::<LittleEndian>(0).unwrap(); // sx
  packet.write_u16::<LittleEndian>(0).unwrap(); // sy
  packet.push(WIDTH as u8); // Width
  packet.push(HEIGHT as u8); // Height
  
  for i in 0..WIDTH {
    for j in 0..HEIGHT {
      map[i][j].serialize(&mut packet);
    }
  }
  
  set_packet_size(&mut packet);
  
  return packet;
}

fn packetize_agent_cache(cache: &Vec<Agent>) -> Vec<u8> {
  let mut packet = make_base_packet(AGENT_CACHE);
  
  packet.write_u16::<LittleEndian>(0).unwrap(); // sx
  packet.write_u16::<LittleEndian>(0).unwrap(); // sy
  packet.write_u16::<LittleEndian>(2).unwrap(); // Agent count
  
  for i in 0..cache.len() {
    cache[i].serialize(&mut packet);
  }
  
  set_packet_size(&mut packet);
  
  return packet;
}

fn packetize_cell_update() -> Vec<u8> {
  let mut packet = make_base_packet(CELL_UPDATE);
  
  packet.write_u16::<LittleEndian>(0).unwrap(); // sx
  packet.write_u16::<LittleEndian>(0).unwrap(); // sy
  packet.write_u16::<LittleEndian>(0).unwrap(); // Cell count - (probably) unused now
  
  set_packet_size(&mut packet);
  
  return packet;
}

