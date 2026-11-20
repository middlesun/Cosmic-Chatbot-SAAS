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

export interface SuggestionItem {
  id: string;
  text: string;
  technical_directive?: string;
}

export interface MessageSuggestions {
  followups: SuggestionItem[];
  deeper_analysis: SuggestionItem[];
}

export interface AskLaterItem {
  id: string;
  text: string;
  tier: 'followup' | 'deeper_analysis';
  technical_directive?: string;
  source_message_id?: string;
  saved_at: string;
}

export interface PublicSuggestionsUiConfig {
  followups_enabled: boolean;
  deeper_analysis_enabled: boolean;
  default_expanded: boolean;
  max_followups: number;
  max_deeper_analysis: number;
}

export interface ChatProfile {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
  birth_date: string;
  birth_time?: string;
  birth_city: string;
  birth_country: string;
  current_city?: string | null;
  current_state?: string | null;
  current_country?: string | null;
  current_timezone_offset?: number | null;
  relationship: string | null;
  is_activated: boolean;
  profile_memory_summary?: string | null;
}

export type ChatPillar = 'council' | 'companion' | 'clarity';

export type CompanionArchetypeSlug =
  | 'find_someone'
  | 'friend'
  | 'listener'
  | 'motivator'
  | 'life_coach'
  | 'spiritual_guide';

export interface CompanionPersona {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  companion_type: CompanionArchetypeSlug;
  role_label: string;
  background: string;
  tagline: string;
  bio: string;
  conversation_style: string;
  opening_message: string;
  system_prompt: string;
  topic_context?: string;
  religion_profile?: {
    religiousness: number;
    primary_religion: string;
    secondary_religion?: string;
  };
}

export interface ActiveChatTab {
  tabId: string;
  pillar: ChatPillar;
  conversationId: string | null;
  label: string;
  subtitle?: string;
  expertSlug?: string;
  companionType?: CompanionArchetypeSlug | null;
  companionPersona?: CompanionPersona | null;
  isCore?: boolean;
}

export interface ConversationRecord {
  id: string;
  user_id: string;
  profile_id: string | null;
  linked_report_id: string | null;
  title: string;
  mode_type: 'reading' | 'learn_astrology' | 'report_followup';
  pillar?: ChatPillar;
  is_active_tab?: boolean;
  active_tab_order?: number;
  companion_type?: CompanionArchetypeSlug | null;
  companion_persona_json?: CompanionPersona | null;
  is_bookmarked: boolean;
  total_word_count: number;
  use_full_profile_memory: boolean;
  ask_later_json?: AskLaterItem[];
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
  suggestions_json?: MessageSuggestions | null;
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

export interface PlaceSuggestion {
  label: string;
  city: string;
  state: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffset: number;
}

export interface PendingBirthProfileDraft {
  name: string;
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:MM (24h)
  birth_time_display?: string;
  place_query: string;
  birth_city?: string;
  birth_state?: string | null;
  birth_country?: string;
  gender?: string | null;
  relationship?: string | null;
  original_question?: string | null;
}

export interface ChatbotFeaturesUiConfig {
  voice_input: boolean;
  listen_tts: boolean;
  whatsapp_share: boolean;
  attachments: boolean;
  quick_tools: boolean;
  followups: boolean;
  auto_intake: boolean;
  memory_summary: boolean;
}

export interface PublicChatbotUiConfig {
  welcome_title: string;
  welcome_subtitle: string;
  general_ready_message: string;
  composer_placeholder: string;
  default_expert: string;
  default_mode: string;
  default_output: string;
  default_language: string;
  default_tone: ChatToneMode;
  default_response_length: ChatResponseLength;
  features: ChatbotFeaturesUiConfig;
}



