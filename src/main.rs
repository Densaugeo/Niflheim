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
  
  
  println!("A terrain: {:?}", terrains[0]);
  println!("A tile: {:?}", tiles[0][0]);
  
//   let serialized = serde_json::to_string(&map).unwrap();
//   println!("Pretty printed = {}", pretty_print(&serialized));
  
  let (tx, rx) = std::sync::mpsc::channel::<Tile>();
  
  std::thread::spawn(move || {
    let mut thread_socket: std::net::TcpStream;
    
    loop {
      loop {
        // Keep update queue drained while looking for a connection, to prevent memory leaking during outages
        loop {
          match rx.try_recv() {
            Ok(_) => {},
            Err(_) => break
          }
        }
        
        match std::net::TcpStream::connect("127.0.0.1:3556") {
          Ok(val) => {
            thread_socket = val;
            break;
          },
          Err(err) => println!("Error connecting to relay: {}", err)
        }
        
        std::thread::sleep(std::time::Duration::from_millis(1000));
      }
      
      loop {
        let tile = rx.recv().unwrap();
        let serialized = serde_json::to_string(&tile).unwrap();
        
        match thread_socket.write_all(serialized.as_bytes()) {
          Ok(_) => {},
          Err(err) => {
            println!("Error sending to relay: {}", err);
            break;
          }
        }
      }
    }
  });
  
  let tick = schedule_recv::periodic_ms(1000);
  let mut rng = rand::thread_rng();
  
  loop {
    // These two operations can be .unwrapped, because they generally do not fail
    tick.recv().unwrap();
    
    // Make some kind of change to state
    match tiles[2][2] {
      Some(ref mut tile) => {
        tile.h = rng.gen_range(0, 3);
        tile.t = rng.gen_range(0, 3);
      },
      None => {}
    }
    
    tx.send(tiles[2][2].unwrap());
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
