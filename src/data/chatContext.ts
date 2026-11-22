import { getSchoolingLabel } from './educationModules';
import { calculateAgeFromBirthDate } from '../services/userProfileService';
import type {
  ChatTemporalContext,
  ChatUserContext,
  MiauMood,
  UserHumanProfile,
} from '../types';

const WEEKDAY_NAMES_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export type PeriodOfDay = 'madrugada' | 'manhã' | 'tarde' | 'noite';

export interface ConversationContextSnapshot {
  temporal: ChatTemporalContext;
  user: ChatUserContext;
}

export function getPeriodOfDay(hour: number): PeriodOfDay {
  if (hour >= 0 && hour < 5) return 'madrugada';
  if (hour >= 5 && hour < 12) return 'manhã';
  if (hour >= 12 && hour < 18) return 'tarde';
  return 'noite';
}

export function buildConversationContextSnapshot(
  humanProfile: UserHumanProfile,
  now = new Date()
): ConversationContextSnapshot {
  const weekdayIndex = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const firstName = humanProfile.fullName.trim().split(/\s+/)[0] || '';
  const age = calculateAgeFromBirthDate(humanProfile.birthDate);
  const schoolingLabel = humanProfile.schooling
    ? getSchoolingLabel(humanProfile.schooling)
    : '';

  return {
    temporal: {
      weekdayIndex,
      weekdayName: WEEKDAY_NAMES_PT[weekdayIndex] || 'hoje',
      isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
      periodOfDay: getPeriodOfDay(hour),
      timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      dateKey: `${yyyy}-${mm}-${dd}`,
    },
    user: {
      firstName,
      age,
      schooling: humanProfile.schooling || '',
      schoolingLabel,
    },
  };
}

function isSchoolAgeUser(user: ChatUserContext): boolean {
  if (
    user.schooling === 'educacao_infantil' ||
    user.schooling === 'fundamental_1' ||
    user.schooling === 'fundamental_2' ||
    user.schooling === 'medio'
  ) {
    return true;
  }
  return user.age !== null && user.age >= 4 && user.age <= 18;
}

export function buildContextualGreeting(
  snapshot: ConversationContextSnapshot,
  petName = 'Miau'
): { meowPrefix: string; text: string; mood: MiauMood } {
  const { temporal, user } = snapshot;
  const nameSuffix = user.firstName ? `, ${user.firstName}` : '';
  const schoolAge = isSchoolAgeUser(user);

  if (temporal.weekdayIndex === 1 && temporal.periodOfDay === 'manhã') {
    if (schoolAge) {
      return {
        meowPrefix: 'Bom dia! ☀️🐾',
        text: `(Bom dia${nameSuffix}! Segunda-feira começou cheia de energia! Desejo uma ótima aula e um dia maravilhoso na escola hoje — depois me conta o que aprendeu!)`,
        mood: 'happy',
      };
    }
    return {
      meowPrefix: 'Bom dia! ☀️',
      text: `(Bom dia${nameSuffix}! Começando a segunda-feira com o pé direito! Como você está se sentindo hoje? Estou aqui com o ${petName} para te animar!)`,
      mood: 'happy',
    };
  }

  if (temporal.weekdayIndex === 6 && temporal.periodOfDay === 'tarde') {
    return {
      meowPrefix: 'Purrr~ 🎬💖',
      text: `(Boa tarde${nameSuffix}! Que delícia de sábado! Como você está se sentindo hoje? Que tal descansar um pouquinho, ver um filme legal em casa ou curtir um cinema?)`,
      mood: 'affectionate',
    };
  }

  if (temporal.weekdayIndex === 6 && temporal.periodOfDay === 'noite') {
    return {
      meowPrefix: 'Miau~ 🌙✨',
      text: `(Boa noite de sábado${nameSuffix}! Tudo bem com você? Já pensou em assistir a um filme gostoso com pipoca ou bater um papo comigo?)`,
      mood: 'affectionate',
    };
  }

  if (temporal.weekdayIndex === 0) {
    return {
      meowPrefix: 'Purrr~ 🌈',
      text: `(Feliz domingo${nameSuffix}! Como está o seu coração hoje? Que tal recarregar as energias e aproveitar o dia bem tranquilo?)`,
      mood: 'affectionate',
    };
  }

  if (temporal.weekdayIndex === 5 && temporal.periodOfDay === 'tarde') {
    return {
      meowPrefix: 'Miau!! 🎉',
      text: `(Sextou${nameSuffix}! A semana está quase no fim — como você está se sentindo hoje depois das suas atividades?)`,
      mood: 'playful',
    };
  }

  if (temporal.periodOfDay === 'manhã') {
    if (schoolAge) {
      return {
        meowPrefix: 'Bom dia! 🌸',
        text: `(Bom dia${nameSuffix}! Hoje é ${temporal.weekdayName}. Espero que seus estudos estejam leves e divertidos! Como você está se sentindo?)`,
        mood: 'happy',
      };
    }
    return {
      meowPrefix: 'Bom dia! ☀️',
      text: `(Bom dia${nameSuffix}! Que esta ${temporal.weekdayName} seja leve e especial para você! Sobre o que quer conversar comigo?)`,
      mood: 'happy',
    };
  }

  if (temporal.periodOfDay === 'tarde') {
    return {
      meowPrefix: 'Miau! 🌤️',
      text: `(Boa tarde${nameSuffix}! Como está sendo a sua ${temporal.weekdayName}? Se quiser desabafar, contar novidades ou brincar, estou aqui!)`,
      mood: 'affectionate',
    };
  }

  return {
    meowPrefix: 'Purrr~ 🌙',
    text: `(Boa noite${nameSuffix}! Espero que sua ${temporal.weekdayName} tenha sido ótima! Como você está se sentindo agora à noite?)`,
    mood: 'affectionate',
  };
}
