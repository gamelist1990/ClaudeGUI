import '@testing-library/jest-dom';

// Mock Tauri API for testing
global.window = global.window || {};
(global.window as any).__TAURI_INTERNALS__ = {
  transformCallback: (callback: any) => callback,
  invoke: () => Promise.resolve(null),
  listen: () => Promise.resolve(() => {}),
};

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  writable: true,
});

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});