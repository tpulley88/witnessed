import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

// Dynamic import to avoid crashing if the native module isn't linked yet
let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch {
  // Voice module not available — STT will be disabled
}

interface UseSpeechToTextResult {
  isListening: boolean;
  transcript: string;
  isAvailable: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  resetTranscript: () => void;
  error: string | null;
}

export function useSpeechToText(): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isAvailable = Voice !== null;

  useEffect(() => {
    if (!Voice) return;

    const onSpeechStart = () => setIsListening(true);
    const onSpeechEnd = () => setIsListening(false);
    const onSpeechError = (e: any) => {
      setError(e.error?.message ?? 'Speech recognition error');
      setIsListening(false);
    };
    const onSpeechResults = (e: any) => {
      if (e.value && e.value[0]) {
        setTranscript(e.value[0]);
      }
    };
    const onSpeechPartialResults = (e: any) => {
      if (e.value && e.value[0]) {
        setTranscript(e.value[0]);
      }
    };

    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;

    return () => {
      if (Voice) {
        Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {});
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!Voice) return;
    try {
      setError(null);
      setTranscript('');
      await Voice.start('en-US');
    } catch (e: any) {
      setError(e.message ?? 'Could not start listening');
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (!Voice) return;
    try {
      await Voice.stop();
    } catch {
      // ignore
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return { isListening, transcript, isAvailable, startListening, stopListening, resetTranscript, error };
}
