import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Linking,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AIResponse, JournalEntry } from '../types';
import { usePDFExport } from '../hooks';

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------
type RootStackParamList = {
  Onboarding: undefined;
  Journal: undefined;
  Response: { response: AIResponse; entry: JournalEntry };
};
type ResponseScreenProps = NativeStackScreenProps<RootStackParamList, 'Response'>;

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  canvas: '#F5F2EE',
  accent: '#C4704A',
  textPrimary: '#1C1410',
  textSecondary: '#6B5B4E',
  textMuted: '#9C8B7E',
  border: '#E8E0D8',
  white: '#FFFFFF',
  cardWarm: '#FDF8F5',
  crisisBanner: '#7B2D2D',
  crisisBannerBg: '#FAE8E8',
  alertBannerBg: '#FDF3E3',
  alertBanner: '#7A5A2A',
};

// ---------------------------------------------------------------------------
// Animated card wrapper
// ---------------------------------------------------------------------------
interface AnimatedCardProps {
  delay: number;
  children: React.ReactNode;
}

function AnimatedCard({ delay, children }: AnimatedCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Emotion tag pill
// ---------------------------------------------------------------------------
function EmotionTag({ label }: { label: string }) {
  return (
    <View style={tagStyles.tag}>
      <Text style={tagStyles.label}>{label}</Text>
    </View>
  );
}

const tagStyles = StyleSheet.create({
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F0EAE4',
    marginRight: 6,
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

// ---------------------------------------------------------------------------
// Crisis banner
// ---------------------------------------------------------------------------
interface CrisisBannerProps {
  text: string | null;
  severity: 'escalate' | 'alert';
}

function CrisisBanner({ text, severity }: CrisisBannerProps) {
  const isEscalate = severity === 'escalate';

  function dial988() {
    Linking.openURL('tel:988').catch(() => {});
  }

  const displayText = text ??
    (isEscalate
      ? 'If you are in crisis or danger, please reach out for help immediately.'
      : 'If you need support, help is available.');

  // Inline-inject tappable 988 by splitting the text
  const parts = displayText.split(/(988)/g);

  return (
    <View
      style={[
        bannerStyles.container,
        isEscalate ? bannerStyles.escalateContainer : bannerStyles.alertContainer,
      ]}
      accessibilityRole="alert"
    >
      <View style={bannerStyles.textRow}>
        {parts.map((part, i) =>
          part === '988' ? (
            <TouchableOpacity
              key={i}
              onPress={dial988}
              accessibilityRole="link"
              accessibilityLabel="Call or text 988 — Suicide and Crisis Lifeline"
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text
                style={[
                  bannerStyles.text,
                  isEscalate ? bannerStyles.escalateText : bannerStyles.alertText,
                  bannerStyles.linkText,
                ]}
              >
                {part}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text
              key={i}
              style={[
                bannerStyles.text,
                isEscalate ? bannerStyles.escalateText : bannerStyles.alertText,
              ]}
            >
              {part}
            </Text>
          )
        )}
      </View>
      {isEscalate && (
        <TouchableOpacity
          style={bannerStyles.callButton}
          onPress={dial988}
          accessibilityRole="button"
          accessibilityLabel="Call or text 988"
        >
          <Text style={bannerStyles.callButtonLabel}>Call or text 988</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  escalateContainer: {
    backgroundColor: COLORS.crisisBannerBg,
    borderWidth: 1.5,
    borderColor: '#E5AAAA',
  },
  alertContainer: {
    backgroundColor: COLORS.alertBannerBg,
    borderWidth: 1,
    borderColor: '#E8D5A0',
  },
  textRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    flexShrink: 1,
  },
  escalateText: {
    color: COLORS.crisisBanner,
  },
  alertText: {
    color: COLORS.alertBanner,
  },
  linkText: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  callButton: {
    marginTop: 12,
    backgroundColor: COLORS.crisisBanner,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});

// ---------------------------------------------------------------------------
// Card shell
// ---------------------------------------------------------------------------
interface CardProps {
  title: string;
  children: React.ReactNode;
  warm?: boolean;
}

function Card({ title, children, warm = false }: CardProps) {
  return (
    <View style={[cardStyles.card, warm && cardStyles.cardWarm]}>
      <Text style={cardStyles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#1C1410',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardWarm: {
    backgroundColor: COLORS.cardWarm,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
});

// ---------------------------------------------------------------------------
// Card 1 — What you shared
// ---------------------------------------------------------------------------
function SummaryCard({ response }: { response: AIResponse }) {
  return (
    <AnimatedCard delay={0}>
      <Card title="What you shared">
        <Text style={cardTextStyles.body}>{response.summary}</Text>
      </Card>
    </AnimatedCard>
  );
}

// ---------------------------------------------------------------------------
// Card 2 — What we hear in that
// ---------------------------------------------------------------------------
function ValidationCard({ response }: { response: AIResponse }) {
  const { primary_emotions, conflicting_emotions } = response.emotional_analysis;
  const hasPrimary = primary_emotions && primary_emotions.length > 0;
  const hasConflicting = conflicting_emotions && conflicting_emotions.length > 0;

  return (
    <AnimatedCard delay={200}>
      <Card title="What we hear in that" warm>
        <Text style={cardTextStyles.body}>{response.emotional_validation}</Text>

        {hasPrimary && (
          <View style={cardTextStyles.tagsSection}>
            <View style={cardTextStyles.tagsRow}>
              {primary_emotions.map((emotion, i) => (
                <EmotionTag key={i} label={emotion} />
              ))}
            </View>
          </View>
        )}

        {hasConflicting && (
          <View style={cardTextStyles.conflictingSection}>
            <Text style={cardTextStyles.conflictingLabel}>Also present:</Text>
            <View style={cardTextStyles.tagsRow}>
              {conflicting_emotions.map((emotion, i) => (
                <EmotionTag key={i} label={emotion} />
              ))}
            </View>
          </View>
        )}
      </Card>
    </AnimatedCard>
  );
}

// ---------------------------------------------------------------------------
// Card 3 — Reflective questions
// ---------------------------------------------------------------------------
interface QuestionsCardProps {
  questions: string[];
}

function QuestionsCard({ questions }: QuestionsCardProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <AnimatedCard delay={400}>
      <Card title="A question worth sitting with">
        <Text style={cardTextStyles.questionPrimary}>{questions[0]}</Text>
        {questions[1] ? (
          <Text style={cardTextStyles.questionSecondary}>{questions[1]}</Text>
        ) : null}
      </Card>
    </AnimatedCard>
  );
}

// ---------------------------------------------------------------------------
// Card 4 — Next steps
// ---------------------------------------------------------------------------
interface NextStepsCardProps {
  nextSteps: AIResponse['next_steps'];
}

function NextStepsCard({ nextSteps }: NextStepsCardProps) {
  const { mental, emotional, physical } = nextSteps;
  const anyStep = mental || emotional || physical;
  if (!anyStep) return null;

  return (
    <AnimatedCard delay={600}>
      <Card title="If you want to do something">
        {mental ? (
          <View style={nextStepsStyles.row}>
            <Text style={nextStepsStyles.categoryLabel}>Mental</Text>
            <Text style={nextStepsStyles.stepText}>{mental}</Text>
          </View>
        ) : null}
        {emotional ? (
          <View style={nextStepsStyles.row}>
            <Text style={nextStepsStyles.categoryLabel}>Emotional</Text>
            <Text style={nextStepsStyles.stepText}>{emotional}</Text>
          </View>
        ) : null}
        {physical ? (
          <View style={nextStepsStyles.row}>
            <Text style={nextStepsStyles.categoryLabel}>Physical</Text>
            <Text style={nextStepsStyles.stepText}>{physical}</Text>
          </View>
        ) : null}
      </Card>
    </AnimatedCard>
  );
}

const nextStepsStyles = StyleSheet.create({
  row: {
    marginBottom: 14,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 26,
  },
});

const cardTextStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 26,
  },
  tagsSection: {
    marginTop: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  conflictingSection: {
    marginTop: 10,
  },
  conflictingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  questionPrimary: {
    fontSize: 18,
    color: COLORS.textPrimary,
    lineHeight: 28,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    marginBottom: 12,
  },
  questionSecondary: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
    fontStyle: 'italic',
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function ResponseScreen({ navigation, route }: ResponseScreenProps) {
  const insets = useSafeAreaInsets();
  const { response, entry } = route.params;
  const pdfExport = usePDFExport();

  // Determine banner visibility
  const isEscalate =
    response.tone_flag === 'escalate' ||
    response.internal_flags?.medical_emergency_flag === true;
  const isAlert = !isEscalate && response.tone_flag === 'alert';

  function handleStartFresh() {
    navigation.replace('Journal');
  }

  function handleShareOrSave() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Share as PDF', 'Share as text'],
          cancelButtonIndex: 0,
        },
        async buttonIndex => {
          if (buttonIndex === 1) {
            await pdfExport.exportAsPDF(response, entry);
          } else if (buttonIndex === 2) {
            await pdfExport.exportAsText(response, entry);
          }
        }
      );
    } else {
      // Android — use Alert as a simple action sheet substitute
      Alert.alert(
        'Share or Save',
        'Choose a format',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share as PDF',
            onPress: () => pdfExport.exportAsPDF(response, entry),
          },
          {
            text: 'Share as text',
            onPress: () => pdfExport.exportAsText(response, entry),
          },
        ]
      );
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleStartFresh}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Start fresh — go back to journal"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backLabel}>← Start fresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Crisis banner — top, before cards */}
        {isEscalate && (
          <CrisisBanner
            text={response.disclaimer}
            severity="escalate"
          />
        )}

        {/* Cards */}
        <SummaryCard response={response} />
        <ValidationCard response={response} />
        <QuestionsCard questions={response.reflective_questions} />
        <NextStepsCard nextSteps={response.next_steps} />

        {/* Alert banner — below cards */}
        {isAlert && (
          <CrisisBanner
            text={response.disclaimer}
            severity="alert"
          />
        )}

        {/* Disclaimer line */}
        <Text style={styles.disclaimerLine}>
          AI-generated reflection · Not clinical advice ·{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => Linking.openURL('tel:988')}
            accessibilityRole="link"
            accessibilityLabel="Call or text 988 if in crisis"
          >
            988
          </Text>{' '}
          if in crisis
        </Text>

        {/* Bottom action */}
        <TouchableOpacity
          style={[
            styles.shareButton,
            pdfExport.isExporting && styles.shareButtonDisabled,
          ]}
          onPress={handleShareOrSave}
          disabled={pdfExport.isExporting}
          accessibilityRole="button"
          accessibilityLabel="Share or save this reflection"
        >
          <Text
            style={[
              styles.shareLabel,
              pdfExport.isExporting && styles.shareLabelDisabled,
            ]}
          >
            {pdfExport.isExporting ? 'Preparing...' : 'Share or Save'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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

  // Header
  header: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  backLabel: {
    fontSize: 16,
    color: COLORS.accent,
    fontWeight: '500',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // Disclaimer
  disclaimerLine: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 20,
  },
  disclaimerLink: {
    color: COLORS.accent,
    textDecorationLine: 'underline',
  },

  // Share button
  shareButton: {
    backgroundColor: COLORS.textPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  shareButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  shareLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  shareLabelDisabled: {
    color: COLORS.textMuted,
  },
});
