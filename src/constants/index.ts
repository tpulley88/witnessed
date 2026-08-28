export const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: '@witnessed/onboarding_complete',
  DISCLAIMER_ACCEPTED: '@witnessed/disclaimer_accepted',
  DEVICE_ID: '@witnessed/device_id',
  RATE_LIMIT: '@witnessed/rate_limit',
} as const;

export const RATE_LIMIT = {
  MAX_CALLS_PER_DAY: 3,
} as const;

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export const CRISIS_RESOURCES = {
  LIFELINE: '988',
  CRISIS_TEXT: '741741',
  LIFELINE_URL: 'tel:988',
  CRISIS_TEXT_URL: 'sms:741741',
} as const;

export const MOOD_LABELS: Record<number, string> = {
  1: 'Really struggling',
  2: 'Not great',
  3: 'Okay',
  4: 'Pretty good',
  5: 'Really good',
};

export const TONE_LABELS: Record<string, string> = {
  vent: 'I need to vent',
  clarity: 'I want clarity',
  action_steps: "I'm looking for what to do next",
};
