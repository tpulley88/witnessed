import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AIResponse, JournalEntry } from '../types';

export type RootStackParamList = {
  Onboarding: undefined;
  Journal: undefined;
  Response: { response: AIResponse; entry: JournalEntry };
};

export type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
export type JournalScreenProps = NativeStackScreenProps<RootStackParamList, 'Journal'>;
export type ResponseScreenProps = NativeStackScreenProps<RootStackParamList, 'Response'>;
