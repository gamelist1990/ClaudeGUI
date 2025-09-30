// TypeScript types that match Rust API specifications

// Rust HashMap<String, String> equivalent
export type EnvMap = Record<string, string>;

// Arguments for start_claude command
export interface StartClaudeArgs {
  args?: string[];
  envs?: EnvMap;
}

// Send input command arguments
export interface SendInputArgs {
  text: string;
}

// Command responses
export type StartClaudeResponse = string; // Returns "started pid {pid}"
export type StopClaudeResponse = string;  // Returns "stopped" 
export type StatusResponse = boolean;     // Returns process running status
export type GreetResponse = string;       // Returns greeting message

// Event payloads
export interface ClaudeStdoutEvent {
  payload: string;
}

export interface ClaudeStderrEvent {
  payload: string;
}

// Message type for UI
export interface MessageType {
  id: string;
  source: 'user' | 'claude' | 'stderr';
  text: string;
}

// API command names (matching Rust command names)
export const API_COMMANDS = {
  GREET: 'greet',
  START_CLAUDE: 'start_claude',
  SEND_INPUT: 'send_input',
  STOP_CLAUDE: 'stop_claude',
  STATUS: 'status',
} as const;

// Event names (matching Rust event names)
export const API_EVENTS = {
  CLAUDE_STDOUT: 'claude-stdout',
  CLAUDE_STDERR: 'claude-stderr',
} as const;