extern crate rand;

use std::thread::sleep_ms;
use rand::Rng;

use std::io::Read;
use std::io::Write;

mod particles;
use particles::{Agent, Terrain, Cell};

mod settings;

mod packets;
use packets::{PacketData, PacketBuffer, CellBuffer};

fn transmit <T: packets::PacketBuffer, S: std::io::Write> (stream: &mut S, packet: &mut T) {
  stream.write(packet.finalize()).unwrap();
  stream.flush().unwrap();
}

fn main () {
  let mut map: [[Cell; settings::WIDTH]; settings::HEIGHT];
  
  // Because apparently the only other way to initialize an array with non-copyable elements is with
  // Default::default(), which only supprts up to 32 elements because of a weird implementation possiblly
  // involving macros that can't count?
  // So, I resort to the dark arts
  unsafe {
    map = std::mem::uninitialized();
    
    // std::ptr:write is like assignment, but prevents destructors from running
    for i in 0..settings::WIDTH {
      for j in 0..settings::HEIGHT {
        std::ptr::write(&mut map[i][j], Cell { x: i as i16, y: j as i16, terrain: particles::GRASS, has_agent: false, agent_id: 0 });
      }
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
    
    loop {
      in_stream.read(&mut bytes).unwrap();
      
      let packet = packets::AgentActionPacket::deserialize(&bytes);
      tx.send(packet).unwrap();
    }
    
    /*for byte in in_stream.bytes() {
      tx.send(byte.unwrap()).unwrap();
    }*/
  });
  
  // Notify relay server for:
  
  // region-properties
  transmit(&mut out_stream, &mut packets::RegionPropertiesBuffer::create_from());
  
  // agent-cache
  transmit(&mut out_stream, &mut packets::AgentCacheBuffer::create_from(&some_agents));
  
  // cell-cache
  transmit(&mut out_stream, &mut packets::CellCacheBuffer::create_from(&map));
  
  let mut recv_result: Result<packets::AgentActionPacket, std::sync::mpsc::TryRecvError>;
  
  // Main sim loop
  loop {
    // AI phase
    {
      let agent = &mut some_agents[0];
      agent.action = packets::WALK;
      agent.direction = rng.gen_range(0, 9);
      agent.arg1 = 0;
    }
    
    // Respond-to-requests phase
    loop {
      recv_result = rx.try_recv();
      
      match recv_result {
        Ok(packet) => {
          let agent = &mut some_agents[1];
          agent.action = packet.action;
          agent.direction = packet.direction;
          agent.arg1 = packet.arg1;
        },
        _ => { break; }
      }
    }
    
    let mut update_packet = packets::CellUpdateBuffer::create_from();
    
    // Movement phase
    for agent in &mut some_agents {
      if agent.action == 0 {
        // Agent is not attempting an action
        continue;
      }
      
      if agent.direction > 8 {
        // Invalid direction
        continue;
      }
      
      let move_x: [i16; 9] = [0, 1, 1, 1, 0, -1, -1, -1, 0];
      let move_y: [i16; 9] = [0, -1, 0, 1, 1, 1, 0, -1, -1];
      
      let target_x: i16 = agent.x + move_x[(agent.direction) as usize];
      let target_y: i16 = agent.y + move_y[(agent.direction) as usize];
      
      if target_x < 0 || settings::WIDTH as i16 <= target_x || target_y < 0 || settings::HEIGHT as i16 <= target_y {
        // Target Cell is outside the Region's bounds
        continue;
      }
      
      match agent.action {
        packets::WALK => {
          if agent.direction == 0 {
            // Agent is not attempting to move
            continue;
          }
          
          // Separate scopes for target_cell and source_cell, to keep rustc happy
          {
            let target_cell = &mut map[target_x as usize][target_y as usize];
            
            // Temporarily assume all agents are pauli to make moving pointers to cell easier
            if target_cell.terrain.pauli || target_cell.has_agent /*&& some_agents[target_cell.agent_id as usize].species.pauli*/ {
              // Target cell is pauli
              continue;
            }
            
            // Now we can move
            
            // Update target_cell and queue notification
            target_cell.has_agent = true;
            target_cell.agent_id = agent.agent_id;
            update_packet.add_cell(target_cell);
          }
          
          {
            // Update source_cell before agent coords (so source_cell can be found from old coords)
            let source_cell = &mut map[agent.x as usize][agent.y as usize];
            source_cell.has_agent = false;
            update_packet.add_cell(source_cell);
          }
          
          // Update agent
          agent.x = target_x;
          agent.y = target_y;
        },
        packets::TERRAFORM => {
          let target_cell = &mut map[target_x as usize][target_y as usize];
          
          let new_terrain = match particles::Terrain::deserialize(agent.arg1 as u32) {
            None => continue, // New Terrain type not recognized
            Some(val) => val
          };
          
          if target_cell.has_agent && new_terrain.pauli {
            // Can't make cell pauli while it is occupied
            continue;
          }
          
          // Now change Cell and queue update
          target_cell.terrain = new_terrain;
          update_packet.add_cell(target_cell);
        },
        _ => {}
      }
    }
    
    // Reset Agent intentions
    for agent in &mut some_agents {
      agent.action = 0;
    }
    
    // Send notifications
    transmit(&mut out_stream, &mut update_packet);
    
    sleep_ms(1000);
  }
}
