// Legacy components (kept for compatibility)
export { default as Composer } from './Composer';
export { default as MarkdownView } from './MarkdownView';
export { default as Message } from './Message';
export type { MessageType } from '../api';

// New modular components
export * from './layout';
export * from './ui';
export * from './chat';
