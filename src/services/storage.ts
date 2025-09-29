export type Conversation = {
  id: number;
  messages: Array<{ id: string; source: string; text: string }>;
};

const CONV_KEY = "conversations";

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY) ?? "[]";
    return JSON.parse(raw) as Conversation[];
  } catch (e) {
    console.error("failed to load conversations", e);
    return [];
  }
}

export function saveConversation(conv: Conversation) {
  const convs = loadConversations();
  convs.push(conv);
  localStorage.setItem(CONV_KEY, JSON.stringify(convs));
}

export function clearConversations() {
  localStorage.removeItem(CONV_KEY);
}

export function exportConversations(): string {
  return JSON.stringify(loadConversations());
}

export function importConversations(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return false;
    localStorage.setItem(CONV_KEY, JSON.stringify(parsed));
    return true;
  } catch (e) {
    return false;
  }
}
