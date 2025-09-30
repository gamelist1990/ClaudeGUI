use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub run_id: i64,
    pub pid: u32,
    pub session_id: String,
}

pub struct ProcessRegistry {
    inner: Mutex<HashMap<i64, ProcessInfo>>,
    next_id: Mutex<i64>,
}

impl ProcessRegistry {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1_000_000),
        }
    }

    pub fn register_claude_session(&self, session_id: String, pid: u32) -> Result<i64, String> {
        let mut id_lock = self.next_id.lock().map_err(|e| e.to_string())?;
        let run_id = *id_lock;
        *id_lock += 1;
        let info = ProcessInfo { run_id, pid, session_id };
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        inner.insert(run_id, info);
        Ok(run_id)
    }

    #[allow(dead_code)]
    pub fn unregister(&self, run_id: i64) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        inner.remove(&run_id);
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_all(&self) -> Result<Vec<ProcessInfo>, String> {
        let inner = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(inner.values().cloned().collect())
    }
}

// Global registry instance for simplicity
pub static PROCESS_REGISTRY: Lazy<ProcessRegistry> = Lazy::new(|| ProcessRegistry::new());
