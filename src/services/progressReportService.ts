import { EARLY_LITERACY_UNITS } from '../data/earlyLiteracyData';
import { CONSONANT_UNITS } from '../modules/consonants/data';
import { loadConsonantsProgress } from '../modules/consonants/consonantsEngine';
import { ADICAO_SUBTRACAO_CONFIG } from '../modules/themed/adicaoSubtracaoData';
import { ANIMAIS_NATUREZA_CONFIG } from '../modules/themed/animaisNaturezaData';
import { COMIDAS_BEBIDAS_CONFIG } from '../modules/themed/comidasBebidasData';
import { CORES_FORMAS_CONFIG } from '../modules/themed/coresFormasData';
import { FUND1_CIENCIAS_CONFIG } from '../modules/themed/fund1CienciasData';
import { FUND1_LEITURA_CONFIG } from '../modules/themed/fund1LeituraData';
import { FUND1_MATEMATICA_CONFIG } from '../modules/themed/fund1MatematicaData';
import { FUND2_CIENCIAS_CONFIG } from '../modules/themed/fund2CienciasData';
import { FUND2_HISTORIA_CONFIG } from '../modules/themed/fund2HistoriaData';
import { FUND2_LOGICA_CONFIG } from '../modules/themed/fund2LogicaData';
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
  const f1Leitura = loadThemedProgress(FUND1_LEITURA_CONFIG, safeOwner);
  const f1Math = loadThemedProgress(FUND1_MATEMATICA_CONFIG, safeOwner);
  const f1Cien = loadThemedProgress(FUND1_CIENCIAS_CONFIG, safeOwner);
  const f2Logica = loadThemedProgress(FUND2_LOGICA_CONFIG, safeOwner);
  const f2Cien = loadThemedProgress(FUND2_CIENCIAS_CONFIG, safeOwner);
  const f2Hist = loadThemedProgress(FUND2_HISTORIA_CONFIG, safeOwner);

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
    {
      trackId: 'fund1_leitura',
      title: 'Leitura Mágica e Interpretação',
      emoji: '📖',
      category: 'letras_escrita',
      accentGradient: 'from-sky-400 to-indigo-500',
      completedUnits: f1Leitura.completedUnits.length,
      totalUnits: FUND1_LEITURA_CONFIG.units.length,
      progressPct: calcPct(
        f1Leitura.completedUnits.length,
        FUND1_LEITURA_CONFIG.units.length
      ),
      stars: f1Leitura.totalStars,
      maxStars: FUND1_LEITURA_CONFIG.units.length * 3,
      lessonsCompleted: f1Leitura.totalLessonsCompleted,
      masteredCount: f1Leitura.masteredTags.length,
      masteredTotal: FUND1_LEITURA_CONFIG.masteryItems.length,
      masteredLabel: `${f1Leitura.masteredTags.length}/${FUND1_LEITURA_CONFIG.masteryItems.length} leituras`,
      streakDays: f1Leitura.streakDays,
    },
    {
      trackId: 'fund1_matematica',
      title: 'Tabuada e Desafios de Soma',
      emoji: '🧮',
      category: 'matematica_cores',
      accentGradient: 'from-amber-400 to-orange-500',
      completedUnits: f1Math.completedUnits.length,
      totalUnits: FUND1_MATEMATICA_CONFIG.units.length,
      progressPct: calcPct(
        f1Math.completedUnits.length,
        FUND1_MATEMATICA_CONFIG.units.length
      ),
      stars: f1Math.totalStars,
      maxStars: FUND1_MATEMATICA_CONFIG.units.length * 3,
      lessonsCompleted: f1Math.totalLessonsCompleted,
      masteredCount: f1Math.masteredTags.length,
      masteredTotal: FUND1_MATEMATICA_CONFIG.masteryItems.length,
      masteredLabel: `${f1Math.masteredTags.length}/${FUND1_MATEMATICA_CONFIG.masteryItems.length} tabuadas`,
      streakDays: f1Math.streakDays,
    },
    {
      trackId: 'fund1_ciencias',
      title: 'Planeta Terra e Biomas do Brasil',
      emoji: '🌎',
      category: 'mundo_saude',
      accentGradient: 'from-emerald-400 to-cyan-500',
      completedUnits: f1Cien.completedUnits.length,
      totalUnits: FUND1_CIENCIAS_CONFIG.units.length,
      progressPct: calcPct(
        f1Cien.completedUnits.length,
        FUND1_CIENCIAS_CONFIG.units.length
      ),
      stars: f1Cien.totalStars,
      maxStars: FUND1_CIENCIAS_CONFIG.units.length * 3,
      lessonsCompleted: f1Cien.totalLessonsCompleted,
      masteredCount: f1Cien.masteredTags.length,
      masteredTotal: FUND1_CIENCIAS_CONFIG.masteryItems.length,
      masteredLabel: `${f1Cien.masteredTags.length}/${FUND1_CIENCIAS_CONFIG.masteryItems.length} biomas`,
      streakDays: f1Cien.streakDays,
    },
    {
      trackId: 'fund2_logica',
      title: 'Lógica, Frações e Equações',
      emoji: '📐',
      category: 'matematica_cores',
      accentGradient: 'from-violet-400 to-purple-600',
      completedUnits: f2Logica.completedUnits.length,
      totalUnits: FUND2_LOGICA_CONFIG.units.length,
      progressPct: calcPct(
        f2Logica.completedUnits.length,
        FUND2_LOGICA_CONFIG.units.length
      ),
      stars: f2Logica.totalStars,
      maxStars: FUND2_LOGICA_CONFIG.units.length * 3,
      lessonsCompleted: f2Logica.totalLessonsCompleted,
      masteredCount: f2Logica.masteredTags.length,
      masteredTotal: FUND2_LOGICA_CONFIG.masteryItems.length,
      masteredLabel: `${f2Logica.masteredTags.length}/${FUND2_LOGICA_CONFIG.masteryItems.length} conceitos`,
      streakDays: f2Logica.streakDays,
    },
    {
      trackId: 'fund2_ciencias',
      title: 'Corpo Humano, Energia e Universo',
      emoji: '🔬',
      category: 'mundo_saude',
      accentGradient: 'from-cyan-400 to-indigo-500',
      completedUnits: f2Cien.completedUnits.length,
      totalUnits: FUND2_CIENCIAS_CONFIG.units.length,
      progressPct: calcPct(
        f2Cien.completedUnits.length,
        FUND2_CIENCIAS_CONFIG.units.length
      ),
      stars: f2Cien.totalStars,
      maxStars: FUND2_CIENCIAS_CONFIG.units.length * 3,
      lessonsCompleted: f2Cien.totalLessonsCompleted,
      masteredCount: f2Cien.masteredTags.length,
      masteredTotal: FUND2_CIENCIAS_CONFIG.masteryItems.length,
      masteredLabel: `${f2Cien.masteredTags.length}/${FUND2_CIENCIAS_CONFIG.masteryItems.length} temas`,
      streakDays: f2Cien.streakDays,
    },
    {
      trackId: 'fund2_historia',
      title: 'História, Cultura e Cidadania',
      emoji: '🏛️',
      category: 'mundo_saude',
      accentGradient: 'from-amber-400 to-rose-500',
      completedUnits: f2Hist.completedUnits.length,
      totalUnits: FUND2_HISTORIA_CONFIG.units.length,
      progressPct: calcPct(
        f2Hist.completedUnits.length,
        FUND2_HISTORIA_CONFIG.units.length
      ),
      stars: f2Hist.totalStars,
      maxStars: FUND2_HISTORIA_CONFIG.units.length * 3,
      lessonsCompleted: f2Hist.totalLessonsCompleted,
      masteredCount: f2Hist.masteredTags.length,
      masteredTotal: FUND2_HISTORIA_CONFIG.masteryItems.length,
      masteredLabel: `${f2Hist.masteredTags.length}/${FUND2_HISTORIA_CONFIG.masteryItems.length} épocas`,
      streakDays: f2Hist.streakDays,
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

export function getStrongestAndWeakestModules(
  report: EducationProgressReport
): {
  strongest: ModuleProgressItem[];
  needsReinforcement: ModuleProgressItem[];
} {
  const attempted = report.modules.filter(
    (m) => m.completedUnits > 0 || m.lessonsCompleted > 0 || m.stars > 0
  );
  if (attempted.length === 0) {
    return {
      strongest: [],
      needsReinforcement: report.modules.slice(0, 3),
    };
  }
  const starRatio = (m: ModuleProgressItem) =>
    m.maxStars > 0 ? m.stars / m.maxStars : 0;
  const strongest = [...attempted]
    .sort((a, b) => b.progressPct - a.progressPct || starRatio(b) - starRatio(a))
    .slice(0, 3);
  const needsReinforcement = [...report.modules]
    .sort((a, b) => {
      const aScore = a.completedUnits === 0 ? 0.5 : starRatio(a);
      const bScore = b.completedUnits === 0 ? 0.5 : starRatio(b);
      return aScore - bScore || a.progressPct - b.progressPct;
    })
    .filter((m) => !strongest.some((s) => s.trackId === m.trackId) || m.progressPct < 100)
    .slice(0, 3);
  return { strongest, needsReinforcement };
}
