extern crate rand;
extern crate zmq;

use std::thread::sleep_ms;
use rand::Rng;

fn main () {
  const WIDTH: usize = 32;
  const HEIGHT: usize = 32;
  const AGENT_MESSAGE_LENGTH: usize = 8;
  const CELL_MESSAGE_LENGTH: usize = 13;
  
  struct Terrain {
    type_id: u32,
    pauli: bool,
  }
  
  static TERRAIN_LIBRARY: [Terrain; 2] = [
    Terrain { type_id: 0, pauli: false }, // Grass
    Terrain { type_id: 1, pauli: true  }, // Water
  ];
  
  struct Species {
    type_id: u32,
    pauli: bool,
  }
  
  static SPECIES_LIBRARY: [Species; 2] = [
    Species { type_id: 0, pauli: true  }, // Germlin
    Species { type_id: 1, pauli: true  }, // Basic avatar
  ];
  
  #[derive(Copy, Clone)]
  struct Agent {
    species: &'static Species,
    x: i16,
    y: i16,
    walk: u8,
    agent_id: u32,
  }
  
  impl Agent {
    fn to_message(&self) -> [u8; AGENT_MESSAGE_LENGTH] {
      let mut message = [0u8; AGENT_MESSAGE_LENGTH];
      
      self.write_message_to_buffer(&mut message);
      
      return message;
    }
    
    fn write_message_to_buffer(&self, buffer: &mut [u8]) {
      buffer[0] = self.species.type_id as u8;
      buffer[1] = (self.species.type_id / 0x100) as u8;
      buffer[2] = (self.species.type_id / 0x10000) as u8;
      buffer[3] = (self.species.type_id / 0x1000000) as u8;
      buffer[4] = self.agent_id as u8;
      buffer[5] = (self.agent_id / 0x100) as u8;
      buffer[6] = (self.agent_id / 0x10000) as u8;
      buffer[7] = (self.agent_id / 0x1000000) as u8;
    }
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
    fn to_message(&self) -> [u8; CELL_MESSAGE_LENGTH] {
      let mut message = [0u8; CELL_MESSAGE_LENGTH];
      
      self.write_message_to_buffer(&mut message);
      
      return message;
    }
    
    fn write_message_to_buffer(&self, buffer: &mut [u8]) {
      buffer[0] = self.x as u8;
      buffer[1] = (self.x / 0x100) as u8;
      buffer[2] = self.y as u8;
      buffer[3] = (self.y / 0x100) as u8;
      buffer[4] = self.terrain.type_id as u8;
      buffer[5] = (self.terrain.type_id / 0x100) as u8;
      buffer[6] = (self.terrain.type_id / 0x10000) as u8;
      buffer[7] = (self.terrain.type_id / 0x1000000) as u8;
      buffer[8] = self.has_agent as u8;
      buffer[9] = self.agent_id as u8;
      buffer[10] = (self.agent_id / 0x100) as u8;
      buffer[11] = (self.agent_id / 0x10000) as u8;
      buffer[12] = (self.agent_id / 0x1000000) as u8;
    }
  }
  
  let mut map = [[Cell { x: 0, y: 0, terrain: &TERRAIN_LIBRARY[0], has_agent: false, agent_id: 0 }; HEIGHT]; WIDTH];
  
  for i in 0..WIDTH {
    for j in 0..HEIGHT {
      map[i][j] = Cell { x: i as i16, y: j as i16, terrain: &TERRAIN_LIBRARY[0], has_agent: false, agent_id: 0 };
    }
  }
  
  let mut some_agents: Vec<Agent> = Vec::new();
  
  some_agents.push(Agent { species: &SPECIES_LIBRARY[0], x: 0, y: 0, walk: 0, agent_id: 0 });
  some_agents.push(Agent { species: &SPECIES_LIBRARY[1], x: 0, y: 0, walk: 0, agent_id: 1 });
  
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
  
  let mut notification_queue: Vec<[u8; CELL_MESSAGE_LENGTH]> = Vec::new();
  
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
    for i in 0..some_agents.len() {
      some_agents[i].walk = rng.gen_range(0, 9);
    }
    
    // Movement phase
    for i in 0..some_agents.len() {
      if some_agents[i].walk == 0 {
        // Agent is not attempting to move
        continue;
      }
      
      let move_x: [i16; 9] = [0, 1, 1, 1, 0, -1, -1, -1, 0];
      let move_y: [i16; 9] = [0, -1, 0, 1, 1, 1, 0, -1, -1];
      
      let target_x: i16 = some_agents[i].x + move_x[(some_agents[i].walk) as usize];
      let target_y: i16 = some_agents[i].y + move_y[(some_agents[i].walk) as usize];
      
      if target_x < 0 || WIDTH as i16 <= target_x || target_y < 0 || HEIGHT as i16 <= target_y {
        // Agent is attempting to move outside the Region's bounds
        continue;
      }
      
      // Separate scopes for target_cell and source_cell, to keep rustc happy
      {
        let target_cell = &mut map[target_x as usize][target_y as usize];
        
        if target_cell.terrain.pauli || target_cell.has_agent && some_agents[target_cell.agent_id as usize].species.pauli {
          // Target cell is pauli
          println!("Target cell is pauli");
          continue;
        }
        
        // Now we can move
        
        // Update target_cell and queue notification
        target_cell.has_agent = true;
        target_cell.agent_id = some_agents[i].agent_id;
        notification_queue.push(target_cell.to_message());
      }
      
      {
        // Update source_cell before agent coords (so source_cell can be found from old coords)
        let source_cell = &mut map[some_agents[i].x as usize][some_agents[i].y as usize];
        source_cell.has_agent = false;
        notification_queue.push(source_cell.to_message());
      }
      
      // Update agent
      some_agents[i].x = target_x;
      some_agents[i].y = target_y;
    }
    
    // Notification phase
    {
      if(notification_queue.len() > 32) {
        panic!();
      }
      
      let mut message = [0u8; 32*CELL_MESSAGE_LENGTH + 17];
      
      message[0] = 0xC0; // Protocol
      message[1] = 0xBA;
      message[2] = 0x17;
      message[3] = 0x00; // Protocol version
      message[4] = 0x04; // Cell update packet
      message[5] = 0; // Region ID
      message[6] = 0;
      message[7] = 0;
      message[8] = 0;
      message[9] = 0; // sx
      message[10] = 0;
      message[11] = 0; // sy
      message[12] = 0;
      message[13] = notification_queue.len() as u8; // Cell count
      message[14] = 0;
      message[15] = 0;
      message[16] = 0;
      
      for i in 0..notification_queue.len() {
        for j in 0..CELL_MESSAGE_LENGTH {
          message[CELL_MESSAGE_LENGTH*i + j + 17] = notification_queue[i][j];
        }
      }
      
      update_sender.send(&message[0 .. notification_queue.len()*CELL_MESSAGE_LENGTH + 17], 0).unwrap();
      
      notification_queue.clear();
    }
    
    cache_sender.recv(&mut msg, zmq::DONTWAIT);
    
    if msg.len() == 6 {
      println!("A REQ of length 6 must be a 'region' REQ, sending region cache");
      
      let mut message = [0u8; WIDTH*HEIGHT*CELL_MESSAGE_LENGTH + 17];
      
      message[0] = 0xC0; // Protocol
      message[1] = 0xBA;
      message[2] = 0x17;
      message[3] = 0x00; // Protocol version
      message[4] = 0x02; // Cell cache packet
      message[5] = 0; // Region ID
      message[6] = 0;
      message[7] = 0;
      message[8] = 0;
      message[9] = 0; // sx
      message[10] = 0;
      message[11] = 0; // sy
      message[12] = 0;
      message[13] = 32; // Width
      message[14] = 0;
      message[15] = 32; // Height
      message[16] = 0;
      
      for i in 0..WIDTH {
        for j in 0..HEIGHT {
          let start_index = i*HEIGHT*CELL_MESSAGE_LENGTH + j*CELL_MESSAGE_LENGTH + 17;
          
          map[i][j].write_message_to_buffer(&mut message[start_index .. start_index + CELL_MESSAGE_LENGTH]);
        }
      }
      
      cache_sender.send(&message, 0).unwrap();
    }
    
    if msg.len() == 13 {
      println!("A REQ of length 13 must be a 'region-agents' REQ, sending agent cache");
      
      let mut message = [0u8; 2*AGENT_MESSAGE_LENGTH + 17];
      
      message[0] = 0xC0; // Protocol
      message[1] = 0xBA;
      message[2] = 0x17;
      message[3] = 0x00; // Protocol version
      message[4] = 0x03; // Agent cache packet
      message[5] = 0; // Region ID
      message[6] = 0;
      message[7] = 0;
      message[8] = 0;
      message[9] = 0; // sx
      message[10] = 0;
      message[11] = 0; // sy
      message[12] = 0;
      message[13] = 2; // Agent count
      message[14] = 0;
      message[15] = 0;
      message[16] = 0;
      
      some_agents[0].write_message_to_buffer(&mut message[17 .. 25]);
      some_agents[1].write_message_to_buffer(&mut message[25 .. 33]);
      
      cache_sender.send(&message, 0).unwrap();
    }
    
    if msg.len() == 17 {
      println!("A REQ of length 17 must be a 'region-properties' REQ, sending region properties");
      
      let mut message = [0u8; 17];
      
      message[0] = 0xC0;
      message[1] = 0xBA;
      message[2] = 0x17;
      message[3] = 0x00;
      message[4] = 1;
      message[5] = 0; // Region ID
      message[6] = 0;
      message[7] = 0;
      message[8] = 0;
      message[9] = WIDTH as u8;
      message[10] = (WIDTH / 0x100) as u8;
      message[11] = HEIGHT as u8;
      message[12] = (HEIGHT / 0x100) as u8;
      message[13] = 1; // Horizontal subregions
      message[14] = 0;
      message[15] = 1; // Vertical subregions
      message[16] = 0;
      
      cache_sender.send(&message, 0).unwrap();
    }
    
    sleep_ms(1000);
  }
}
