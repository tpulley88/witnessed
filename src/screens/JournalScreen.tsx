import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AIResponse, JournalEntry, TonePreference } from '../types';
import {
  useDeviceId,
  useOpenAIAnalysis,
  useRateLimit,
  useSpeechToText,
} from '../hooks';

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------
type RootStackParamList = {
  Onboarding: undefined;
  Journal: undefined;
  Response: { response: AIResponse; entry: JournalEntry };
};
type JournalScreenProps = NativeStackScreenProps<RootStackParamList, 'Journal'>;

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  canvas: '#F5F2EE',
  darkCanvas: '#1C1410',
  accent: '#C4704A',
  textPrimary: '#1C1410',
  textSecondary: '#6B5B4E',
  textMuted: '#9C8B7E',
  border: '#E8E0D8',
  white: '#FFFFFF',
  overlayBg: 'rgba(245,242,238,0.96)',
};

// ---------------------------------------------------------------------------
// Mood options
// ---------------------------------------------------------------------------
const MOOD_OPTIONS = [
  { emoji: '😔', score: 1, label: 'Very low' },
  { emoji: '😕', score: 2, label: 'Low' },
  { emoji: '😐', score: 3, label: 'Neutral' },
  { emoji: '🙂', score: 4, label: 'Good' },
  { emoji: '😊', score: 5, label: 'Great' },
];

// ---------------------------------------------------------------------------
// Tone options
// ---------------------------------------------------------------------------
const TONE_OPTIONS: { label: string; value: TonePreference }[] = [
  { label: 'I need to vent', value: 'vent' },
  { label: 'I want clarity', value: 'clarity' },
  { label: "I'm looking for what to do next", value: 'action_steps' },
];

// ---------------------------------------------------------------------------
// Word count helper
// ---------------------------------------------------------------------------
function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

// ---------------------------------------------------------------------------
// Pulsing recording indicator
// ---------------------------------------------------------------------------
function PulsingCircle() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={recordingStyles.wrapper}>
      <Animated.View style={[recordingStyles.outerRing, { transform: [{ scale }] }]} />
      <View style={recordingStyles.innerDot} />
    </View>
  );
}

const recordingStyles = StyleSheet.create({
  wrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 16,
  },
  outerRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    opacity: 0.2,
  },
  innerDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
  },
});

// ---------------------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------------------
function LoadingOverlay() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const [showSecondary, setShowSecondary] = useState(false);

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1.0, duration: 2000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    );
    breathe.start();

    const timer = setTimeout(() => setShowSecondary(true), 4000);
    return () => {
      breathe.stop();
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={overlayStyles.container}>
      <Animated.Text style={[overlayStyles.primary, { opacity }]}>
        Taking a moment with your entry...
      </Animated.Text>
      {showSecondary && (
        <Text style={overlayStyles.secondary}>Usually takes 5–10 seconds.</Text>
      )}
      <ActivityIndicator
        size="small"
        color={COLORS.accent}
        style={overlayStyles.spinner}
      />
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlayBg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 40,
  },
  primary: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 22,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 16,
  },
  secondary: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function JournalScreen({ navigation }: JournalScreenProps) {
  const insets = useSafeAreaInsets();

  // Hooks
  const speech = useSpeechToText();
  const analysis = useOpenAIAnalysis();
  const rateLimit = useRateLimit();
  const deviceId = useDeviceId();

  // Local state
  const [entryText, setEntryText] = useState('');
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [tonePreference, setTonePreference] = useState<TonePreference | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);

  // Sync speech transcript into text area
  useEffect(() => {
    if (speech.transcript && speech.transcript.trim().length > 0) {
      setEntryText(prev =>
        prev.trim().length > 0
          ? `${prev.trim()} ${speech.transcript}`
          : speech.transcript
      );
    }
  }, [speech.transcript]);

  // Switch to text mode after recording stops
  useEffect(() => {
    if (!speech.isListening && inputMode === 'voice' && speech.transcript) {
      // Keep voice mode visually until user switches manually
    }
  }, [speech.isListening, inputMode, speech.transcript]);

  const wordCount = countWords(entryText);
  const hasContent = entryText.trim().length > 0;
  const canSubmit = hasContent && rateLimit.callsRemaining > 0 && !analysis.isLoading;

  // ---- Voice toggle ----
  const handleToggleVoice = useCallback(async () => {
    if (inputMode === 'text') {
      setInputMode('voice');
      speech.resetTranscript();
      await speech.startListening();
    } else {
      // Already in voice mode — stop recording
      await speech.stopListening();
      setInputMode('text');
    }
  }, [inputMode, speech]);

  const handleStopRecording = useCallback(async () => {
    await speech.stopListening();
    setInputMode('text');
  }, [speech]);

  // ---- Submit ----
  const handleReflect = useCallback(() => {
    if (!canSubmit) return;

    Alert.alert(
      'Ready to reflect?',
      'Ready to reflect on your entry?',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Reflect',
          style: 'default',
          onPress: async () => {
            const entry: JournalEntry = {
              text: entryText.trim(),
              mood_score: moodScore ?? 3,
              tone_preference: tonePreference,
              input_method: inputMode,
            };
            try {
              const response = await analysis.analyze(entry, deviceId);
              if (response) {
                await rateLimit.incrementCallCount();
                navigation.push('Response', { response, entry });
              }
            } catch {
              // error handled via analysis.error
            }
          },
        },
      ]
    );
  }, [canSubmit, entryText, moodScore, tonePreference, inputMode, analysis, rateLimit, navigation, deviceId]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Loading overlay */}
      {analysis.isLoading && <LoadingOverlay />}

      <View style={[styles.inner, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerWordmark}>Witnessed</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mood check-in */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>How are you feeling right now?</Text>
            <View style={styles.moodRow}>
              {MOOD_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.score}
                  style={[
                    styles.moodButton,
                    moodScore === option.score && styles.moodButtonSelected,
                  ]}
                  onPress={() => setMoodScore(option.score)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: moodScore === option.score }}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text style={styles.moodEmoji}>{option.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tone selector */}
          <View style={styles.section}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.toneRow}
            >
              {TONE_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.toneChip,
                    tonePreference === option.value && styles.toneChipSelected,
                  ]}
                  onPress={() =>
                    setTonePreference(prev =>
                      prev === option.value ? null : option.value
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: tonePreference === option.value }}
                >
                  <Text
                    style={[
                      styles.toneChipLabel,
                      tonePreference === option.value && styles.toneChipLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Text input area */}
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                isFocused && styles.textInputFocused,
              ]}
              value={entryText}
              onChangeText={setEntryText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Start anywhere. There's no wrong way to do this."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
              accessibilityLabel="Journal entry"
              accessibilityHint="Write what's on your mind"
            />

            {/* Word count — visible after 30 words */}
            {wordCount >= 30 && (
              <Text style={styles.wordCount}>{wordCount} words</Text>
            )}
          </View>

          {/* Voice/text mode toggle */}
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[
                styles.modePill,
                inputMode === 'text' && styles.modePillActive,
              ]}
              onPress={() => {
                if (inputMode === 'voice') {
                  speech.stopListening();
                  setInputMode('text');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Type mode"
              accessibilityState={{ selected: inputMode === 'text' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.modePillLabel,
                  inputMode === 'text' && styles.modePillLabelActive,
                ]}
              >
                Type
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modePill,
                inputMode === 'voice' && styles.modePillActive,
              ]}
              onPress={handleToggleVoice}
              accessibilityRole="button"
              accessibilityLabel="Speak mode"
              accessibilityState={{ selected: inputMode === 'voice' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.modePillLabel,
                  inputMode === 'voice' && styles.modePillLabelActive,
                ]}
              >
                Speak
              </Text>
            </TouchableOpacity>
          </View>

          {/* Voice recording UI */}
          {inputMode === 'voice' && (
            <View style={styles.recordingContainer}>
              {speech.isListening ? (
                <>
                  <PulsingCircle />
                  <TouchableOpacity
                    onPress={handleStopRecording}
                    accessibilityRole="button"
                    accessibilityLabel="Tap to stop recording"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.recordingStopLabel}>Tap to stop</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.startRecordingButton}
                  onPress={handleToggleVoice}
                  accessibilityRole="button"
                  accessibilityLabel="Tap to start recording"
                >
                  <Text style={styles.startRecordingLabel}>Tap to record</Text>
                </TouchableOpacity>
              )}
              {speech.error ? (
                <Text style={styles.speechError}>{speech.error}</Text>
              ) : null}
            </View>
          )}

          {/* Analysis error */}
          {analysis.error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{analysis.error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  analysis.clearError();
                  handleReflect();
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Text style={styles.retryLabel}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Rate limit message */}
          {rateLimit.callsRemaining === 0 && (
            <View style={styles.rateLimitContainer}>
              <Text style={styles.rateLimitText}>
                You've reached your 3 reflections for today. Come back tomorrow.
              </Text>
            </View>
          )}

          {/* Submit button */}
          {hasContent && (
            <TouchableOpacity
              style={[
                styles.reflectButton,
                (!canSubmit || analysis.isLoading) && styles.reflectButtonDisabled,
              ]}
              onPress={handleReflect}
              disabled={!canSubmit || analysis.isLoading}
              accessibilityRole="button"
              accessibilityLabel={
                rateLimit.callsRemaining === 0
                  ? `Reflect — ${rateLimit.callsRemaining} reflections remaining`
                  : 'Reflect on this entry'
              }
            >
              <Text
                style={[
                  styles.reflectLabel,
                  (!canSubmit || analysis.isLoading) && styles.reflectLabelDisabled,
                ]}
              >
                {rateLimit.callsRemaining === 0
                  ? `Reflect (${rateLimit.callsRemaining} left)`
                  : 'Reflect'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  inner: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerWordmark: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 22,
    fontWeight: '400',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },

  // Mood
  moodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moodButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  moodButtonSelected: {
    borderColor: COLORS.accent,
    backgroundColor: '#FDF0EA',
  },
  moodEmoji: {
    fontSize: 24,
  },

  // Tone chips
  toneRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 24,
  },
  toneChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toneChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: '#FDF0EA',
  },
  toneChipLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  toneChipLabelSelected: {
    color: COLORS.accent,
  },

  // Text input
  inputWrapper: {
    marginBottom: 16,
    position: 'relative',
  },
  textInput: {
    fontSize: 18,
    lineHeight: 18 * 1.7,
    color: COLORS.textPrimary,
    minHeight: 200,
    paddingTop: 4,
    paddingBottom: 32,
    // No border until focused
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  textInputFocused: {
    // Subtle underline when focused
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  wordCount: {
    position: 'absolute',
    bottom: 8,
    right: 0,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Mode toggle
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modePill: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActive: {
    backgroundColor: COLORS.textPrimary,
    borderColor: COLORS.textPrimary,
  },
  modePillLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modePillLabelActive: {
    color: COLORS.white,
  },

  // Voice recording container
  recordingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  recordingStopLabel: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '500',
    marginTop: 8,
  },
  startRecordingButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startRecordingLabel: {
    fontSize: 15,
    color: COLORS.accent,
    fontWeight: '500',
  },
  speechError: {
    marginTop: 8,
    fontSize: 13,
    color: '#B04040',
    textAlign: 'center',
  },

  // Error state
  errorContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F5C6C6',
  },
  errorText: {
    fontSize: 14,
    color: '#8B2222',
    lineHeight: 22,
    marginBottom: 10,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5C6C6',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontSize: 14,
    color: '#8B2222',
    fontWeight: '600',
  },

  // Rate limit
  rateLimitContainer: {
    backgroundColor: '#F5F0EB',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rateLimitText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  // Reflect button
  reflectButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 8,
    marginBottom: 8,
  },
  reflectButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  reflectLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  reflectLabelDisabled: {
    color: COLORS.textMuted,
  },
});
