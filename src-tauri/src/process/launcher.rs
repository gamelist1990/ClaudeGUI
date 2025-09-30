// ...existing code from src/process_launcher.rs moved here

use std::collections::HashMap;
use std::io::ErrorKind;
use std::process::{Child, Command, Stdio};
use tracing::debug;
use std::io;

#[cfg(windows)]
fn tokenize_commandline(cmd: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quote = false;
    let mut chars = cmd.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '"' {
            in_quote = !in_quote;
            continue;
        }
        if c.is_whitespace() && !in_quote {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
            continue;
        }
        current.push(c);
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

#[cfg(windows)]
fn try_spawn_candidate(exe_path: &str, args: &[String], envs: Option<&HashMap<String, String>>, working_dir: Option<&str>) -> io::Result<Child> {
    let mut cmd = Command::new(exe_path);
    if !args.is_empty() {
        cmd.args(args);
    }
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(envmap) = envs {
        for (k, v) in envmap {
            cmd.env(k, v);
        }
    }
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }
    cmd.spawn()
}

#[cfg(windows)]
fn gather_descendant_processes(root_pid: u32) -> io::Result<Vec<u32>> {
    use winapi::um::tlhelp32::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS};
    use winapi::shared::minwindef::DWORD;

    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == winapi::um::handleapi::INVALID_HANDLE_VALUE {
            return Err(io::Error::last_os_error());
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut descendants = Vec::new();
        if Process32FirstW(snap, &mut entry) != 0 {
            loop {
                let pid = entry.th32ProcessID as u32;
                let ppid = entry.th32ParentProcessID as u32;
                if ppid == root_pid {
                    descendants.push(pid);
                    // recurse to find deeper descendants
                    if let Ok(mut deeper) = gather_descendant_processes(pid) {
                        descendants.append(&mut deeper);
                    }
                }
                if Process32NextW(snap, &mut entry) == 0 {
                    break;
                }
            }
        }
        Ok(descendants)
    }
}

/// Minimal process launcher: try direct spawn with piped stdio, otherwise
/// fall back to shell invocation. Keep this file simple; higher-level path
/// resolution is handled by the caller (lib.rs) per user request.
pub fn spawn_process(
    executable: &str,
    args: &[String],
    envs: Option<&HashMap<String, String>>,
    working_dir: Option<&str>,
    _visible: bool,
) -> std::io::Result<Child> {
    debug!(executable = %executable, args = ?args, "spawning process (simple launcher)");
    #[cfg(windows)]
    // On Windows try to resolve wrapper scripts (eg. .cmd/.bat) to the
    // underlying executable when possible. This increases the chance of
    // getting pipes connected to the real worker process instead of a
    // shell shim which may spawn a detached process.
    let resolved_executable: String = {
        use std::path::Path;
        use std::fs;
        // Attempt `where` to find the path that would be executed by the
        // shell. If it's an exe we can use it directly. If it's a .cmd/.bat
        // try to read it and heuristically extract the real target.
        let mut cand = executable.to_string();
        if let Ok(out) = Command::new("where").arg(executable).output() {
            if out.status.success() {
                if let Ok(s) = String::from_utf8(out.stdout) {
                    if let Some(line) = s.lines().next() {
                        let p = line.trim();
                        if !p.is_empty() {
                            cand = p.to_string();
                        }
                    }
                }
            }
        }

        let path = Path::new(&cand);
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_l = ext.to_ascii_lowercase();
            if ext_l == "cmd" || ext_l == "bat" {
                // Read the script and try to find an .exe or a 'node' invocation.
                if let Ok(text) = fs::read_to_string(&path) {
                    for line in text.lines() {
                        let l = line.trim().trim_matches('\r').trim();
                        // skip comments and empty
                        if l.is_empty() || l.starts_with("rem ") || l.starts_with(":") {
                            continue;
                        }
                        let lower = l.to_ascii_lowercase();
                        // Heuristic: if line contains 'node ' return 'node'
                        if lower.contains(" node ") || lower.starts_with("node ") || lower.contains("\tnode ") {
                            // delegate to node resolution later
                            cand = "node".to_string();
                            break;
                        }
                        // Look for .exe mention and extract surrounding token
                        if let Some(idx) = lower.find(".exe") {
                            // expand left to token start
                            let bytes = l.as_bytes();
                            let mut start = idx;
                            while start > 0 {
                                let c = bytes[start - 1] as char;
                                if c == '"' || c == '\'' || c.is_whitespace() { break; }
                                start -= 1;
                            }
                            let mut end = idx + 4; // past .exe
                            while end < bytes.len() {
                                let c = bytes[end] as char;
                                if c == '"' || c == '\'' || c.is_whitespace() { break; }
                                end += 1;
                            }
                            let token = &l[start..end];
                            // Replace %~dp0 with script dir if present
                            let token = token.replace("%~dp0", &format!("{}\\", path.parent().map(|p| p.display().to_string()).unwrap_or_default()));
                            // Strip quotes
                            let token = token.trim_matches('"').trim_matches('\'');
                            if !token.is_empty() {
                                cand = token.to_string();
                                break;
                            }
                        }
                    }
                }
            }
        }
        cand
    };

    #[cfg(windows)]
    // If the resolved path is an extensionless shim, try common extension
    // candidates next to it (.cmd, .bat, .exe). This handles cases where
    // `where` returns a path without extension or a shim that is not a
    // PE executable (causes os error 193).
    let mut final_exe = resolved_executable.clone();
    #[cfg(windows)]
    {
        use std::path::Path;
        let p = Path::new(&resolved_executable);
        if p.exists() {
            // If it's not an .exe, try variant extensions in same dir
            if p.extension().is_none() || p.extension().and_then(|s| s.to_str()).map(|s| s.to_ascii_lowercase()) != Some("exe".to_string()) {
                if let Some(parent) = p.parent() {
                    let stem = p.file_name().and_then(|n| n.to_str()).unwrap_or(&resolved_executable).to_string();
                    let candidates = ["cmd", "bat", "exe"];
                    for ext in &candidates {
                        let cand = parent.join(format!("{}.{}", stem, ext));
                        if cand.exists() {
                            final_exe = cand.display().to_string();
                            break;
                        }
                    }
                }
            }
        }
    }
    #[cfg(windows)]
    let mut cmd = Command::new(&final_exe);
    #[cfg(windows)]
    debug!(resolved = %final_exe, "resolved executable for spawn");

    #[cfg(not(windows))]
    let mut cmd = Command::new(executable);
    if !args.is_empty() {
        cmd.args(args);
    }
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    if let Some(envmap) = envs {
        for (k, v) in envmap {
            cmd.env(k, v);
        }
    }

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    let spawn_res = cmd.spawn();
    match spawn_res {
        Ok(mut child) => {
            let stdin_ok = child.stdin.is_some();
            let stdout_ok = child.stdout.is_some();
            let stderr_ok = child.stderr.is_some();
            if stdin_ok && stdout_ok && stderr_ok {
                return Ok(child);
            }
            let pid = child.id();
            debug!(pid = pid, stdin = %stdin_ok, stdout = %stdout_ok, stderr = %stderr_ok, "direct spawn returned child with missing pipes, attempting to discover worker via child enumeration");
            // Try to enumerate children of this process (Windows diagnostic) and
            // attempt to spawn any discovered worker executable directly so we
            // can get pipes attached. This is best-effort. If immediate
            // enumeration yields nothing, poll for a short time to allow the
            // wrapper to spawn the real worker.
            #[cfg(windows)]
            {
                use std::process::Command as SysCmd;
                let try_check_children = |parent: u32| {
                    if let Ok(out) = SysCmd::new("wmic").arg("process").arg("where").arg(format!("(ParentProcessId={})", parent)).arg("get").arg("ProcessId,CommandLine").output() {
                        if out.status.success() {
                            let s = String::from_utf8_lossy(&out.stdout).to_string();
                            debug!(wmic = %s, "wmic child processes for spawned pid");
                            for line in s.lines() {
                                let l = line.trim();
                                if l.is_empty() { continue; }
                                let tokens = tokenize_commandline(l);
                                for t in &tokens {
                                    let low = t.to_ascii_lowercase();
                                    if low.ends_with(".exe") || low.ends_with("\\node") || low == "node" || low.ends_with("\\node.exe") {
                                        if let Ok(mut c) = try_spawn_candidate(t, args, envs, working_dir) {
                                            let ok_stdin = c.stdin.is_some();
                                            let ok_stdout = c.stdout.is_some();
                                            let ok_stderr = c.stderr.is_some();
                                            if ok_stdin && ok_stdout && ok_stderr {
                                                return Some(c);
                                            } else {
                                                let _ = c.kill();
                                                let _ = c.wait();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    None
                };

                // First immediate attempt
                if let Some(c) = try_check_children(pid) {
                    return Ok(c);
                }

                // Poll for a short period (2s total, 250ms interval) to allow
                // wrapper to spawn the worker.
                use std::thread::sleep;
                use std::time::Duration;
                let mut elapsed = Duration::from_millis(0);
                let interval = Duration::from_millis(250);
                while elapsed < Duration::from_secs(2) {
                    // gather descendant pids and check each
                    if let Ok(desc) = gather_descendant_processes(pid) {
                        for child_pid in desc {
                            if let Some(c) = try_check_children(child_pid) {
                                return Ok(c);
                            }
                        }
                    }
                    sleep(interval);
                    elapsed += interval;
                }
                // final immediate re-check before giving up
                if let Some(c) = try_check_children(pid) {
                    return Ok(c);
                }
            }

            // If we didn't find any better child to attach to, kill the original
            let _ = child.kill();
            let _ = child.wait();
            debug!("no discoverable worker with pipes, falling back to shell");
        }
        Err(e) => {
            // On Windows, if the error corresponds to a bad executable
            // (ERROR_BAD_EXE / 193) treat it as a signal to fall back to
            // shell invocation instead of returning early. Also fall back
            // if the executable wasn't found.
            #[cfg(windows)]
            {
                if let Some(code) = e.raw_os_error() {
                    if code == 193 /* ERROR_BAD_EXE */ {
                        debug!(os_error = code, "spawn returned ERROR_BAD_EXE, falling back to shell");
                        // fallthrough to shell fallback
                        
                    } else if e.kind() == ErrorKind::NotFound {
                        debug!(os_error = code, "spawn returned NotFound, falling back to shell");
                    } else {
                        return Err(e);
                    }
                } else {
                    if e.kind() == ErrorKind::NotFound {
                        // fallthrough to shell fallback
                    } else {
                        return Err(e);
                    }
                }
            }
            #[cfg(not(windows))]
            {
                if e.kind() != ErrorKind::NotFound {
                    return Err(e);
                }
                // else fallthrough to shell fallback
            }
        }
    }

    // Shell fallback: reconstruct command and spawn via system shell.
    let joined = if args.is_empty() {
        executable.to_string()
    } else {
        let argstr = args.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(" ");
        format!("{} {}", executable, argstr)
    };

    #[cfg(windows)]
    {
        use std::process::Command as SysCmd;
        debug!(cmd = %joined, "attempting windows shell fallback spawn");
        // Try cmd /C first
        let mut shell = SysCmd::new("cmd");
        shell.args(["/C", &joined]);
        shell.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        if let Some(envmap) = envs {
            for (k, v) in envmap {
                shell.env(k, v);
            }
        }
        if let Some(dir) = working_dir {
            shell.current_dir(dir);
        }
        match shell.spawn() {
            Ok(child) => return Ok(child),
            Err(e) => {
                debug!(%e, "cmd /C spawn failed, attempting PowerShell fallback");
                // If cmd failed, try PowerShell invocation
                let mut ps = SysCmd::new("powershell");
                // Use -NoProfile and call the command directly so output flows through PowerShell process
                ps.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &format!("& {{ {} }}", &joined)]);
                ps.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
                if let Some(envmap) = envs {
                    for (k, v) in envmap {
                        ps.env(k, v);
                    }
                }
                if let Some(dir) = working_dir {
                    ps.current_dir(dir);
                }
                return ps.spawn();
            }
        }
    }

    #[cfg(not(windows))]
    {
        debug!(cmd = %joined, "attempting unix shell fallback spawn");
        let mut shell = Command::new("sh");
        shell.args(["-c", &joined]);
        shell.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        if let Some(envmap) = envs {
            for (k, v) in envmap {
                shell.env(k, v);
            }
        }
        if let Some(dir) = working_dir {
            shell.current_dir(dir);
        }
        return shell.spawn();
    }
}

/// After spawn_process returns a Child (which may be a wrapper), attempt to
/// discover a more suitable worker PID (the real worker spawned by the
/// wrapper). Returns Some(pid) when found, None otherwise.
pub fn discover_worker_after_spawn(wrapper_pid: u32) -> Option<u32> {
    #[cfg(windows)]
    {
        // Try quick enumeration then short polling similar to earlier logic.
        if let Ok(desc) = gather_descendant_processes(wrapper_pid) {
            if !desc.is_empty() {
                return desc.into_iter().next();
            }
        }
        // fallback: try wmic direct children
        if let Ok(out) = std::process::Command::new("wmic").arg("process").arg("where").arg(format!("(ParentProcessId={})", wrapper_pid)).arg("get").arg("ProcessId").output() {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).to_string();
                for line in s.lines() {
                    let t = line.trim();
                    if t.is_empty() { continue; }
                    if let Ok(pid) = t.parse::<u32>() {
                        return Some(pid);
                    }
                }
            }
        }
    }
    None
}
