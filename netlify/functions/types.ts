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

export interface AIResponse {
  summary: string;
  emotional_validation: string;
  emotional_analysis: {
    primary_emotions: string[];
    intensity: number | null;
    conflicting_emotions: string[];
    values: string[];
    needs: string[];
  };
  reflective_questions: string[];
  next_steps: {
    mental: string | null;
    emotional: string | null;
    physical: string | null;
  };
  tone_flag: ToneFlag;
  internal_flags: InternalFlags;
  disclaimer: string | null;
  response_language: string;
  mood_acknowledged: boolean;
  prompt_version: string;
}

export interface AnalyzeRequest {
  entry: JournalEntry;
  deviceId: string;
}

export interface AnalyzeResponse {
  success: true;
  data: AIResponse;
}

export interface ErrorResponse {
  success: false;
  error: string;
  retryAfter?: number; // seconds until rate limit resets
}
