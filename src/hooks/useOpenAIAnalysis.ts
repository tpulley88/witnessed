import { useState, useCallback } from 'react';
import { AIResponse, JournalEntry } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const CRISIS_PATTERN = /\b(suicide|suicidal|kill myself|hurt myself|harm myself|kill someone|hurt someone)\b/i;

function buildDemoResponse(entry: JournalEntry): AIResponse {
  const isCrisis = CRISIS_PATTERN.test(entry.text);
  const tone = entry.tone_preference ?? 'clarity';
  const nextStep = tone === 'action_steps'
    ? 'Choose one small, concrete action that feels manageable today.'
    : 'Pause and name the part of this experience that needs the most attention.';

  return {
    summary: 'You are taking time to notice and put words around an experience that matters to you.',
    emotional_validation: isCrisis
      ? 'What you shared sounds urgent and deserves immediate support from a person who can help keep you safe.'
      : 'It makes sense that this experience is taking up emotional space. Writing it down can help create room to understand what you need next.',
    emotional_analysis: {
      primary_emotions: entry.mood_score <= 2 ? ['distress', 'uncertainty'] : ['reflection'],
      intensity: entry.mood_score <= 2 ? 8 : 5,
      conflicting_emotions: [],
      values: ['self-understanding'],
      needs: isCrisis ? ['immediate human support', 'safety'] : ['clarity', 'support'],
    },
    reflective_questions: isCrisis
      ? []
      : ['What feels most important about this right now?', 'What kind of support would feel useful?'],
    next_steps: {
      mental: isCrisis ? null : nextStep,
      emotional: isCrisis ? 'Contact a trusted person and tell them you need support now.' : 'Offer yourself the same patience you would offer someone you care about.',
      physical: isCrisis ? 'Move to a safer place and contact emergency or crisis support.' : 'Take three slow breaths and notice where you are holding tension.',
    },
    tone_flag: isCrisis ? 'escalate' : 'supportive',
    internal_flags: {
      mood_elevation_watch: false,
      reality_testing_concern: false,
      substance_context: false,
      medical_emergency_flag: isCrisis,
      trauma_narration: false,
      dissociative_markers: false,
      grief_context: false,
      grief_type: null,
      identity_entry: false,
      human_referral_mode: isCrisis,
      depth_check_triggered: false,
    },
    disclaimer: isCrisis
      ? 'This demo cannot provide crisis care. Call or text 988 in the U.S. or contact local emergency services now.'
      : null,
    response_language: 'en',
    mood_acknowledged: true,
    prompt_version: 'portfolio-demo-v1',
  };
}

interface UseOpenAIAnalysisResult {
  analyze: (entry: JournalEntry, deviceId: string | null) => Promise<AIResponse | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useOpenAIAnalysis(): UseOpenAIAnalysisResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (entry: JournalEntry, deviceId: string | null): Promise<AIResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!API_URL) {
        await new Promise(resolve => setTimeout(resolve, 350));
        return buildDemoResponse(entry);
      }

      const response = await fetch(`${API_URL}/.netlify/functions/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceId ? { 'X-Device-ID': deviceId } : {}),
        },
        body: JSON.stringify({ entry, deviceId }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setError('daily_limit');
        return null;
      }

      if (!response.ok || !data.success) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return null;
      }

      return data.data as AIResponse;
    } catch (err) {
      setError('Unable to connect. Check your internet connection and try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { analyze, isLoading, error, clearError };
}
