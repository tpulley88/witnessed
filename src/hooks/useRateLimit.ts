import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_KEY = '@witnessed/rate_limit';
const MAX_CALLS = 3;

interface RateLimitState {
  callsUsed: number;
  callsRemaining: number;
  resetAt: number; // Unix ms timestamp
}

interface StoredRateLimit {
  callsUsed: number;
  resetAt: number;
}

function getMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime();
}

export function useRateLimit() {
  const [state, setState] = useState<RateLimitState>({
    callsUsed: 0,
    callsRemaining: MAX_CALLS,
    resetAt: getMidnightUTC(),
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
        if (stored) {
          const parsed: StoredRateLimit = JSON.parse(stored);
          // If reset time has passed, treat as fresh day
          if (Date.now() >= parsed.resetAt) {
            const fresh = { callsUsed: 0, resetAt: getMidnightUTC() };
            await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(fresh));
            setState({ callsUsed: 0, callsRemaining: MAX_CALLS, resetAt: fresh.resetAt });
          } else {
            const remaining = Math.max(0, MAX_CALLS - parsed.callsUsed);
            setState({ callsUsed: parsed.callsUsed, callsRemaining: remaining, resetAt: parsed.resetAt });
          }
        } else {
          setState({ callsUsed: 0, callsRemaining: MAX_CALLS, resetAt: getMidnightUTC() });
        }
      } catch {
        // Fail open — allow calls if storage is broken
      } finally {
        setIsLoaded(true);
      }
    }
    load();
  }, []);

  const incrementCallCount = useCallback(async () => {
    setState(prev => {
      const newUsed = prev.callsUsed + 1;
      const newRemaining = Math.max(0, MAX_CALLS - newUsed);
      const newState = { ...prev, callsUsed: newUsed, callsRemaining: newRemaining };
      // Persist async (fire and forget)
      AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ callsUsed: newUsed, resetAt: prev.resetAt })).catch(() => {});
      return newState;
    });
  }, []);

  return { ...state, isLoaded, incrementCallCount };
}
