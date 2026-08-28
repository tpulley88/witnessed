export type TonePreference = 'vent' | 'clarity' | 'action_steps';
export type ToneFlag = 'supportive' | 'alert' | 'escalate';

export interface JournalEntry {
  text: string;
  mood_score: number; // 1-5
  tone_preference: TonePreference | null;
  input_method: 'text' | 'voice';
}

export interface InternalFlags {
  mood_elevation_watch: boolean;
  reality_testing_concern: boolean;
  substance_context: boolean;
  medical_emergency_flag: boolean;
  trauma_narration: boolean;
  dissociative_markers: boolean;
  grief_context: boolean;
  grief_type: 'recent_loss' | 'anticipatory' | 'ambiguous' | 'historical' | null;
  identity_entry: boolean;
  human_referral_mode: boolean;
  depth_check_triggered: boolean;
}

export interface EmotionalAnalysis {
  primary_emotions: string[];
  intensity: number | null; // 1-10 or null
  conflicting_emotions: string[];
  values: string[];
  needs: string[];
}

export interface NextSteps {
  mental: string | null;
  emotional: string | null;
  physical: string | null;
}

export interface AIResponse {
  summary: string;
  emotional_validation: string;
  emotional_analysis: EmotionalAnalysis;
  reflective_questions: string[]; // empty array when depth_check_triggered or trauma_narration
  next_steps: NextSteps;
  tone_flag: ToneFlag;
  internal_flags: InternalFlags;
  disclaimer: string | null; // required when tone_flag is 'alert' or 'escalate'
  response_language: string; // ISO 639-1
  mood_acknowledged: boolean;
  prompt_version: string; // always "v2.0"
}

export type RootStackParamList = {
  Onboarding: undefined;
  Journal: undefined;
  Response: { response: AIResponse; entry: JournalEntry };
};

export interface RateLimitState {
  callsUsed: number;
  callsRemaining: number;
  resetAt: number; // Unix timestamp (midnight UTC)
}
