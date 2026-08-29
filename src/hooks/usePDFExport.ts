import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { AIResponse, JournalEntry } from '../types';

// Dynamic imports to gracefully fail before expo-print/expo-sharing are installed
let Print: any = null;
let Sharing: any = null;
try {
  Print = require('expo-print');
  Sharing = require('expo-sharing');
} catch {
  // not available
}

function buildHTML(response: AIResponse, entry: JournalEntry): string {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const emotions = response.emotional_analysis.primary_emotions.join(', ') || 'Not identified';
  const questions = response.reflective_questions.map(q => `<li>${q}</li>`).join('');
  const nextSteps = [
    response.next_steps.mental && `<li><strong>To consider:</strong> ${response.next_steps.mental}</li>`,
    response.next_steps.emotional && `<li><strong>To feel:</strong> ${response.next_steps.emotional}</li>`,
    response.next_steps.physical && `<li><strong>In your body:</strong> ${response.next_steps.physical}</li>`,
  ].filter(Boolean).join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Georgia, serif; color: #1C1410; background: #F5F2EE; padding: 40px; max-width: 600px; margin: 0 auto; }
  h1 { font-size: 28px; color: #C4704A; margin-bottom: 4px; }
  .date { color: #9C8B7E; font-size: 14px; margin-bottom: 32px; }
  .section { margin-bottom: 24px; border-left: 3px solid #E8E0D8; padding-left: 16px; }
  .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #9C8B7E; margin-bottom: 8px; }
  .section-body { font-size: 16px; line-height: 1.7; }
  .entry-text { font-style: italic; color: #6B5B4E; }
  ul { padding-left: 20px; }
  li { margin-bottom: 8px; line-height: 1.6; }
  .disclaimer { font-size: 12px; color: #9C8B7E; margin-top: 40px; border-top: 1px solid #E8E0D8; padding-top: 16px; }
</style>
</head>
<body>
  <h1>Witnessed</h1>
  <div class="date">${date}</div>

  <div class="section">
    <div class="section-title">What you shared</div>
    <div class="section-body entry-text">${entry.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  </div>

  <div class="section">
    <div class="section-title">What we heard</div>
    <div class="section-body">${response.summary}</div>
  </div>

  <div class="section">
    <div class="section-title">What we hear in that</div>
    <div class="section-body">${response.emotional_validation}</div>
    <div class="section-body" style="margin-top: 8px; font-size: 14px; color: #6B5B4E;">Emotions: ${emotions}</div>
  </div>

  ${questions ? `<div class="section">
    <div class="section-title">Questions worth sitting with</div>
    <ul>${questions}</ul>
  </div>` : ''}

  ${nextSteps ? `<div class="section">
    <div class="section-title">If you want to do something</div>
    <ul>${nextSteps}</ul>
  </div>` : ''}

  <div class="disclaimer">
    AI-generated reflection · Not clinical advice · If you're in crisis, call or text 988.
    ${response.disclaimer ? `<br><br>${response.disclaimer}` : ''}
  </div>
</body>
</html>`;
}

function buildPlainText(response: AIResponse, entry: JournalEntry): string {
  const date = new Date().toLocaleDateString();
  const lines = [
    `WITNESSED — ${date}`,
    '',
    '— What you shared —',
    entry.text,
    '',
    '— What we heard —',
    response.summary,
    '',
    '— What we hear in that —',
    response.emotional_validation,
  ];
  if (response.reflective_questions.length > 0) {
    lines.push('', '— Questions worth sitting with —');
    response.reflective_questions.forEach(q => lines.push(`• ${q}`));
  }
  const steps = [response.next_steps.mental, response.next_steps.emotional, response.next_steps.physical].filter(Boolean);
  if (steps.length > 0) {
    lines.push('', '— If you want to do something —');
    steps.forEach(s => lines.push(`• ${s}`));
  }
  lines.push('', 'AI-generated reflection · Not clinical advice · 988 if in crisis');
  return lines.join('\n');
}

interface UsePDFExportResult {
  exportAsPDF: (response: AIResponse, entry: JournalEntry) => Promise<void>;
  exportAsText: (response: AIResponse, entry: JournalEntry) => Promise<void>;
  isAvailable: boolean;
  isExporting: boolean;
}

export function usePDFExport(): UsePDFExportResult {
  const isAvailable = Print !== null && Sharing !== null;
  const [isExporting, setIsExporting] = useState(false);

  const exportAsPDF = useCallback(async (response: AIResponse, entry: JournalEntry) => {
    if (!Print || !Sharing) return;
    setIsExporting(true);
    try {
      const html = buildHTML(response, entry);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save your reflection' });
      }
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportAsText = useCallback(async (response: AIResponse, entry: JournalEntry) => {
    if (!Sharing) return;
    setIsExporting(true);
    try {
      const FileSystem = require('expo-file-system');
      const text = buildPlainText(response, entry);
      const fileUri = FileSystem.documentDirectory + 'witnessed-reflection.txt';
      await FileSystem.writeAsStringAsync(fileUri, text, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Save your reflection' });
      }
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportAsPDF, exportAsText, isAvailable, isExporting };
}
