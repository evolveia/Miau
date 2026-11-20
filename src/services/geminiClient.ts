import type { ChatMessage, EquippedItems, MiauMood, PetStats } from '../types';

export interface MiauChatResponse {
  meowPrefix: string;
  text: string;
  mood: MiauMood;
}

export async function askMiau(params: {
  message: string;
  history: ChatMessage[];
  stats: PetStats;
  equipped: EquippedItems;
  petName: string;
}): Promise<MiauChatResponse> {
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      history: params.history.map((m) => ({
        sender: m.sender,
        text: `${m.meowPrefix} ${m.text}`.trim(),
      })),
      stats: params.stats,
      equipped: params.equipped,
      petName: params.petName,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao conversar com o Miau.');
  }
  return {
    meowPrefix: data.meowPrefix || 'Miau!',
    text: data.text || '(Oi, humano!)',
    mood: (data.mood || 'happy') as MiauMood,
  };
}

export async function synthesizeMiauVoice(
  text: string
): Promise<{ audioBase64: string; mimeType: string }> {
  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao gerar voz do Miau.');
  }
  return data;
}

export async function transcribeUserAudio(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const res = await fetch('/api/gemini/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao transcrever áudio.');
  }
  return data.transcript || '';
}
