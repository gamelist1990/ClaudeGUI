#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::thread;
use std::fs::OpenOptions;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use once_cell::sync::Lazy;
use tracing::{debug, error, info};
mod process;
use crate::process::launcher;
use crate::process::registry;

// Simple global storage for the spawned claude process.
static CLAUDE_CHILD: Lazy<Mutex<Option<Arc<Mutex<Child>>>>> = Lazy::new(|| Mutex::new(None));

// Output buffers
static CLAUDE_STDOUT: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));
static CLAUDE_STDERR: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));
// If true, the process was started in a visible/detached console and
// GUI-driven stdin is not available.
static CLAUDE_VISIBLE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

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
    visible: Option<bool>,
) -> Result<String, String> {
    let mut guard = CLAUDE_CHILD.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        error!("attempt to start claude while one is already running");
        return Err("claude already running".into());
    }

    // Clone refs for envs and working_dir so we don't move the original
    // Option values. We'll pass these into the launcher which applies envs
    // and cwd. Prepare args vector.
    let envs_clone = envs.as_ref().map(|m| m.clone());
    let working_dir_clone = working_dir.clone();
    let args_vec = args.unwrap_or_default();

    // Decide program to run. If an explicit executable is provided, use it.
    // Otherwise, on Windows prefer launching node with the bundled cli.js
    // path (as requested) when it exists; fall back to 'claude' otherwise.
    let prog: String;
    #[cfg(windows)]
    {
        if let Some(exe) = executable.clone() {
            debug!(%exe, "using provided executable to start claude");
            prog = exe;
        } else {
            // Prefer launching the 'claude' shim/wrapper itself so we can
            // track its behavior and follow any child processes it spawns.
            debug!("using default 'claude' executable from PATH (will track wrapper)");
            prog = "claude".to_string();
        }
    }
    #[cfg(not(windows))]
    {
        if let Some(exe) = executable.clone() {
            debug!(%exe, "using provided executable to start claude");
            prog = exe;
        } else {
            debug!("using default 'claude' executable from PATH");
            prog = "claude".to_string();
        }
    }

    // If we're about to run "node" on Windows, prefer resolving the full
    // path to the node.exe binary via `where node` to avoid shim wrappers
    // (which in some environments result in child processes without piped
    // stdout/stderr). If resolution succeeds, use the absolute path as prog.
    #[cfg(windows)]
    {
        if prog == "node" {
            if let Ok(out) = Command::new("where").arg("node").output() {
                if out.status.success() {
                    if let Ok(s) = String::from_utf8(out.stdout) {
                        if let Some(first_line) = s.lines().next() {
                            let candidate = first_line.trim();
                            if !candidate.is_empty() {
                                debug!(node_path = %candidate, "resolved node.exe path via where");
                                // prefer the resolved path
                                // Note: overwrite prog so launcher will exec the absolute exe
                                // instead of relying on PATH resolution.
                                // We do not change args_vec (script remains first arg).
                                // Use owned String for prog below.
                                // (shadowing prog variable by creating a new one)
                                let prog = candidate.to_string();
                                let vis = visible.unwrap_or(false);
                                let mut child = match launcher::spawn_process(
                                    &prog,
                                    &args_vec,
                                    envs_clone.as_ref(),
                                    working_dir_clone.as_deref(),
                                    vis,
                                ) {
                                    Ok(c) => {
                                        c
                                    },
                                    Err(e) => {
                                        error!(%e, "failed to spawn claude (launcher)");
                                        return Err(format!("failed to spawn claude: {}", e));
                                    }
                                };
                                // continue with child handling below (duplicate of later code)
                                // Take stdout/stderr and spawn threads to capture lines into buffers.
                                let stdout = child.stdout.take();
                                let stderr = child.stderr.take();

                                // Prepare a combined log file for visible tailing (best-effort).
                                let log_path: Option<PathBuf> = {
                                    let dir = if let Some(d) = working_dir_clone.as_ref() {
                                        PathBuf::from(d)
                                    } else {
                                        std::env::temp_dir()
                                    };
                                    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
                                    Some(dir.join(format!("claude-gui-{}.log", stamp)))
                                };

                                let log_arc = if let Some(p) = &log_path {
                                    match OpenOptions::new().create(true).append(true).open(p) {
                                        Ok(f) => Some(Arc::new(Mutex::new(f))),
                                        Err(e) => {
                                            error!(%e, "failed to create log file, continuing without tail");
                                            None
                                        }
                                    }
                                } else {
                                    None
                                };

                                // After spawning, log details about the returned Child so we can trace
                                // which process was actually started and whether pipes are available.
                                let child_id = child.id();
                                let stdin_present = child.stdin.is_some();
                                let stdout_present = child.stdout.is_some();
                                let stderr_present = child.stderr.is_some();
                                debug!(pid = child_id, stdin = %stdin_present, stdout = %stdout_present, stderr = %stderr_present, "spawned child details");

                                // Diagnostic: if stdout/stderr are missing on Windows, try to
                                // enumerate direct child processes (the real worker might be
                                // a different PID). This helps determine whether node
                                // immediately spawns a detached worker.
                                #[cfg(windows)]
                                if !stdout_present || !stderr_present {
                                    use std::process::Command as SysCmd;
                                    let where_clause = format!("(ParentProcessId={})", child_id);
                                    let wmic_res = SysCmd::new("wmic")
                                        .arg("process")
                                        .arg("where")
                                        .arg(&where_clause)
                                        .arg("get")
                                        .arg("ProcessId,CommandLine")
                                        .output();
                                    match wmic_res {
                                        Ok(out) => {
                                            let s = String::from_utf8_lossy(&out.stdout);
                                            debug!(wmic = %s, "wmic child processes for spawned pid");
                                        }
                                        Err(e) => {
                                            debug!(%e, "failed to run wmic for diagnostics");
                                        }
                                    }
                                }

                                // Record visible based on stdin presence (if no stdin, consider it detached)
                                {
                                    let mut v = CLAUDE_VISIBLE.lock().map_err(|e| e.to_string())?;
                                    *v = !stdin_present;
                                }

                                let child_arc = Arc::new(Mutex::new(child));
                                *guard = Some(child_arc.clone());

                                if let Some(out) = stdout {
                                    let log_clone = log_arc.clone();
                                    thread::spawn(move || {
                                        let reader = BufReader::new(out);
                                        for line in reader.lines() {
                                            match line {
                                                Ok(l) => {
                                                    let _ = CLAUDE_STDOUT.lock().map(|mut v| v.push(l.clone()));
                                                    info!(message = %l, "claude stdout");
                                                    println!("[CLAUDE OUT] {}", l);
                                                    if let Some(arc) = &log_clone {
                                                        if let Ok(mut f) = arc.lock() {
                                                            let _ = writeln!(f, "[OUT] {}", l);
                                                        }
                                                    }
                                                }
                                                Err(_) => break,
                                            }
                                        }
                                    });
                                }

                                if let Some(err) = stderr {
                                    let log_clone = log_arc.clone();
                                    thread::spawn(move || {
                                        let reader = BufReader::new(err);
                                        for line in reader.lines() {
                                            match line {
                                                Ok(l) => {
                                                    let _ = CLAUDE_STDERR.lock().map(|mut v| v.push(l.clone()));
                                                    error!(stderr = %l, "claude stderr");
                                                    eprintln!("[CLAUDE ERR] {}", l);
                                                    if let Some(arc) = &log_clone {
                                                        if let Ok(mut f) = arc.lock() {
                                                            let _ = writeln!(f, "[ERR] {}", l);
                                                        }
                                                    }
                                                }
                                                Err(_) => break,
                                            }
                                        }
                                    });
                                }

                                if vis {
                                    if let Some(p) = &log_path {
                                        debug!(path = %p.display(), "visible requested: combined log file created (no external tail window)");
                                    } else {
                                        debug!("visible requested but no combined log file available");
                                    }
                                }

                                let pid = child_arc.lock().map_err(|e| e.to_string())?.id();
                                return Ok(format!("started pid {}", pid));
                            }
                        }
                    }
                }
            }
        }
    }

    let vis = visible.unwrap_or(false);
    let mut child = match launcher::spawn_process(
        &prog, 
        &args_vec,
        envs_clone.as_ref(),
        working_dir_clone.as_deref(),
        vis,
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

    // Prepare a combined log file for visible tailing (best-effort).
    let log_path: Option<PathBuf> = {
        // prefer working dir when available
        let dir = if let Some(d) = working_dir_clone.as_ref() {
            PathBuf::from(d)
        } else {
            std::env::temp_dir()
        };
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        Some(dir.join(format!("claude-gui-{}.log", stamp)))
    };

    let log_arc = if let Some(p) = &log_path {
        match OpenOptions::new().create(true).append(true).open(p) {
            Ok(f) => Some(Arc::new(Mutex::new(f))),
            Err(e) => {
                error!(%e, "failed to create log file, continuing without tail");
                None
            }
        }
    } else {
        None
    };

    // After spawning, log details about the returned Child so we can trace
    // which process was actually started and whether pipes are available.
    let child_id = child.id();
    let stdin_present = child.stdin.is_some();
    let stdout_present = child.stdout.is_some();
    let stderr_present = child.stderr.is_some();
    debug!(pid = child_id, stdin = %stdin_present, stdout = %stdout_present, stderr = %stderr_present, "spawned child details");

    // Record visible based on stdin presence (if no stdin, consider it detached)
    {
        let mut v = CLAUDE_VISIBLE.lock().map_err(|e| e.to_string())?;
        *v = !stdin_present;
    }

    let child_arc = Arc::new(Mutex::new(child));
    *guard = Some(child_arc.clone());

    // Attempt to discover real worker PID (if wrapper spawned one) and register it
    #[cfg(windows)]
    {
        let wrapper_pid = child_id;
    if let Some(worker_pid) = launcher::discover_worker_after_spawn(wrapper_pid) {
            let session_id = format!("claude-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis());
            match registry::PROCESS_REGISTRY.lock().map_err(|e| e.to_string())?.register_claude_session(session_id.clone(), worker_pid) {
                Ok(run_id) => {
                    debug!(run_id = run_id, pid = worker_pid, "registered discovered worker in registry");
                }
                Err(e) => {
                    error!(%e, "failed to register discovered worker");
                }
            }
        }
    }

    if let Some(out) = stdout {
        let log_clone = log_arc.clone();
        thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines() {
                match line {
                            Ok(l) => {
                                // push to buffer
                                let _ = CLAUDE_STDOUT.lock().map(|mut v| v.push(l.clone()));
                                // Log at info level so normal env logging shows stdout lines
                                info!(message = %l, "claude stdout");
                                // Also print to the process console directly so logs are
                                // visible even if tracing subscriber/env settings are
                                // not propagating to the current terminal.
                                println!("[CLAUDE OUT] {}", l);
                                // append to combined log file if available
                                if let Some(arc) = &log_clone {
                                    if let Ok(mut f) = arc.lock() {
                                        let _ = writeln!(f, "[OUT] {}", l);
                                    }
                                }
                            }
                    Err(_) => break,
                }
            }
        });
    }

    if let Some(err) = stderr {
        let log_clone = log_arc.clone();
        thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        let _ = CLAUDE_STDERR.lock().map(|mut v| v.push(l.clone()));
                        error!(stderr = %l, "claude stderr");
                        eprintln!("[CLAUDE ERR] {}", l);
                        if let Some(arc) = &log_clone {
                            if let Ok(mut f) = arc.lock() {
                                let _ = writeln!(f, "[ERR] {}", l);
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // If visible was requested, we no longer spawn an external tail window.
    // Instead, keep writing lines into the internal buffers and the combined
    // log file (if available) and rely on the application's logger (tracing)
    // to surface lines. This avoids creating detached consoles while preserving
    // the ability to inspect logs via tracing or the log file.
    if vis {
        if let Some(p) = &log_path {
            debug!(path = %p.display(), "visible requested: combined log file created (no external tail window)");
        } else {
            debug!("visible requested but no combined log file available");
        }
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
    // If process was started in visible mode, stdin won't be connected to the
    // underlying claude process (it was detached or launched in a separate
    // console). Provide a clearer error.
    let visible_flag = CLAUDE_VISIBLE.lock().map(|v| *v).unwrap_or(false);
    if visible_flag {
        return Err("cannot send input: claude started in visible/detached mode (GUI stdin unavailable); restart with visible=false".into());
    }

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
    // Initialize tracing subscriber. If RUST_LOG is not set, default to info so
    // that child stdout (logged at info) will be visible.
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    let _ = tracing_subscriber::fmt()
        .with_env_filter(env_filter)
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
