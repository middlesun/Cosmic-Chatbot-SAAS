export interface ChatCatalogOption {
  slug: string;
  category: string;
  displayName: string;
  subtitle: string;
}

export interface ChatCatalog {
  experts: ChatCatalogOption[];
  modes: ChatCatalogOption[];
  outputs: ChatCatalogOption[];
  languages: ChatCatalogOption[];
  tools: ChatCatalogOption[];
}

export interface ChatProfile {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
  birth_date: string;
  birth_city: string;
  birth_country: string;
  relationship: string | null;
  is_activated: boolean;
  profile_memory_summary?: string | null;
}

export interface ConversationRecord {
  id: string;
  user_id: string;
  profile_id: string | null;
  linked_report_id: string | null;
  title: string;
  mode_type: 'reading' | 'learn_astrology' | 'report_followup';
  is_bookmarked: boolean;
  total_word_count: number;
  use_full_profile_memory: boolean;
  updated_at: string;
  created_at: string;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  parent_message_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  word_count: number;
  expert_used: string | null;
  mode_used: string | null;
  output_format_used: string | null;
  language_used: string | null;
  is_starred: boolean;
  excluded_from_context: boolean;
  followups_json: string[];
  credits_charged?: number;
  created_at: string;
}

export interface CustomPromptRecord {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  created_at: string;
}

export interface FavoriteMessageRecord extends ChatMessageRecord {
  conversation_title: string;
  profile_id: string | null;
}

export type ChatToneMode = 'friendly' | 'technical';
export type ChatResponseLength = 'short' | 'detailed';

export interface ChatAttachmentInput {
  id: string;
  kind: 'image' | 'pdf';
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

