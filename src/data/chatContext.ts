import { getSchoolingLabel } from './educationModules';
import { calculateAgeFromBirthDate } from '../services/userProfileService';
import type {
  ChatTemporalContext,
  ChatUserContext,
  MiauMood,
  PetStats,
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

export function buildFriendGreeting(
  snapshot: ConversationContextSnapshot,
  petName = 'Miau'
): { meowPrefix: string; text: string; mood: MiauMood } {
  const { temporal, user } = snapshot;
  const nameSuffix = user.firstName ? `, ${user.firstName}` : '';
  const schoolAge = isSchoolAgeUser(user);

  if (temporal.periodOfDay === 'manhã') {
    return {
      meowPrefix: 'Oi, amigo(a)! ☀️💛',
      text: schoolAge
        ? `(Oi${nameSuffix}! Que bom conversar com você! Como você está se sentindo nesta ${temporal.weekdayName}? Me conta por áudio ou na caixinha como estão as coisas e a escola!)`
        : `(Oi${nameSuffix}! Estava esperando esse nosso papo! Como você acordou hoje? Pode falar por áudio ou escrever aqui na caixa — quero muito saber como você está!)`,
      mood: 'affectionate',
    };
  }

  if (temporal.periodOfDay === 'tarde') {
    return {
      meowPrefix: 'Miau, amigo(a)! 💬✨',
      text: temporal.isWeekend
        ? `(Oi${nameSuffix}! Que bom ter um tempinho nosso nesta tarde de ${temporal.weekdayName}! Como você está se sentindo hoje? Fala comigo por áudio ou texto!)`
        : `(Oi${nameSuffix}! Como está sendo o seu dia até agora? Quero saber como você está de verdade — me manda um áudio ou escreve aqui para o ${petName}!)`,
      mood: 'affectionate',
    };
  }

  return {
    meowPrefix: 'Purrr~ 🌙💜',
    text: `(Oi${nameSuffix}! Que bom conversar com você agora à noite! Como foi o seu dia e como você está se sentindo? Pode desabafar por áudio ou escrever aqui!)`,
    mood: 'affectionate',
  };
}

export function buildMainScreenCheckIn(
  snapshot: ConversationContextSnapshot,
  stats: PetStats,
  petName = 'Miau',
  stepIndex = 0
): { meowPrefix: string; text: string; mood: MiauMood } {
  const { temporal, user } = snapshot;
  const nameSuffix = user.firstName ? `, ${user.firstName}` : '';
  const schoolAge = isSchoolAgeUser(user);

  if (stats.hunger < 25) {
    return {
      meowPrefix: 'Miau... 🐟',
      text: `(Oi${nameSuffix}! Minha barriguinha deu uma roncada leve... mas me conta, você já comeu alguma coisa gostosa hoje?)`,
      mood: 'hungry',
    };
  }
  if (stats.sleep < 25) {
    return {
      meowPrefix: 'Miau~ 😴',
      text: `(Estou ficando com soninho${nameSuffix}... e você, conseguiu descansar bem hoje?)`,
      mood: 'sleepy',
    };
  }
  if (stats.hygiene < 25) {
    return {
      meowPrefix: 'Purrr~ 🫧',
      text: `(Acho que já cabe um banho cheiroso depois, né${nameSuffix}? Como você está se sentindo agora?)`,
      mood: 'happy',
    };
  }

  const prompts: Array<{ meowPrefix: string; text: string; mood: MiauMood }> = [
    {
      meowPrefix: 'Miau! 👋💛',
      text: `(Ei${nameSuffix}, tudo bem por aí? Como você está se sentindo nesta ${temporal.periodOfDay}? Clica em Conversar para batermos um papo!)`,
      mood: 'affectionate',
    },
    {
      meowPrefix: 'Purrr~ 💬',
      text: schoolAge
        ? `(Oi${nameSuffix}! Como foram suas aulas ou tarefas hoje? O ${petName} adora ouvir suas novidades!)`
        : `(Oi${nameSuffix}! Que bom ter você aqui na Sala de Estar! Quer me contar como está sendo o seu dia?)`,
      mood: 'happy',
    },
    {
      meowPrefix: 'Miau~ 🌟',
      text: `(Faz um carinho em mim ou toca no microfone para conversarmos por áudio! Quero saber como você está!)`,
      mood: 'playful',
    },
    {
      meowPrefix: 'Purrr~ 💕',
      text: temporal.isWeekend
        ? `(Bom fim de semana${nameSuffix}! O que você está aprontando de legal hoje para descansar e se divertir?)`
        : `(Passando só para dar um abraço virtual${nameSuffix}! Se quiser desabafar ou rir um pouco, estou aqui!)`,
      mood: 'affectionate',
    },
  ];

  return prompts[Math.abs(stepIndex) % prompts.length];
}
