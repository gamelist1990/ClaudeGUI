use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;
use tracing::debug;

#[derive(Default)]
pub struct ProcessRegistry {
    // session id -> pid
    sessions: HashMap<String, u32>,
}

impl ProcessRegistry {
    pub fn register_claude_session(&mut self, session_id: String, pid: u32) -> Result<i64, String> {
        self.sessions.insert(session_id.clone(), pid);
        // Return a fake run id for compatibility with existing logging that
        // expects an i64. In real app this could be an incrementing counter.
        let run_id = 1000000i64;
        debug!(session = %session_id, pid = pid, run_id = run_id, "registered claude session");
        Ok(run_id)
    }

    pub fn unregister(&mut self, session_id: &str) {
        self.sessions.remove(session_id);
    }

    pub fn get_all(&self) -> HashMap<String, u32> {
        self.sessions.clone()
    }
}

pub static PROCESS_REGISTRY: Lazy<Mutex<ProcessRegistry>> = Lazy::new(|| Mutex::new(ProcessRegistry::default()));
