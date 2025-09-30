#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use once_cell::sync::Lazy;
use tracing::{debug, error};
mod process_launcher;

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
fn start_claude(
    args: Option<Vec<String>>,
    envs: Option<HashMap<String, String>>,
    working_dir: Option<String>,
    executable: Option<String>,
) -> Result<String, String> {
    let mut guard = CLAUDE_CHILD.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        error!("attempt to start claude while one is already running");
        return Err("claude already running".into());
    }

        // Use provided executable path if supplied, otherwise default to "claude"
        let mut cmd = if let Some(exe) = executable.clone() {
            debug!(%exe, "using provided executable to start claude");
            Command::new(exe)
        } else {
            debug!("using default 'claude' executable from PATH");
            Command::new("claude")
        };
    let args_vec = args.unwrap_or_default();
    if !args_vec.is_empty() {
        cmd.args(&args_vec);
    }
    // Note: do NOT forcefully add --dangerously-skip-permissions here.
    // The frontend can opt-in by passing that arg when starting a session.

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Clone refs for envs and working_dir so we don't move the original
    // Option values. We'll apply environment variables and working dir
    // from these clones and also reuse them for shell fallback if needed.
    let envs_clone = envs.as_ref().map(|m| m.clone());
    if let Some(envmap) = envs_clone.as_ref() {
        for (k, v) in envmap {
            cmd.env(k, v);
        }
    }

    let working_dir_clone = working_dir.clone();
    if let Some(dir) = working_dir_clone.as_ref() {
        debug!(%dir, "setting working directory for claude");
        cmd.current_dir(dir);
    }

    // Prepare clones of args to avoid ownership issues when attempting
    // fallbacks below.
    let args_vec = args_vec.clone();

    // Use the process_launcher module to spawn the process (handles shell fallback)
    let prog = executable.clone().unwrap_or_else(|| "claude".to_string());
    let mut child = match process_launcher::spawn_process(
        &prog,
        &args_vec,
        envs_clone.as_ref(),
        working_dir_clone.as_deref(),
    ) {
        Ok(c) => c,
        Err(e) => {
            error!(%e, "failed to spawn claude (launcher)");
            return Err(format!("failed to spawn claude: {}", e));
        }
    };

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
                        // push to buffer
                        let _ = CLAUDE_STDOUT.lock().map(|mut v| v.push(l.clone()));
                        debug!(stdout = %l, "claude stdout");
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
                        let _ = CLAUDE_STDERR.lock().map(|mut v| v.push(l.clone()));
                        error!(stderr = %l, "claude stderr");
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Return pid if available
    let pid = child_arc.lock().map_err(|e| e.to_string())?.id();

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
            stdin.write_all(b"\n").map_err(|e| e.to_string())?;
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
    // Initialize tracing subscriber for debug logs
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_target(false)
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
