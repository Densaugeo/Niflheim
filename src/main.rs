extern crate rand;
extern crate zmq;
extern crate byteorder;

use std::thread::sleep_ms;
use rand::Rng;
use byteorder::{ByteOrder, LittleEndian, BigEndian, ReadBytesExt, WriteBytesExt};

const WIDTH: usize = 32;
const HEIGHT: usize = 32;

// Packet types
const REGION_PROPERTIES: u8 = 1;
const CELL_CACHE: u8 = 2;
const AGENT_CACHE: u8 = 3;
const CELL_UPDATE: u8 = 4;
const AGENT_UPDATE: u8 = 5;
const AGENT_ACTION: u8 = 6;

// Agent actions
const WALK: u8 = 1;
const TERRAIN: u8 = 2;

struct Species {
  type_id: u32,
  pauli: bool,
}

#[derive(Copy, Clone)]
struct Agent {
  species: &'static Species,
  x: i16,
  y: i16,
  agent_id: u32,
  action: u8,
  direction: u8,
}

impl Agent {
  fn append_message_to_vector(&self, vector: &mut Vec<u8>) {
    vector.write_u32::<LittleEndian>(self.species.type_id).unwrap();
    vector.write_u32::<LittleEndian>(self.agent_id).unwrap();
  }
}

struct AgentActionPacket {
  agent_id: u32,
  action: u8,
  direction: u8,
}

impl AgentActionPacket {
  fn new() -> AgentActionPacket {
    AgentActionPacket {
      agent_id: 0,
      action: 0,
      direction: 0,
    }
  }
  
  fn from_buffer(&mut self, buffer: &[u8]) -> () {
    self.agent_id = LittleEndian::read_u32(&buffer[9..13]);
    self.action = buffer[13];
    self.direction = buffer[14];
  }
}

struct Terrain {
  type_id: u32,
  pauli: bool,
}

#[derive(Copy, Clone)]
struct Cell {
  x: i16,
  y: i16,
  terrain: &'static Terrain,
  has_agent: bool,
  agent_id: u32,
}

impl Cell {
  fn append_message_to_vector(&self, vector: &mut Vec<u8>) {
    vector.write_i16::<LittleEndian>(self.x).unwrap();
    vector.write_i16::<LittleEndian>(self.y).unwrap();
    vector.write_u32::<LittleEndian>(self.terrain.type_id).unwrap();
    vector.push(self.has_agent as u8);
    vector.write_u32::<LittleEndian>(self.agent_id).unwrap();
  }
}

static TERRAIN_LIBRARY: [Terrain; 2] = [
  Terrain { type_id: 0, pauli: false }, // Grass
  Terrain { type_id: 1, pauli: true  }, // Water
];

static SPECIES_LIBRARY: [Species; 2] = [
  Species { type_id: 0, pauli: true  }, // Germlin
  Species { type_id: 1, pauli: true  }, // Basic avatar
];

fn main () {
  let mut map = [[Cell { x: 0, y: 0, terrain: &TERRAIN_LIBRARY[0], has_agent: false, agent_id: 0 }; HEIGHT]; WIDTH];
  
  for i in 0..WIDTH {
    for j in 0..HEIGHT {
      map[i][j] = Cell { x: i as i16, y: j as i16, terrain: &TERRAIN_LIBRARY[0], has_agent: false, agent_id: 0 };
    }
  }
  
  let mut some_agents: Vec<Agent> = Vec::new();
  
  some_agents.push(Agent { species: &SPECIES_LIBRARY[0], x: 0, y: 0, agent_id: 0, action: 0, direction: 0 });
  some_agents.push(Agent { species: &SPECIES_LIBRARY[1], x: 0, y: 0, agent_id: 1, action: 0, direction: 0 });
  
  // Spawn the first agent
  
  map[4][4].has_agent = true;
  map[4][4].agent_id = 0;
  some_agents[0].x = 4;
  some_agents[0].y = 4;
  
  // Spawn the second agent
  
  map[8][8].has_agent = true;
  map[8][8].agent_id = 1;
  some_agents[1].x = 8;
  some_agents[1].y = 8;
  
  let mut rng = rand::thread_rng();
  
  // ZMQ sockets
  let mut ctx = zmq::Context::new();
  
  let mut cache_sender = ctx.socket(zmq::REP).unwrap();
  assert!(cache_sender.bind("tcp://127.0.0.1:3001").is_ok());
  
  let mut msg = zmq::Message::new().unwrap();
  
  let mut update_sender = ctx.socket(zmq::PUB).unwrap();
  assert!(update_sender.bind("tcp://127.0.0.1:3000").is_ok());
  
  // Main sim loop
  loop {
    // AI phase
    some_agents[0].action = WALK;
    some_agents[0].direction = rng.gen_range(0, 9);
    
    // Respond-to-requests phase
    cache_sender.recv(&mut msg, zmq::DONTWAIT); // .unwrap() panics on this line
    
    if msg.len() >= 5 {
      println!("Received request for packet type {})", msg[4]);
      
      match msg[4] {
        CELL_CACHE        => cache_sender.send(&packetize_cell_cache(&map), 0).unwrap(),
        AGENT_CACHE       => cache_sender.send(&packetize_agent_cache(&some_agents), 0).unwrap(),
        REGION_PROPERTIES => cache_sender.send(&packetize_region_properties(), 0).unwrap(),
        AGENT_ACTION => {
          let mut packet = AgentActionPacket::new();
          packet.from_buffer(&msg);
          
          // Assume all actions are for the avatar for now
          some_agents[1].action = packet.action;
          some_agents[1].direction = packet.direction;
          
          // Reset REP socket. Should probably change to another socket type
          cache_sender.send(&Vec::new(), 0).unwrap();
        }
        _ => println!("Packet type not recognized"),
      }
    }
    
    let mut update_packet = packetize_cell_update();
    
    // Movement phase
    for i in 0..some_agents.len() {
      if some_agents[i].direction == 0 || some_agents[i].action != WALK {
        // Agent is not attempting to move
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
        // Agent is attempting to move outside the Region's bounds
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
        target_cell.append_message_to_vector(&mut update_packet);
      }
      
      {
        // Update source_cell before agent coords (so source_cell can be found from old coords)
        let source_cell = &mut map[some_agents[i].x as usize][some_agents[i].y as usize];
        source_cell.has_agent = false;
        source_cell.append_message_to_vector(&mut update_packet);
      }
      
      // Update agent
      some_agents[i].x = target_x;
      some_agents[i].y = target_y;
    }
    
    // Reset Agent intentions
    for i in 0..some_agents.len() {
      some_agents[i].action = 0;
    }
    
    // Notification phase
    update_sender.send(b"updates", zmq::SNDMORE).unwrap();
    update_sender.send(&update_packet, 0).unwrap();
    
    sleep_ms(1000);
  }
}

fn make_base_packet(packet_type: u8) -> Vec<u8> {
  let mut packet: Vec<u8> = Vec::new();
  
  packet.write_u32::<BigEndian>(0xC0BA1700).unwrap(); // Protocol
  packet.push(packet_type);
  packet.write_u32::<LittleEndian>(0).unwrap(); // Region ID
  
  return packet;
}

fn packetize_cell_update() -> Vec<u8> {
  let mut packet = make_base_packet(CELL_UPDATE);
  
  packet.write_i16::<LittleEndian>(0).unwrap(); // sx
  packet.write_i16::<LittleEndian>(0).unwrap(); // sy
  packet.write_u32::<LittleEndian>(0).unwrap(); // Cell count - (probably) unused now
  
  return packet;
}

fn packetize_cell_cache(map: &[[Cell; HEIGHT]; WIDTH]) -> Vec<u8> {
  let mut packet = make_base_packet(CELL_CACHE);
  
  packet.write_i16::<LittleEndian>(0).unwrap(); // sx
  packet.write_i16::<LittleEndian>(0).unwrap(); // sy
  packet.write_i16::<LittleEndian>(32).unwrap(); // Width
  packet.write_i16::<LittleEndian>(32).unwrap(); // Height
  
  for i in 0..WIDTH {
    for j in 0..HEIGHT {
      map[i][j].append_message_to_vector(&mut packet);
    }
  }
  
  return packet;
}

fn packetize_agent_cache(cache: &Vec<Agent>) -> Vec<u8> {
  let mut packet = make_base_packet(AGENT_CACHE);
  
  packet.write_i16::<LittleEndian>(0).unwrap(); // sx
  packet.write_i16::<LittleEndian>(0).unwrap(); // sy
  packet.write_u32::<LittleEndian>(2).unwrap(); // Agent count
  
  for i in 0..cache.len() {
    cache[i].append_message_to_vector(&mut packet);
  }
  
  return packet;
}

fn packetize_region_properties() -> Vec<u8> {
  let mut packet = make_base_packet(REGION_PROPERTIES);
  
  packet.write_i16::<LittleEndian>(WIDTH as i16).unwrap();
  packet.write_i16::<LittleEndian>(HEIGHT as i16).unwrap();
  packet.write_i16::<LittleEndian>(1).unwrap(); // Horizontal subregions
  packet.write_i16::<LittleEndian>(1).unwrap(); // Vertical subregions
  
  return packet;
}
