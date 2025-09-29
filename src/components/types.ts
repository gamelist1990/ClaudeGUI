export default interface MessageType {
  id: string;
  source: 'user' | 'claude' | 'stderr';
  text: string;
}
