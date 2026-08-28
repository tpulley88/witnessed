import { useState, useCallback } from 'react';
import { AIResponse, JournalEntry } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

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
