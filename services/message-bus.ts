import type { ExtensionMessage, ExtensionResponse } from '../types/messages';

export async function sendMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(message) as Promise<ExtensionResponse>;
}

export function onExtensionMessage(handler: (message: ExtensionMessage, sender: chrome.runtime.MessageSender) => void): () => void {
  const listener = (message: ExtensionMessage, sender: chrome.runtime.MessageSender): void => handler(message, sender);
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
