import { LanguageOption } from "./types";

export const APP_NAME = "Raynex AI";

export const LANGUAGES: LanguageOption[] = [
  { 
    code: 'en', 
    label: 'English', 
    systemPromptSnippet: 'You are a highly intelligent assistant. You communicate in fluent, professional English. You are an expert coder and problem solver.' 
  },
  { 
    code: 'ur', 
    label: 'Urdu (اردو)', 
    systemPromptSnippet: 'CRITICAL: You MUST generate your response in Urdu (اردو script). Do NOT write in English unless you are providing Code snippets or technical terms. Your entire conversation must be in Urdu.' 
  },
  { 
    code: 'ur-latin', 
    label: 'Roman Urdu', 
    systemPromptSnippet: 'CRITICAL: You MUST communicate in Roman Urdu (Urdu written in English characters). Be empathetic, witty, and smart. Example: "Aap kaise hain?" instead of "How are you?". NEVER write standard English sentences unless requested for specific content.' 
  },
  { 
    code: 'hi', 
    label: 'Hindi', 
    systemPromptSnippet: 'CRITICAL: You MUST communicate in Hindi (Devanagari script). Do NOT write in English unless providing code or specific technical definitions.' 
  },
  { 
    code: 'es', 
    label: 'Spanish', 
    systemPromptSnippet: 'You must communicate in Spanish. For code, use standard English syntax.' 
  }
];

export const MODEL_NAMES = {
  CHAT: 'gemini-2.5-flash',
  IMAGE_GEN: 'imagen-4.0-generate-001', 
  IMAGE_EDIT: 'gemini-2.5-flash-image',
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'raynex_auth_token',
  USER_DATA: 'raynex_user_data',
  LANG_PREF: 'raynex_lang_pref',
  CHAT_HISTORY: 'raynex_chat_history'
};

export const MIN_PASSWORD_LENGTH = 12;