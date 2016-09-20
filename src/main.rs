#![feature(plugin, custom_derive)]
#![plugin(serde_macros)]

extern crate serde;
extern crate serde_json;
extern crate schedule_recv;
extern crate rand;

use rand::Rng;

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
struct ColorRGBA {
  r: u8,
  g: u8,
  b: u8,
  #[serde(default = "ColorRGBA::default_a")]
  #[serde(skip_serializing_if = "ColorRGBA::skip_a")]
  a: u8,
}

impl ColorRGBA {
  fn default_a() -> u8 { 255 }
  
  fn skip_a(value: &u8) -> bool { *value == 255 }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
struct Tile {
  x: u8,
  y: u8,
  h: u8,
  t: u16,
  #[serde(default = "Tile::default_w")]
  #[serde(skip_serializing_if = "Tile::skip_w")]
  w: f32,
}

impl Tile {
  fn default_w() -> f32 { 0.0 }
  
  fn skip_w(value: &f32) -> bool { *value == 0.0 }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Terrain {
  name: String,
  color: ColorRGBA,
}

#[derive(Serialize, Deserialize, Debug)]
struct Map {
  terrains: Vec<Terrain>,
  tiles: Vec<Tile>,
}

impl Map {
  fn new() -> Self {
    Map { terrains: Vec::new(), tiles: Vec::new() }
  }
}

struct MapCache {
  map: Map,
  tile_indices: Box<[[Option<u16>; 256]; 256]>,
}

impl MapCache {
  fn new() -> Self {
    MapCache { map: Map::new(), tile_indices: Box::new([[None; 256]; 256]) }
  }
  
  fn update_tile(&mut self, tile: Tile) -> () {
    match self.tile_indices[tile.x as usize][tile.y as usize] {
      Some(index) => {
        self.map.tiles[index as usize] = tile;
      },
      None => {
        self.tile_indices[tile.x as usize][tile.y as usize] = Some(self.map.tiles.len() as u16);
        self.map.tiles.push(tile);
      }
    }
  }
}

use std::io::prelude::*;

macro_rules! try_or_exit {
  ($expr:expr, $msg:expr) => (match $expr {
    Ok(val) => val,
    Err(err) => {
      println!("{}: {}", $msg, err);
      std::process::exit(1);
    }
  })
}

fn get_map() -> Map {
  let mut f = try_or_exit!(std::fs::File::open("map.json"), "Error opening map file");
  let mut s = String::new();
  try_or_exit!(f.read_to_string(&mut s), "Error reading map file");
  try_or_exit!(serde_json::from_str(s.as_str()), "Error parsing map file")
}

fn main() {
  let map = get_map();
  
  let terrains: Vec<Terrain> = map.terrains;
  let mut tiles: [[Option<Tile>; 256]; 256] = [[None; 256]; 256];
  
  for tile in map.tiles {
    if (tile.t as usize) < terrains.len() {
      tiles[tile.x as usize][tile.y as usize] = Some(tile);
    }
  }
  
  // Build validated map for I/O thread
  let mut map_cache = MapCache::new();
  map_cache.map.terrains = terrains.clone();
  
  for x in 0..256 {
    for y in 0..256 {
      match tiles[x][y] {
        Some(tile) => map_cache.update_tile(tile),
        None => {}
      }
    }
  }
  
  println!("A terrain: {:?}", terrains[0]);
  println!("A tile: {:?}", tiles[0][0]);
  
//   let serialized = serde_json::to_string(&map).unwrap();
//   println!("Pretty printed = {}", pretty_print(&serialized));
  
  let (tx, rx) = std::sync::mpsc::channel::<Tile>();
  
  try_or_exit!(std::thread::Builder::new().name("niflheim_io".into()).spawn(move || {
    let mut thread_socket: std::net::TcpStream;
    
    'main: loop {
      // Try to connect to server until it succeeds
      'connect: loop {
        // Keep update queue drained while looking for a connection, to prevent memory leaking during outages
        'drain: loop {
          match rx.try_recv() {
            Ok(tile) => map_cache.update_tile(tile),
            Err(_) => break 'drain
          }
        }
        
        match std::net::TcpStream::connect("127.0.0.1:3556") {
          Ok(val) => {
            thread_socket = val;
            break 'connect;
          },
          Err(err) => println!("Error connecting to relay: {}", err)
        }
        
        // This is just a reconnection timeout, so the timing doesn't have to be precise
        std::thread::sleep(std::time::Duration::from_millis(1000));
      }
      
      // After connecting, the existing cache needs to be sent
      let serialized = serde_json::to_string(&map_cache.map).unwrap();
      match thread_socket.write_all(serialized.as_bytes()) {
        Ok(_) => {},
        Err(err) => {
          println!("Error sending to relay: {}", err);
          // Actually getting this error would be very weird. Idk what to do here. The first send loop would probably error too anywy
        }
      }
      
      // Keep the server up to date with sim changes. The cache was already sent, so only updates need to be sent here
      'send: loop {
        let tile = rx.recv().unwrap();
        
        map_cache.update_tile(tile);
        
        let serialized = serde_json::to_string(&tile).unwrap();
        
        match thread_socket.write_all(serialized.as_bytes()) {
          Ok(_) => {},
          Err(err) => {
            println!("Error sending to relay: {}", err);
            break 'send;
          }
        }
      }
    }
  }), "Error creating io thread:");
  
  let tick = schedule_recv::periodic_ms(1000);
  let mut rng = rand::thread_rng();
  
  loop {
    // These two operations can be .unwrapped, because they generally do not fail
    tick.recv().unwrap();
    
    // Make some kind of change to state
    match tiles[2][2] {
      Some(ref mut tile) => {
        tile.h = rng.gen_range(2, 4);
        tile.t = rng.gen_range(0, 3);
      },
      None => {}
    }
    
    match tiles[0][2] {
      Some(ref mut tile) => {
        tile.w = 1.7 + 0.1*(rng.gen_range(0, 4) as f32);
      },
      None => {}
    }
    
    match tiles[1][2] {
      Some(ref mut tile) => {
        tile.w = 1.7 + 0.1*(rng.gen_range(0, 4) as f32);
      },
      None => {}
    }
    
    match tiles[1][1] {
      Some(ref mut tile) => {
        tile.w = 1.7 + 0.1*(rng.gen_range(0, 4) as f32);
      },
      None => {}
    }
    
    match tiles[2][1] {
      Some(ref mut tile) => {
        tile.w = 1.7 + 0.1*(rng.gen_range(0, 4) as f32);
      },
      None => {}
    }
    
    match tiles[3][1] {
      Some(ref mut tile) => {
        tile.w = 1.7 + 0.1*(rng.gen_range(0, 4) as f32);
      },
      None => {}
    }
    
    match tiles[4][1] {
      Some(ref mut tile) => {
        tile.w = 1.7 + 0.1*(rng.gen_range(0, 4) as f32);
      },
      None => {}
    }
    
    tx.send(tiles[2][2].unwrap());
    
    tx.send(tiles[0][2].unwrap());
    tx.send(tiles[1][2].unwrap());
    tx.send(tiles[1][1].unwrap());
    tx.send(tiles[2][1].unwrap());
    tx.send(tiles[3][1].unwrap());
    tx.send(tiles[4][1].unwrap());
  }
}
/*
fn pretty_print_newline(string: &mut String, indent: u8) -> () {
  string.push('\n');
  
  for _ in 0..indent {
    string.push(' ');
    string.push(' ');
  }
}

fn pretty_print(input: &String) -> String {
  let mut result = String::with_capacity(input.len() + input.len()/3);
  
  let mut indent_depth: u8 = 0;
  let mut in_string: bool = false;
  let mut array_depth: u8 = 0;
  let mut curly_brace_depth: u8 = 0;
  let mut previous: char = ' ';
  
  for c in input.chars() {
    if c == '"' {
      in_string = !in_string || previous == '\\';
    }
    
    if in_string {
      result.push(c);
      previous = c;
      continue;
    }
    
    match c {
      '[' => {
        result.push(c);
        
        array_depth += 1;
        indent_depth += 1;
        pretty_print_newline(&mut result, indent_depth);
      },
      ']' => {
        array_depth -= 1;
        indent_depth -= 1;
        pretty_print_newline(&mut result, indent_depth);
        
        result.push(c);
      },
      '{' => {
        result.push(c);
        
        if array_depth > 0 {
          curly_brace_depth += 1;
          result.push(' ');
        } else {
          indent_depth += 1;
          pretty_print_newline(&mut result, indent_depth);
        }
      }
      '}' => {
        if array_depth > 0 {
          curly_brace_depth -= 1;
          result.push(' ');
        } else {
          indent_depth -= 1;
          pretty_print_newline(&mut result, indent_depth);
        }
        
        result.push(c);
      }
      ',' => {
        result.push(c);
        
        if array_depth > 0 && curly_brace_depth == 0 {
          pretty_print_newline(&mut result, indent_depth);
        } else {
          result.push(' ');
        }
      },
      ':' => {
        result.push(c);
        result.push(' ');
      }
      _ => result.push(c)
    }
  }
  
  return result;
}
*/
