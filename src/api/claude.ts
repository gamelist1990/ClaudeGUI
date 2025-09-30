import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  API_COMMANDS,
  API_EVENTS,
  StartClaudeArgs,
  SendInputArgs,
  StartClaudeResponse,
  StopClaudeResponse,
  StatusResponse,
  GreetResponse,
} from "./types";

/**
 * Claude API class that handles all interactions with the Rust backend
 * Provides a clean interface for all Tauri invoke commands and events
 */
export class ClaudeAPI {
  /**
   * Start the Claude process with optional arguments and environment variables
   */
  static async startClaude(args?: StartClaudeArgs): Promise<StartClaudeResponse> {
    return invoke(API_COMMANDS.START_CLAUDE, {
      args: args?.args ?? [],
      envs: args?.envs
    });
  }

  /**
   * Stop the Claude process
   */
  static async stopClaude(): Promise<StopClaudeResponse> {
    return invoke(API_COMMANDS.STOP_CLAUDE);
  }

  /**
   * Send input text to the Claude process
   */
  static async sendInput(args: SendInputArgs): Promise<void> {
    return invoke(API_COMMANDS.SEND_INPUT, { text: args.text });
  }

  /**
   * Get the status of the Claude process
   */
  static async getStatus(): Promise<StatusResponse> {
    return invoke(API_COMMANDS.STATUS);
  }

  /**
   * Greet command (example/test command)
   */
  static async greet(name: string): Promise<GreetResponse> {
    return invoke(API_COMMANDS.GREET, { name });
  }

  /**
   * Listen to Claude stdout events
   */
  static onStdout(callback: (message: string) => void): Promise<UnlistenFn> {
    return listen<string>(API_EVENTS.CLAUDE_STDOUT, (event) => {
      callback(event.payload);
    });
  }

  /**
   * Listen to Claude stderr events
   */
  static onStderr(callback: (message: string) => void): Promise<UnlistenFn> {
    return listen<string>(API_EVENTS.CLAUDE_STDERR, (event) => {
      callback(event.payload);
    });
  }
}

// Export individual functions for backward compatibility
export const startClaude = ClaudeAPI.startClaude;
export const stopClaude = ClaudeAPI.stopClaude;
export const sendInput = ClaudeAPI.sendInput;
export const status = ClaudeAPI.getStatus;
export const onStdout = ClaudeAPI.onStdout;
export const onStderr = ClaudeAPI.onStderr;