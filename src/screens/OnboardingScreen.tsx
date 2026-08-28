import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// ---------------------------------------------------------------------------
// Navigation types (mirrors RootStackParamList in the project)
// ---------------------------------------------------------------------------
type RootStackParamList = {
  Onboarding: undefined;
  Journal: undefined;
  Response: { response: any; entry: any };
};
type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COLORS = {
  canvas: '#F5F2EE',
  darkCanvas: '#1C1410',
  accent: '#C4704A',
  textPrimary: '#1C1410',
  textSecondary: '#6B5B4E',
  textMuted: '#9C8B7E',
  border: '#E8E0D8',
};

const ASYNC_KEYS = {
  onboardingComplete: '@witnessed/onboarding_complete',
  disclaimerAccepted: '@witnessed/disclaimer_accepted',
};

// ---------------------------------------------------------------------------
// Helper: fade a new step in
// ---------------------------------------------------------------------------
function useFadeAnim(step: number) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  return opacity;
}

// ---------------------------------------------------------------------------
// Progress dots
// ---------------------------------------------------------------------------
interface DotsProps {
  total: number;
  current: number; // 1-based
}

function ProgressDots({ total, current }: DotsProps) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i + 1 === current ? styles.dotFilled : styles.dotEmpty,
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// CTA button
// ---------------------------------------------------------------------------
interface CTAProps {
  label: string;
  onPress: () => void;
}

function CTAButton({ label, onPress }: CTAProps) {
  return (
    <TouchableOpacity
      style={styles.ctaButton}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.ctaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Welcome
// ---------------------------------------------------------------------------
interface StepProps {
  onNext: () => void;
}

function WelcomeStep({ onNext }: StepProps) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepContent}>
        <Text style={styles.wordmark}>Witnessed</Text>
        <Text style={styles.subtitle}>A space to think out loud.</Text>
        <Text style={styles.body}>AI listens and reflects back.</Text>
      </View>
      <CTAButton label="Let's begin →" onPress={onNext} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Safe Space Declaration
// ---------------------------------------------------------------------------
function SafeSpaceStep({ onNext }: StepProps) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>You're safe here.</Text>
        <Text style={styles.safeParagraph}>
          Witnessed is a wellness journal — not therapy. What you write is
          processed by AI to help you reflect. We don't store your entries,
          share them, or use them to train AI. You're safe to say the real
          thing.
        </Text>
      </View>
      <CTAButton label="I understand →" onPress={onNext} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Disclaimer (required acceptance)
// ---------------------------------------------------------------------------
function DisclaimerStep({ onNext }: StepProps) {
  function callNumber(number: string) {
    Linking.openURL(`tel:${number}`).catch(() => {
      // fail silently — user can manually dial
    });
  }

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.disclaimerScroll}
        contentContainerStyle={styles.disclaimerScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.disclaimerTitle}>Before you begin</Text>

        <Text style={styles.disclaimerBody}>
          Witnessed is not a medical service, mental health treatment, or
          substitute for professional care. AI responses are not clinical advice
          and don't create a professional relationship.
        </Text>

        <Text style={styles.crisisHeading}>In a crisis?</Text>

        <View style={styles.crisisRow}>
          <TouchableOpacity
            onPress={() => callNumber('988')}
            accessibilityRole="link"
            accessibilityLabel="Call or text 988 — Suicide and Crisis Lifeline"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.crisisLink}>988</Text>
          </TouchableOpacity>
          <Text style={styles.crisisText}> (Suicide &amp; Crisis Lifeline)</Text>
        </View>

        <View style={styles.crisisRow}>
          <Text style={styles.crisisText}>Text HOME to </Text>
          <TouchableOpacity
            onPress={() => callNumber('741741')}
            accessibilityRole="link"
            accessibilityLabel="Text HOME to 741741 — Crisis Text Line"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.crisisLink}>741741</Text>
          </TouchableOpacity>
          <Text style={styles.crisisText}> (Crisis Text Line)</Text>
        </View>

        <Text style={styles.crisisText}>
          Call 911 if in immediate danger.
        </Text>

        <Text style={[styles.disclaimerBody, styles.disclaimerBodyBottom]}>
          Witnessed cannot help in a crisis.
        </Text>
      </ScrollView>

      <CTAButton label="I Understand — Let's Begin" onPress={onNext} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const opacity = useFadeAnim(step);

  async function handleComplete() {
    try {
      await AsyncStorage.multiSet([
        [ASYNC_KEYS.onboardingComplete, 'true'],
        [ASYNC_KEYS.disclaimerAccepted, 'true'],
      ]);
    } catch {
      // AsyncStorage write failed — continue anyway; non-blocking
    }
    navigation.replace('Journal');
  }

  function advance() {
    if (step < 3) {
      setStep(s => s + 1);
    } else {
      handleComplete();
    }
  }

  function renderStep() {
    switch (step) {
      case 1:
        return <WelcomeStep onNext={advance} />;
      case 2:
        return <SafeSpaceStep onNext={advance} />;
      case 3:
        return <DisclaimerStep onNext={advance} />;
      default:
        return null;
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          styles.safeWrapper,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <Animated.View style={[styles.animatedWrapper, { opacity }]}>
          {renderStep()}
        </Animated.View>

        <ProgressDots total={3} current={step} />
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
  safeWrapper: {
    flex: 1,
    paddingHorizontal: 32,
  },
  animatedWrapper: {
    flex: 1,
  },

  // ---- Step shell ----
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
  },

  // ---- Step 1 ----
  wordmark: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 48,
    fontWeight: '400',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 22,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 30,
  },
  body: {
    fontSize: 17,
    color: COLORS.textMuted,
    lineHeight: 26,
  },

  // ---- Step 2 ----
  stepTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 30,
    fontWeight: '400',
    color: COLORS.textPrimary,
    marginBottom: 24,
    lineHeight: 40,
  },
  safeParagraph: {
    fontSize: 18,
    color: COLORS.textSecondary,
    lineHeight: 30,
  },

  // ---- Step 3 ----
  disclaimerScroll: {
    flex: 1,
  },
  disclaimerScrollContent: {
    paddingBottom: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  disclaimerTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 28,
    fontWeight: '400',
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  disclaimerBody: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 26,
    marginBottom: 20,
  },
  disclaimerBodyBottom: {
    marginTop: 4,
    fontStyle: 'italic',
    color: COLORS.textMuted,
  },
  crisisHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  crisisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  crisisText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 26,
  },
  crisisLink: {
    fontSize: 16,
    color: COLORS.accent,
    lineHeight: 26,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  // ---- CTA Button ----
  ctaButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
    marginTop: 20,
  },
  ctaLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ---- Progress dots ----
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: COLORS.accent,
  },
  dotEmpty: {
    backgroundColor: COLORS.border,
  },
});
