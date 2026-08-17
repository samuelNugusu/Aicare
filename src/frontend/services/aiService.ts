export type AIProvider = 'gemini' | 'openai';

const API_KEY_STORAGE_KEY = 'aicare_gemini_key';

export function getStoredApiKey(): string {
  try {
    return (localStorage.getItem(API_KEY_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  try {
    if (key && key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {}
}

export async function analyzeLabResult(
  input: { text?: string; base64Image?: string }, 
  provider: AIProvider = 'gemini',
  overrideKey?: string
) {
  const key = overrideKey || getStoredApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['x-gemini-key'] = key;

  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers,
    body: JSON.stringify({ input, provider, key })
  });
  
  if (!response.ok) {
    let errorMsg = 'AI analysis failed';
    try {
      const errData = await response.json();
      errorMsg = errData.error || errData.message || errorMsg;
    } catch {
      const errText = await response.text();
      errorMsg = errText || errorMsg;
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

export async function getHealthAssistantResponse(
  history: { role: 'user' | 'model' | 'assistant'; content: string }[], 
  message: string, 
  base64Image?: string,
  provider: AIProvider = 'gemini',
  overrideKey?: string
) {
  const key = overrideKey || getStoredApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['x-gemini-key'] = key;

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ history, message, base64Image, provider, key })
  });

  if (!response.ok) {
    let errorMsg = 'AI chat failed';
    try {
      const errData = await response.json();
      errorMsg = errData.error || errData.message || errorMsg;
    } catch {
      const errText = await response.text();
      errorMsg = errText || errorMsg;
    }
    throw new Error(errorMsg);
  }
  const data = await response.json();
  return data.result;
}

export interface DiagnosticResult {
  timestamp: string;
  hasKey: boolean;
  maskedKey: string;
  keyLength: number;
  hasStandardPrefix: boolean;
  success: boolean;
  latencyMs: number;
  activeModel: string | null;
  testResponseSnippet: string | null;
  modelResults: Array<{
    model: string;
    success: boolean;
    statusCode?: number | string;
    errorMessage?: string;
  }>;
  diagnostics: string[];
}

export async function runGeminiDiagnostics(overrideKey?: string): Promise<DiagnosticResult> {
  const key = overrideKey !== undefined ? overrideKey : getStoredApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['x-gemini-key'] = key;

  const response = await fetch('/api/ai/diagnose', {
    method: 'POST',
    headers,
    body: JSON.stringify({ key })
  });

  if (!response.ok) {
    let errorMsg = `Diagnostics request failed with HTTP ${response.status}`;
    try {
      const errData = await response.json();
      errorMsg = errData.error || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}


