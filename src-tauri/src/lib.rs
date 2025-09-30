#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use once_cell::sync::Lazy;

// Simple global storage for the spawned claude process.
static CLAUDE_CHILD: Lazy<Mutex<Option<Arc<Mutex<Child>>>>> = Lazy::new(|| Mutex::new(None));

// Output buffers
static CLAUDE_STDOUT: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));
static CLAUDE_STDERR: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn start_claude(args: Option<Vec<String>>, envs: Option<HashMap<String, String>>) -> Result<String, String> {
    let mut guard = CLAUDE_CHILD.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("claude already running".into());
    }

    let mut cmd = Command::new("claude");
    let args_vec = args.unwrap_or_default();
    if !args_vec.is_empty() {
        cmd.args(&args_vec);
    }
    // Note: do NOT forcefully add --dangerously-skip-permissions here.
    // The frontend can opt-in by passing that arg when starting a session.

    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    if let Some(envmap) = envs {
        for (k, v) in envmap {
            cmd.env(k, v);
        }
    }

    let mut child = cmd.spawn().map_err(|e| format!("failed to spawn claude: {}", e))?;

    // Take stdout/stderr and spawn threads to capture lines into buffers.
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let child_arc = Arc::new(Mutex::new(child));
    *guard = Some(child_arc.clone());

    if let Some(out) = stdout {
        thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        let _ = CLAUDE_STDOUT.lock().map(|mut v| v.push(l));
                    }
                    Err(_) => break,
                }
            }
        });
    }

    if let Some(err) = stderr {
        thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        let _ = CLAUDE_STDERR.lock().map(|mut v| v.push(l));
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Return pid if available
    let pid = child_arc
        .lock()
        .map_err(|e| e.to_string())?
        .id();

    Ok(format!("started pid {}", pid))
}

#[tauri::command]
fn get_claude_output() -> (Vec<String>, Vec<String>) {
    let out = CLAUDE_STDOUT.lock().map(|v| v.clone()).unwrap_or_default();
    let err = CLAUDE_STDERR.lock().map(|v| v.clone()).unwrap_or_default();
    (out, err)
}

#[tauri::command]
fn clear_claude_output() {
    let _ = CLAUDE_STDOUT.lock().map(|mut v| v.clear());
    let _ = CLAUDE_STDERR.lock().map(|mut v| v.clear());
}

#[tauri::command]
fn send_input(text: String) -> Result<(), String> {
    let guard = CLAUDE_CHILD.lock().map_err(|e| e.to_string())?;
    if let Some(child_arc) = &*guard {
        let mut child = child_arc.lock().map_err(|e| e.to_string())?;
        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|e| e.to_string())?;
            stdin
                .write_all(b"\n")
                .map_err(|e| e.to_string())?;
            stdin.flush().map_err(|e| e.to_string())?;
            return Ok(());
        }
        Err("stdin not available".into())
    } else {
        Err("claude not running".into())
    }
}

#[tauri::command]
fn stop_claude() -> Result<String, String> {
    let mut guard = CLAUDE_CHILD.lock().map_err(|e| e.to_string())?;
    if let Some(child_arc) = guard.take() {
        // Try to take ownership of the Arc so we can access the Child
        match Arc::try_unwrap(child_arc) {
            Ok(mutex_child) => match mutex_child.into_inner() {
                Ok(mut child) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Ok("stopped".into());
                }
                Err(e) => return Err(format!("lock poisoned: {}", e)),
            },
            Err(_) => {
                return Err("failed to take ownership of process handle".into());
            }
        }
    }
    Err("claude not running".into())
}

#[tauri::command]
fn status() -> bool {
    CLAUDE_CHILD.lock().map(|g| g.is_some()).unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_claude,
            get_claude_output,
            clear_claude_output,
            send_input,
            stop_claude,
            status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
