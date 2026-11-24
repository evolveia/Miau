import type { EducationTrackDef, SchoolingLevel } from '../types';

export interface SchoolingOption {
  id: SchoolingLevel;
  label: string;
  ageHint: string;
  badgeColor: string;
}

export const SCHOOLING_OPTIONS: SchoolingOption[] = [
  {
    id: 'educacao_infantil',
    label: 'Educação Infantil',
    ageHint: 'Primeiras letras, cores, sons e coordenação',
    badgeColor: 'bg-pink-100 text-pink-800 border-pink-200',
  },
  {
    id: 'fundamental_1',
    label: 'Ensino Fundamental I',
    ageHint: '1º ao 5º ano • Leitura, contas e descobertas',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    id: 'fundamental_2',
    label: 'Ensino Fundamental II',
    ageHint: '6º ao 9º ano • Ciências, lógica e história',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'medio',
    label: 'Ensino Médio',
    ageHint: 'Redação, matemática aplicada, física e ENEM',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
  },
  {
    id: 'superior_outro',
    label: 'Ensino Superior / Outro',
    ageHint: 'Tecnologia, idiomas, carreira e curiosidades',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
];

export function getSchoolingLabel(level: SchoolingLevel | '' | undefined): string {
  if (!level) return 'Não informada';
  return SCHOOLING_OPTIONS.find((o) => o.id === level)?.label || 'Não informada';
}

export const EDUCATION_MODULES_BY_SCHOOLING: Record<
  SchoolingLevel,
  EducationTrackDef[]
> = {
  educacao_infantil: [
    {
      id: 'infantil_letras',
      title: 'Vogais & Primeiras Palavras',
      description: 'Método fônico com o Miau: sons das vogais, rimas, encontros vocálicos e primeiras palavras em 6 unidades.',
      emoji: '🔤',
      tags: ['Método Fônico', '6 Unidades', 'Áudio & Voz'],
      accentBg: 'from-pink-100 to-rose-100',
      statusLabel: 'Disponível agora • Toque para aprender',
    },
    {
      id: 'infantil_escrita',
      title: 'Vamos Escrever',
      description: 'A IA do Miau ensina o traçado de cada vogal e palavras fáceis para você cobrir com o dedo e treinar a coordenação motora fina.',
      emoji: '✍️',
      tags: ['Escrita Guiada', 'IA + Dedo', '7 Unidades'],
      accentBg: 'from-purple-100 to-indigo-100',
      statusLabel: 'Disponível agora • Toque para escrever',
    },
    {
      id: 'infantil_consoantes',
      title: 'As Consoantes',
      description: 'Todas as 21 consoantes do B ao Z em ordem alfabética com método fônico, sílabas iniciais, rimas e voz do Miau.',
      emoji: '🧩',
      tags: ['Ordem Alfabética', 'B ao Z', '7 Unidades'],
      accentBg: 'from-violet-100 to-fuchsia-100',
      statusLabel: 'Disponível agora • Toque para aprender',
    },
    {
      id: 'infantil_cores_numeros',
      title: 'Cores, Formas & Contagem',
      description: 'Brincadeiras guiadas para contar até 20 com peixinhos e estrelinhas.',
      emoji: '🎨',
      tags: ['Matemática Lúdica', 'Cores'],
      accentBg: 'from-amber-100 to-yellow-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'infantil_natureza',
      title: 'Animais & Natureza',
      description: 'Descubra hábitos dos bichinhos e cuidados com o meio ambiente.',
      emoji: '🦋',
      tags: ['Descobertas', 'Natureza'],
      accentBg: 'from-emerald-100 to-teal-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
  ],
  fundamental_1: [
    {
      id: 'fund1_leitura',
      title: 'Leitura Mágica & Interpretação',
      description: 'Pequenas histórias interativas do Miau com desafios de compreensão.',
      emoji: '📖',
      tags: ['Português', 'Leitura'],
      accentBg: 'from-sky-100 to-indigo-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'fund1_matematica',
      title: 'Tabuada & Desafios de Soma',
      description: 'Resolva enigmas numéricos para ganhar moedas bônus na Sala de Estar.',
      emoji: '🧮',
      tags: ['Matemática', 'Raciocínio'],
      accentBg: 'from-amber-100 to-orange-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'fund1_ciencias',
      title: 'Planeta Terra & Regiões do Brasil',
      description: 'Explore os biomas, a Amazônia e os estados brasileiros em quizzes visuais.',
      emoji: '🌎',
      tags: ['Geografia', 'Ciências'],
      accentBg: 'from-emerald-100 to-cyan-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
  ],
  fundamental_2: [
    {
      id: 'fund2_logica',
      title: 'Lógica, Frações & Equações',
      description: 'Missões rápidas de álgebra e geometria guiadas com dicas do Miau.',
      emoji: '📐',
      tags: ['Matemática', 'Lógica'],
      accentBg: 'from-violet-100 to-purple-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'fund2_ciencias',
      title: 'Corpo Humano, Energia & Universo',
      description: 'Experimentos virtuais e curiosidades científicas explicadas passo a passo.',
      emoji: '🔬',
      tags: ['Ciências', 'Astronomia'],
      accentBg: 'from-cyan-100 to-sky-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'fund2_historia',
      title: 'História, Cultura & Cidadania',
      description: 'Viagens no tempo com perguntas rápidas sobre história do Brasil e do mundo.',
      emoji: '🏛️',
      tags: ['História', 'Cultura'],
      accentBg: 'from-amber-100 to-rose-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
  ],
  medio: [
    {
      id: 'medio_redacao',
      title: 'Laboratório de Redação & Gramática',
      description: 'Estruturas argumentativas, repertório sociocultural e revisões com apoio de IA.',
      emoji: '✍️',
      tags: ['Linguagens', 'ENEM'],
      accentBg: 'from-fuchsia-100 to-purple-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'medio_exatas',
      title: 'Física, Química & Matemática Aplicada',
      description: 'Simulados temáticos com resolução comentada e cronômetro de treino.',
      emoji: '⚛️',
      tags: ['Exatas', 'Simulados'],
      accentBg: 'from-indigo-100 to-sky-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'medio_biologia',
      title: 'Biologia, Ecologia & Atualidades',
      description: 'Biomas amazônicos, genética e temas contemporâneos para vestibulares.',
      emoji: '🧬',
      tags: ['Biologia', 'Atualidades'],
      accentBg: 'from-emerald-100 to-lime-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
  ],
  superior_outro: [
    {
      id: 'sup_tech',
      title: 'Tecnologia, Lógica & IA Prática',
      description: 'Trilhas modulares sobre programação, pensamento computacional e produtividade.',
      emoji: '💻',
      tags: ['Tecnologia', 'IA'],
      accentBg: 'from-indigo-100 to-violet-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'sup_idiomas',
      title: 'Prática de Idiomas com o Miau',
      description: 'Diálogos temáticos bilíngues com voz e legendas para treinar escuta e fala.',
      emoji: '🗣️',
      tags: ['Idiomas', 'Conversação'],
      accentBg: 'from-sky-100 to-teal-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'sup_curiosidades',
      title: 'Ciência, História & Cultura Geral',
      description: 'Desafios diários de conhecimentos gerais para manter a mente afiada.',
      emoji: '🧠',
      tags: ['Conhecimentos Gerais', 'Quiz'],
      accentBg: 'from-amber-100 to-purple-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
  ],
};
