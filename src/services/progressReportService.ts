import { EARLY_LITERACY_UNITS } from '../data/earlyLiteracyData';
import { CONSONANT_UNITS } from '../modules/consonants/data';
import { loadConsonantsProgress } from '../modules/consonants/consonantsEngine';
import { ADICAO_SUBTRACAO_CONFIG } from '../modules/themed/adicaoSubtracaoData';
import { ANIMAIS_NATUREZA_CONFIG } from '../modules/themed/animaisNaturezaData';
import { COMIDAS_BEBIDAS_CONFIG } from '../modules/themed/comidasBebidasData';
import { CORES_FORMAS_CONFIG } from '../modules/themed/coresFormasData';
import { LOGICA_MATEMATICA_CONFIG } from '../modules/themed/logicaMatematicaData';
import { loadThemedProgress } from '../modules/themed/themedEngine';
import {
  WRITING_CONSONANTS_UNITS,
  WRITING_UNITS,
} from '../modules/writing/data';
import {
  CONSONANTS_WRITING_CONFIG,
  VOWELS_WRITING_CONFIG,
  getWritingLetterStarsTotal,
  loadWritingProgress,
} from '../modules/writing/writingEngine';
import { loadEarlyLiteracyProgress } from './phonicsEngineService';

export type ProgressReportCategory =
  | 'letras_escrita'
  | 'matematica_cores'
  | 'mundo_saude';

export interface ModuleProgressItem {
  trackId: string;
  title: string;
  emoji: string;
  category: ProgressReportCategory;
  accentGradient: string;
  completedUnits: number;
  totalUnits: number;
  progressPct: number;
  stars: number;
  maxStars: number;
  lessonsCompleted: number;
  masteredCount: number;
  masteredTotal: number;
  masteredLabel: string;
  streakDays: number;
}

export interface EducationProgressReport {
  modules: ModuleProgressItem[];
  totalCompletedUnits: number;
  totalUnits: number;
  overallPct: number;
  totalStars: number;
  totalLessonsCompleted: number;
  maxStreakDays: number;
  completedModulesCount: number;
}

export function buildEducationProgressReport(
  ownerId = 'guest'
): EducationProgressReport {
  const safeOwner = ownerId || 'guest';

  const literacy = loadEarlyLiteracyProgress(safeOwner);
  const writingVowels = loadWritingProgress(safeOwner, VOWELS_WRITING_CONFIG);
  const writingConsonants = loadWritingProgress(
    safeOwner,
    CONSONANTS_WRITING_CONFIG
  );
  const consonants = loadConsonantsProgress(safeOwner);
  const cores = loadThemedProgress(CORES_FORMAS_CONFIG, safeOwner);
  const soma = loadThemedProgress(ADICAO_SUBTRACAO_CONFIG, safeOwner);
  const logica = loadThemedProgress(LOGICA_MATEMATICA_CONFIG, safeOwner);
  const natureza = loadThemedProgress(ANIMAIS_NATUREZA_CONFIG, safeOwner);
  const comidas = loadThemedProgress(COMIDAS_BEBIDAS_CONFIG, safeOwner);

  const calcPct = (done: number, total: number) =>
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  const modules: ModuleProgressItem[] = [
    {
      trackId: 'infantil_letras',
      title: 'Vogais e Primeiras Palavras',
      emoji: '🔤',
      category: 'letras_escrita',
      accentGradient: 'from-pink-400 to-rose-500',
      completedUnits: literacy.completedUnits.length,
      totalUnits: EARLY_LITERACY_UNITS.length,
      progressPct: calcPct(
        literacy.completedUnits.length,
        EARLY_LITERACY_UNITS.length
      ),
      stars: literacy.totalStars,
      maxStars: EARLY_LITERACY_UNITS.length * 3,
      lessonsCompleted: literacy.totalLessonsCompleted,
      masteredCount: literacy.masteredVowels.length,
      masteredTotal: 5,
      masteredLabel: `${literacy.masteredVowels.length}/5 vogais`,
      streakDays: literacy.streakDays,
    },
    {
      trackId: 'infantil_escrita',
      title: 'Vamos Escrever',
      emoji: '✍️',
      category: 'letras_escrita',
      accentGradient: 'from-purple-400 to-indigo-500',
      completedUnits: writingVowels.completedUnits.length,
      totalUnits: WRITING_UNITS.length,
      progressPct: calcPct(
        writingVowels.completedUnits.length,
        WRITING_UNITS.length
      ),
      stars:
        writingVowels.totalStars + getWritingLetterStarsTotal(writingVowels),
      maxStars: WRITING_UNITS.length * 3,
      lessonsCompleted: writingVowels.totalPracticesCompleted,
      masteredCount: writingVowels.masteredTargets.length,
      masteredTotal: 15,
      masteredLabel: `${writingVowels.masteredVowels.length}/5 vogais escritas`,
      streakDays: writingVowels.streakDays,
    },
    {
      trackId: 'infantil_escrita_consoantes',
      title: 'Escrevendo as Consoantes',
      emoji: '🖍️',
      category: 'letras_escrita',
      accentGradient: 'from-fuchsia-400 to-purple-600',
      completedUnits: writingConsonants.completedUnits.length,
      totalUnits: WRITING_CONSONANTS_UNITS.length,
      progressPct: calcPct(
        writingConsonants.completedUnits.length,
        WRITING_CONSONANTS_UNITS.length
      ),
      stars:
        writingConsonants.totalStars +
        getWritingLetterStarsTotal(writingConsonants),
      maxStars: WRITING_CONSONANTS_UNITS.length * 3,
      lessonsCompleted: writingConsonants.totalPracticesCompleted,
      masteredCount: writingConsonants.masteredConsonants.length,
      masteredTotal: 21,
      masteredLabel: `${writingConsonants.masteredConsonants.length}/21 consoantes traçadas`,
      streakDays: writingConsonants.streakDays,
    },
    {
      trackId: 'infantil_consoantes',
      title: 'As Consoantes',
      emoji: '🧩',
      category: 'letras_escrita',
      accentGradient: 'from-violet-400 to-fuchsia-500',
      completedUnits: consonants.completedUnits.length,
      totalUnits: CONSONANT_UNITS.length,
      progressPct: calcPct(
        consonants.completedUnits.length,
        CONSONANT_UNITS.length
      ),
      stars: consonants.totalStars,
      maxStars: CONSONANT_UNITS.length * 3,
      lessonsCompleted: consonants.totalLessonsCompleted,
      masteredCount: consonants.masteredConsonants.length,
      masteredTotal: 21,
      masteredLabel: `${consonants.masteredConsonants.length}/21 consoantes`,
      streakDays: consonants.streakDays,
    },
    {
      trackId: 'infantil_cores_numeros',
      title: 'Cores, Formas e Contagem',
      emoji: '🎨',
      category: 'matematica_cores',
      accentGradient: 'from-amber-400 to-orange-500',
      completedUnits: cores.completedUnits.length,
      totalUnits: CORES_FORMAS_CONFIG.units.length,
      progressPct: calcPct(
        cores.completedUnits.length,
        CORES_FORMAS_CONFIG.units.length
      ),
      stars: cores.totalStars,
      maxStars: CORES_FORMAS_CONFIG.units.length * 3,
      lessonsCompleted: cores.totalLessonsCompleted,
      masteredCount: cores.masteredTags.length,
      masteredTotal: CORES_FORMAS_CONFIG.masteryItems.length,
      masteredLabel: `${cores.masteredTags.length}/${CORES_FORMAS_CONFIG.masteryItems.length} temas`,
      streakDays: cores.streakDays,
    },
    {
      trackId: 'infantil_soma_subtracao',
      title: 'Somar e Subtrair com o Miau',
      emoji: '➕',
      category: 'matematica_cores',
      accentGradient: 'from-emerald-400 to-sky-500',
      completedUnits: soma.completedUnits.length,
      totalUnits: ADICAO_SUBTRACAO_CONFIG.units.length,
      progressPct: calcPct(
        soma.completedUnits.length,
        ADICAO_SUBTRACAO_CONFIG.units.length
      ),
      stars: soma.totalStars,
      maxStars: ADICAO_SUBTRACAO_CONFIG.units.length * 3,
      lessonsCompleted: soma.totalLessonsCompleted,
      masteredCount: soma.masteredTags.length,
      masteredTotal: ADICAO_SUBTRACAO_CONFIG.masteryItems.length,
      masteredLabel: `${soma.masteredTags.length}/${ADICAO_SUBTRACAO_CONFIG.masteryItems.length} habilidades`,
      streakDays: soma.streakDays,
    },
    {
      trackId: 'infantil_matematica_desafios',
      title: 'Comparação, Dobro e Probleminhas',
      emoji: '🧮',
      category: 'matematica_cores',
      accentGradient: 'from-indigo-400 to-rose-500',
      completedUnits: logica.completedUnits.length,
      totalUnits: LOGICA_MATEMATICA_CONFIG.units.length,
      progressPct: calcPct(
        logica.completedUnits.length,
        LOGICA_MATEMATICA_CONFIG.units.length
      ),
      stars: logica.totalStars,
      maxStars: LOGICA_MATEMATICA_CONFIG.units.length * 3,
      lessonsCompleted: logica.totalLessonsCompleted,
      masteredCount: logica.masteredTags.length,
      masteredTotal: LOGICA_MATEMATICA_CONFIG.masteryItems.length,
      masteredLabel: `${logica.masteredTags.length}/${LOGICA_MATEMATICA_CONFIG.masteryItems.length} desafios`,
      streakDays: logica.streakDays,
    },
    {
      trackId: 'infantil_natureza',
      title: 'Animais e Natureza',
      emoji: '🦋',
      category: 'mundo_saude',
      accentGradient: 'from-emerald-400 to-teal-500',
      completedUnits: natureza.completedUnits.length,
      totalUnits: ANIMAIS_NATUREZA_CONFIG.units.length,
      progressPct: calcPct(
        natureza.completedUnits.length,
        ANIMAIS_NATUREZA_CONFIG.units.length
      ),
      stars: natureza.totalStars,
      maxStars: ANIMAIS_NATUREZA_CONFIG.units.length * 3,
      lessonsCompleted: natureza.totalLessonsCompleted,
      masteredCount: natureza.masteredTags.length,
      masteredTotal: ANIMAIS_NATUREZA_CONFIG.masteryItems.length,
      masteredLabel: `${natureza.masteredTags.length}/${ANIMAIS_NATUREZA_CONFIG.masteryItems.length} descobertas`,
      streakDays: natureza.streakDays,
    },
    {
      trackId: 'infantil_comidas_bebidas',
      title: 'Comidas e Bebidas',
      emoji: '🍓',
      category: 'mundo_saude',
      accentGradient: 'from-rose-400 to-orange-500',
      completedUnits: comidas.completedUnits.length,
      totalUnits: COMIDAS_BEBIDAS_CONFIG.units.length,
      progressPct: calcPct(
        comidas.completedUnits.length,
        COMIDAS_BEBIDAS_CONFIG.units.length
      ),
      stars: comidas.totalStars,
      maxStars: COMIDAS_BEBIDAS_CONFIG.units.length * 3,
      lessonsCompleted: comidas.totalLessonsCompleted,
      masteredCount: comidas.masteredTags.length,
      masteredTotal: COMIDAS_BEBIDAS_CONFIG.masteryItems.length,
      masteredLabel: `${comidas.masteredTags.length}/${COMIDAS_BEBIDAS_CONFIG.masteryItems.length} grupos`,
      streakDays: comidas.streakDays,
    },
  ];

  const totalCompletedUnits = modules.reduce(
    (sum, m) => sum + m.completedUnits,
    0
  );
  const totalUnits = modules.reduce((sum, m) => sum + m.totalUnits, 0);
  const overallPct = calcPct(totalCompletedUnits, totalUnits);
  const totalStars = modules.reduce((sum, m) => sum + m.stars, 0);
  const totalLessonsCompleted = modules.reduce(
    (sum, m) => sum + m.lessonsCompleted,
    0
  );
  const maxStreakDays = modules.reduce(
    (max, m) => Math.max(max, m.streakDays),
    0
  );
  const completedModulesCount = modules.filter(
    (m) => m.totalUnits > 0 && m.completedUnits >= m.totalUnits
  ).length;

  return {
    modules,
    totalCompletedUnits,
    totalUnits,
    overallPct,
    totalStars,
    totalLessonsCompleted,
    maxStreakDays,
    completedModulesCount,
  };
}
