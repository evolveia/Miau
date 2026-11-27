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
      title: 'Vogais e Primeiras Palavras',
      description: 'Método fônico com o Miau: sons das vogais, rimas, encontros vocálicos e primeiras palavras em 6 unidades.',
      emoji: '🔤',
      tags: ['Método Fônico', '6 Unidades', 'Áudio e Voz'],
      accentBg: 'from-pink-100 to-rose-100',
      statusLabel: 'Disponível agora • Toque para aprender',
    },
    {
      id: 'infantil_escrita',
      title: 'Vamos Escrever',
      description: 'A IA do Miau ensina o traçado de cada vogal e palavras fáceis para você cobrir com o dedo e treinar a coordenação motora fina.',
      emoji: '✍️',
      tags: ['Escrita Guiada', 'IA e Dedo', '7 Unidades'],
      accentBg: 'from-purple-100 to-indigo-100',
      statusLabel: 'Disponível agora • Toque para escrever',
    },
    {
      id: 'infantil_escrita_consoantes',
      title: 'Escrevendo as Consoantes',
      description: 'Cubra com o dedo todas as 21 consoantes do B ao Z em ordem alfabética com guia de traçado, avaliação da IA e estrelas por letra.',
      emoji: '🖍️',
      tags: ['Escrita B ao Z', 'IA e Dedo', '7 Unidades'],
      accentBg: 'from-fuchsia-100 to-purple-100',
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
      title: 'Cores, Formas e Contagem',
      description: 'Brincadeiras guiadas com o Miau para explorar cores, formas geométricas e contar até 20 com peixinhos e estrelinhas.',
      emoji: '🎨',
      tags: ['Matemática Lúdica', 'Cores e Formas', '6 Unidades'],
      accentBg: 'from-amber-100 to-yellow-100',
      statusLabel: 'Disponível agora • Toque para aprender',
    },
    {
      id: 'infantil_soma_subtracao',
      title: 'Somar e Subtrair com o Miau',
      description: 'Aprenda operações básicas de adição e subtração até 10 com frutinhas, balões, o mágico número zero e desafio dos sinais.',
      emoji: '➕',
      tags: ['Adição e Subtração', 'Continhas', '6 Unidades'],
      accentBg: 'from-emerald-100 to-sky-100',
      statusLabel: 'Disponível agora • Toque para calcular',
    },
    {
      id: 'infantil_matematica_desafios',
      title: 'Comparação, Dobro e Probleminhas',
      description: 'Compare quem tem mais ou menos, descubra vizinhos antes e depois, o dobro, a metade e resolva historinhas do dia a dia.',
      emoji: '🧮',
      tags: ['Dobro e Metade', 'Lógica', '6 Unidades'],
      accentBg: 'from-indigo-100 to-rose-100',
      statusLabel: 'Disponível agora • Toque para explorar',
    },
    {
      id: 'infantil_natureza',
      title: 'Animais e Natureza',
      description: 'Descubra sons, habitats, hábitos dos bichinhos e cuidados com a água, as plantas e o meio ambiente em 6 unidades.',
      emoji: '🦋',
      tags: ['Descobertas', 'Natureza e Voz', '6 Unidades'],
      accentBg: 'from-emerald-100 to-teal-100',
      statusLabel: 'Disponível agora • Toque para explorar',
    },
    {
      id: 'infantil_comidas_bebidas',
      title: 'Comidas e Bebidas',
      description: 'Aprenda frutas, legumes, refeições do dia, bebidas refrescantes e escolhas saudáveis com o Miau em 6 unidades.',
      emoji: '🍓',
      tags: ['Alimentação', 'Vocabulário e Voz', '6 Unidades'],
      accentBg: 'from-rose-100 to-orange-100',
      statusLabel: 'Disponível agora • Toque para aprender',
    },
  ],
  fundamental_1: [
    {
      id: 'fund1_leitura',
      title: 'Leitura Mágica e Interpretação',
      description: 'Mini-histórias interativas do Miau com desafios de compreensão, pontuação, sinônimos e leitura em voz alta.',
      emoji: '📖',
      tags: ['Português', '4 Unidades', 'Leitura e Voz'],
      accentBg: 'from-sky-100 to-indigo-100',
      statusLabel: 'Disponível agora • Toque para ler e interpretar',
    },
    {
      id: 'fund1_matematica',
      title: 'Tabuada e Desafios de Soma',
      description: 'Tabuadas interativas do 2 ao 9, contas rápidas e enigmas numéricos com o Miau.',
      emoji: '🧮',
      tags: ['Matemática', '4 Unidades', 'Tabuada'],
      accentBg: 'from-amber-100 to-orange-100',
      statusLabel: 'Disponível agora • Toque para calcular',
    },
    {
      id: 'fund1_ciencias',
      title: 'Planeta Terra e Biomas do Brasil',
      description: 'Explore os biomas brasileiros (Amazônia, Cerrado, Caatinga, Mata Atlântica, Pantanal e Pampa), ciclos da água e solo.',
      emoji: '🌎',
      tags: ['Geografia e Ciências', '4 Unidades', 'Biomas'],
      accentBg: 'from-emerald-100 to-cyan-100',
      statusLabel: 'Disponível agora • Toque para explorar',
    },
  ],
  fundamental_2: [
    {
      id: 'fund2_logica',
      title: 'Lógica, Frações e Equações',
      description: 'Frações visuais, proporções, equações do 1º grau e sequências lógicas com dicas passo a passo do Miau.',
      emoji: '📐',
      tags: ['Matemática', '4 Unidades', 'Frações e Lógica'],
      accentBg: 'from-violet-100 to-purple-100',
      statusLabel: 'Disponível agora • Toque para resolver',
    },
    {
      id: 'fund2_ciencias',
      title: 'Corpo Humano, Energia e Universo',
      description: 'Sistemas do corpo humano, energias renováveis, estados da matéria e o Sistema Solar explicados pelo Miau.',
      emoji: '🔬',
      tags: ['Ciências', '4 Unidades', 'Corpo e Espaço'],
      accentBg: 'from-cyan-100 to-sky-100',
      statusLabel: 'Disponível agora • Toque para descobrir',
    },
    {
      id: 'fund2_historia',
      title: 'História, Cultura e Cidadania',
      description: 'Viagem histórica do Brasil indígena e colonial às civilizações antigas e cidadania.',
      emoji: '🏛️',
      tags: ['História', '4 Unidades', 'Cultura'],
      accentBg: 'from-amber-100 to-rose-100',
      statusLabel: 'Disponível agora • Toque para viajar no tempo',
    },
  ],
  medio: [
    {
      id: 'medio_redacao',
      title: 'Laboratório de Redação e Gramática',
      description: 'Estruturas argumentativas, repertório sociocultural e revisões com apoio de IA.',
      emoji: '✍️',
      tags: ['Linguagens', 'ENEM'],
      accentBg: 'from-fuchsia-100 to-purple-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'medio_exatas',
      title: 'Física, Química e Matemática Aplicada',
      description: 'Simulados temáticos com resolução comentada e cronômetro de treino.',
      emoji: '⚛️',
      tags: ['Exatas', 'Simulados'],
      accentBg: 'from-indigo-100 to-sky-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
    {
      id: 'medio_biologia',
      title: 'Biologia, Ecologia e Atualidades',
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
      title: 'Tecnologia, Lógica e IA Prática',
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
      title: 'Ciência, História e Cultura Geral',
      description: 'Desafios diários de conhecimentos gerais para manter a mente afiada.',
      emoji: '🧠',
      tags: ['Conhecimentos Gerais', 'Quiz'],
      accentBg: 'from-amber-100 to-purple-100',
      statusLabel: 'Em breve • Módulo configurável por escolaridade',
    },
  ],
};
