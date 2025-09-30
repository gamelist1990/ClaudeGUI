use std::collections::HashMap;
use std::io::ErrorKind;
use std::process::{Child, Command, Stdio};

/// Spawn a process, attempting a direct spawn first and falling back to a
/// shell invocation if the direct spawn returns NotFound. Environment variables
/// and working directory (cwd) are applied to either method.
pub fn spawn_process(
    executable: &str,
    args: &[String],
    envs: Option<&HashMap<String, String>>,
    working_dir: Option<&str>,
) -> std::io::Result<Child> {
    // Build direct command
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

    match cmd.spawn() {
        Ok(child) => Ok(child),
        Err(e) => {
            // If CLI not found, try a shell fallback (cmd /C on Windows, sh -c otherwise)
            if e.kind() == ErrorKind::NotFound {
                // Reconstruct a single command line string.
                let joined = if args.is_empty() {
                    executable.to_string()
                } else {
                    let argstr = args.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(" ");
                    format!("{} {}", executable, argstr)
                };

                #[cfg(windows)]
                {
                    let mut shell = Command::new("cmd");
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
                    return shell.spawn();
                }

                #[cfg(not(windows))]
                {
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

            Err(e)
        }
    }
}
