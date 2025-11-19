export interface User {
  username: string;
  token: string;
  preferredLanguage?: string;
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export enum MessageType {
  TEXT = 'text',
  IMAGE_GENERATED = 'image_generated',
  IMAGE_UPLOAD = 'image_upload'
}

export interface Message {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string; // Text content or Base64 string for images
  timestamp: number;
  isError?: boolean;
  groundingMetadata?: any; // For search citations
}

export interface StoredChat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

export interface LanguageOption {
  code: string;
  label: string;
  systemPromptSnippet: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
}

export interface ChatSettings {
  enableSearch: boolean;
  enableThinking: boolean;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}