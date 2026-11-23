export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface GlyphStrokeDef {
  id: number;
  points: NormalizedPoint[];
  cue: string;
}

export interface GlyphTemplate {
  char: string;
  aspectRatio: number; // width / height ratio inside canvas
  strokes: GlyphStrokeDef[];
  overviewCue: string;
}

export type MotorDifficulty = 'largo' | 'medio' | 'fino';

export interface WritingChallenge {
  id: string;
  unitId: string;
  targetText: string;
  displayBadge: string;
  emoji: string;
  vowelTag?: 'A' | 'E' | 'I' | 'O' | 'U';
  motorLevel: MotorDifficulty;
  title: string;
  prompt: string;
  teachScript: string;
  contextHint: string;
}

export interface WritingUnitDef {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  focusLabel: string;
  emoji: string;
  accentGradient: string;
  coinReward: number;
  xpReward: number;
  challenges: WritingChallenge[];
}

export const TRACKED_WRITING_VOWELS: ReadonlyArray<'A' | 'E' | 'I' | 'O' | 'U'> = [
  'A',
  'E',
  'I',
  'O',
  'U',
];

function sampleEllipticalArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startRad: number,
  endRad: number,
  steps = 28
): NormalizedPoint[] {
  const pts: NormalizedPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rad = startRad + (endRad - startRad) * t;
    pts.push({
      x: cx + rx * Math.cos(rad),
      y: cy + ry * Math.sin(rad),
    });
  }
  return pts;
}

function sampleCubicBezier(
  p0: NormalizedPoint,
  p1: NormalizedPoint,
  p2: NormalizedPoint,
  p3: NormalizedPoint,
  steps = 18
): NormalizedPoint[] {
  const pts: NormalizedPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x:
        u * u * u * p0.x +
        3 * u * u * t * p1.x +
        3 * u * t * t * p2.x +
        t * t * t * p3.x,
      y:
        u * u * u * p0.y +
        3 * u * u * t * p1.y +
        3 * u * t * t * p2.y +
        t * t * t * p3.y,
    });
  }
  return pts;
}

export const WRITING_GLYPHS: Record<string, GlyphTemplate> = {
  A: {
    char: 'A',
    aspectRatio: 0.86,
    overviewCue:
      'Para fazer a letra A, subimos ou começamos lá no alto, descemos para um lado, descemos para o outro como uma cabaninha e cortamos no meio!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.5, y: 0.08 },
          { x: 0.14, y: 0.92 },
        ],
        cue: '1. Comece no pontinho alto e escorregue para a esquerda.',
      },
      {
        id: 2,
        points: [
          { x: 0.5, y: 0.08 },
          { x: 0.86, y: 0.92 },
        ],
        cue: '2. Volte para o alto e escorregue para a direita.',
      },
      {
        id: 3,
        points: [
          { x: 0.26, y: 0.63 },
          { x: 0.74, y: 0.63 },
        ],
        cue: '3. Faça a ponte retinha no meio ligando os dois lados!',
      },
    ],
  },
  E: {
    char: 'E',
    aspectRatio: 0.78,
    overviewCue:
      'Para escrever o E, fazemos um pauzinho reto em pé e depois três bracinhos deitados para a direita!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.22, y: 0.08 },
          { x: 0.22, y: 0.92 },
        ],
        cue: '1. Desça uma linha reta em pé de cima até a base.',
      },
      {
        id: 2,
        points: [
          { x: 0.22, y: 0.08 },
          { x: 0.82, y: 0.08 },
        ],
        cue: '2. Puxe o bracinho de cima para a direita.',
      },
      {
        id: 3,
        points: [
          { x: 0.22, y: 0.5 },
          { x: 0.72, y: 0.5 },
        ],
        cue: '3. Puxe o bracinho do meio para a direita.',
      },
      {
        id: 4,
        points: [
          { x: 0.22, y: 0.92 },
          { x: 0.82, y: 0.92 },
        ],
        cue: '4. Puxe o bracinho de baixo para fechar o E!',
      },
    ],
  },
  I: {
    char: 'I',
    aspectRatio: 0.58,
    overviewCue:
      'A letra I é um traço bem firme em pé lá de cima até embaixo, com um chapeuzinho e um pezinho!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.5, y: 0.08 },
          { x: 0.5, y: 0.92 },
        ],
        cue: '1. Trace uma linha bem retinha no meio de cima até embaixo.',
      },
      {
        id: 2,
        points: [
          { x: 0.26, y: 0.08 },
          { x: 0.74, y: 0.08 },
        ],
        cue: '2. Faça o chapeuzinho reto no alto.',
      },
      {
        id: 3,
        points: [
          { x: 0.26, y: 0.92 },
          { x: 0.74, y: 0.92 },
        ],
        cue: '3. Faça o pezinho reto na linha de baixo!',
      },
    ],
  },
  O: {
    char: 'O',
    aspectRatio: 0.88,
    overviewCue:
      'A letra O é uma voltinha redonda como uma bola! Começamos no alto, damos a volta completa e fechamos no topo.',
    strokes: [
      {
        id: 1,
        points: sampleEllipticalArc(
          0.5,
          0.5,
          0.35,
          0.42,
          -Math.PI / 2,
          -Math.PI / 2 - Math.PI * 2,
          36
        ),
        cue: '1. Comece no alto, contorne para a esquerda em círculo e feche no topo!',
      },
    ],
  },
  U: {
    char: 'U',
    aspectRatio: 0.84,
    overviewCue:
      'A letra U parece um sorriso! Descemos pelo lado esquerdo, fazemos uma curva redonda embaixo e subimos até o alto.',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.18, y: 0.08 },
          { x: 0.18, y: 0.58 },
          ...sampleEllipticalArc(0.5, 0.58, 0.32, 0.34, Math.PI, 0, 22),
          { x: 0.82, y: 0.08 },
        ],
        cue: '1. Desça pela esquerda, faça o sorriso redondo e suba até o alto à direita!',
      },
    ],
  },
  L: {
    char: 'L',
    aspectRatio: 0.76,
    overviewCue:
      'Para o L, descemos uma linha reta e viramos para a direita formando um cantinho!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.24, y: 0.08 },
          { x: 0.24, y: 0.92 },
          { x: 0.82, y: 0.92 },
        ],
        cue: '1. Desça retinho pela esquerda e vire para a direita na base.',
      },
    ],
  },
  M: {
    char: 'M',
    aspectRatio: 0.96,
    overviewCue:
      'O M tem duas montanhas pontudas! Subimos à esquerda, descemos ao meio, subimos e descemos até a base.',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.14, y: 0.92 },
          { x: 0.14, y: 0.08 },
        ],
        cue: '1. Comece de baixo e suba retinho pela esquerda.',
      },
      {
        id: 2,
        points: [
          { x: 0.14, y: 0.08 },
          { x: 0.5, y: 0.58 },
          { x: 0.86, y: 0.08 },
        ],
        cue: '2. Desça até o meio e suba para a direita formando um V.',
      },
      {
        id: 3,
        points: [
          { x: 0.86, y: 0.08 },
          { x: 0.86, y: 0.92 },
        ],
        cue: '3. Desça retinho pelo lado direito até a base!',
      },
    ],
  },
  S: {
    char: 'S',
    aspectRatio: 0.78,
    overviewCue:
      'O S é uma cobrinha elegante com duas curvas suaves!',
    strokes: [
      {
        id: 1,
        points: [
          ...sampleCubicBezier(
            { x: 0.76, y: 0.2 },
            { x: 0.64, y: 0.02 },
            { x: 0.2, y: 0.06 },
            { x: 0.24, y: 0.3 }
          ),
          ...sampleCubicBezier(
            { x: 0.24, y: 0.3 },
            { x: 0.28, y: 0.52 },
            { x: 0.78, y: 0.48 },
            { x: 0.78, y: 0.72 }
          ),
          ...sampleCubicBezier(
            { x: 0.78, y: 0.72 },
            { x: 0.78, y: 0.96 },
            { x: 0.3, y: 0.96 },
            { x: 0.2, y: 0.8 }
          ),
        ],
        cue: '1. Curve lá no alto para a esquerda, passe pelo meio e termine curvando embaixo!',
      },
    ],
  },
  V: {
    char: 'V',
    aspectRatio: 0.86,
    overviewCue:
      'O V escorrega até uma pontinha embaixo e sobe para o outro lado!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.14, y: 0.08 },
          { x: 0.5, y: 0.92 },
          { x: 0.86, y: 0.08 },
        ],
        cue: '1. Escorregue da esquerda até o centro da base e suba para a direita!',
      },
    ],
  },
};

export const WRITING_UNITS: WritingUnitDef[] = [
  {
    id: 'wr_unit_1_a',
    number: 1,
    title: 'Letra A: Subir, Descer e Cortar',
    subtitle: 'Aprenda a vogal A do traço largo ao traço fino',
    focusLabel: 'Vogal A • Coordenação Inicial',
    emoji: '🐝',
    accentGradient: 'from-pink-100 via-rose-50 to-purple-100',
    coinReward: 35,
    xpReward: 40,
    challenges: [
      {
        id: 'wr_a_largo',
        unitId: 'wr_unit_1_a',
        targetText: 'A',
        displayBadge: 'Letra A • Traço Largo',
        emoji: '🐝',
        vowelTag: 'A',
        motorLevel: 'largo',
        title: 'Vamos conhecer e cobrir a letra A!',
        prompt:
          'Toque em "Ver IA Ensinar" para ver o Miau desenhar a letra A e depois cubra os pontinhos com o dedo.',
        teachScript:
          'Miau! Olha como se escreve a letra A de Abelha: primeiro escorregue do alto para a esquerda, depois do alto para a direita e por último faça a ponte no meio!',
        contextHint: 'A de Abelha e Abacaxi! Comece pelo pontinho número 1.',
      },
      {
        id: 'wr_a_medio',
        unitId: 'wr_unit_1_a',
        targetText: 'A',
        displayBadge: 'Letra A • Traço Médio',
        emoji: '🍍',
        vowelTag: 'A',
        motorLevel: 'medio',
        title: 'Refinando a letra A com calma',
        prompt:
          'Agora o caminho ficou um pouquinho mais estreito! Passe o dedinho bem dentro do guia.',
        teachScript:
          'Agora vamos caprichar no A de Abacaxi! Vá devagarinho no traço médio para deixar os dois lados bem certinhos.',
        contextHint: 'Segure firme e faça os 3 passinhos do A.',
      },
      {
        id: 'wr_a_fino',
        unitId: 'wr_unit_1_a',
        targetText: 'A',
        displayBadge: 'Letra A • Coordenação Fina',
        emoji: '⭐',
        vowelTag: 'A',
        motorLevel: 'fino',
        title: 'Desafio fino da letra A!',
        prompt:
          'Nível de coordenação motora fina! Cubra a letra A fininha sem sair da linha.',
        teachScript:
          'Você já sabe fazer o A! Agora use a pontinha do dedo no traço fino para mostrar toda a sua firmeza.',
        contextHint: 'Traço fininho: vá bem devagar seguindo os números 1, 2 e 3.',
      },
    ],
  },
  {
    id: 'wr_unit_2_e',
    number: 2,
    title: 'Letra E: Traço Reto e Bracinhos',
    subtitle: 'Escreva a vogal E e o encontro EI',
    focusLabel: 'Vogal E • Linhas Retas',
    emoji: '🐘',
    accentGradient: 'from-purple-100 via-indigo-50 to-sky-100',
    coinReward: 40,
    xpReward: 45,
    challenges: [
      {
        id: 'wr_e_largo',
        unitId: 'wr_unit_2_e',
        targetText: 'E',
        displayBadge: 'Letra E • Traço Largo',
        emoji: '🐘',
        vowelTag: 'E',
        motorLevel: 'largo',
        title: 'Descobrindo a letra E',
        prompt:
          'Desça uma linha reta e puxe os três bracinhos do E para a direita!',
        teachScript:
          'Miau! Para fazer a letra E de Elefante, trace uma linha reta em pé lá de cima até embaixo e depois puxe três bracinhos para a direita!',
        contextHint: 'E de Elefante e Estrela!',
      },
      {
        id: 'wr_e_fino',
        unitId: 'wr_unit_2_e',
        targetText: 'E',
        displayBadge: 'Letra E • Coordenação Fina',
        emoji: '🌟',
        vowelTag: 'E',
        motorLevel: 'fino',
        title: 'Letra E no traço fino',
        prompt:
          'Capriche nos três bracinhos paralelos da letra E no guia fininho.',
        teachScript:
          'Vamos refinar a letra E! Deixe o traço em pé bem retinho e os três bracinhos apontando para a direita.',
        contextHint: 'Um passo de cada vez: 1 desce, 2 cima, 3 meio, 4 baixo.',
      },
      {
        id: 'wr_word_ei',
        unitId: 'wr_unit_2_e',
        targetText: 'EI',
        displayBadge: 'Palavra Fácil • EI',
        emoji: '👋',
        vowelTag: 'E',
        motorLevel: 'medio',
        title: 'Juntando E + I = EI!',
        prompt:
          'Cubra primeiro a letra E e depois a letra I para escrever EI!',
        teachScript:
          'Que legal! Agora juntamos duas vogais para escrever EI, como quando damos tchau para um amigo!',
        contextHint: 'Primeiro escreva o E, depois o I ao ladinho.',
      },
    ],
  },
  {
    id: 'wr_unit_3_i',
    number: 3,
    title: 'Letra I: Linha Firme',
    subtitle: 'Escreva a vogal I e o cumprimento OI',
    focusLabel: 'Vogal I • Precisão Vertical',
    emoji: '🏝️',
    accentGradient: 'from-sky-100 via-cyan-50 to-teal-100',
    coinReward: 40,
    xpReward: 45,
    challenges: [
      {
        id: 'wr_i_largo',
        unitId: 'wr_unit_3_i',
        targetText: 'I',
        displayBadge: 'Letra I • Traço Largo',
        emoji: '🏝️',
        vowelTag: 'I',
        motorLevel: 'largo',
        title: 'Traçando a letra I',
        prompt:
          'Comece no alto e desça bem retinho! Depois faça o chapeuzinho e o pezinho.',
        teachScript:
          'Miau! A letra I de Ilha é super elegante: trace uma linha firme de cima até embaixo e coloque o chapeuzinho e o pezinho!',
        contextHint: 'I de Ilha e Igreja!',
      },
      {
        id: 'wr_i_fino',
        unitId: 'wr_unit_3_i',
        targetText: 'I',
        displayBadge: 'Letra I • Coordenação Fina',
        emoji: '🦎',
        vowelTag: 'I',
        motorLevel: 'fino',
        title: 'Letra I bem retinha!',
        prompt:
          'Passe o dedinho bem firme no centro da letra I sem entortar.',
        teachScript:
          'Ótimo treino de firmeza! Desça o I bem retinho no guia fino.',
        contextHint: 'Controle suave com a pontinha do dedo.',
      },
      {
        id: 'wr_word_oi',
        unitId: 'wr_unit_3_i',
        targetText: 'OI',
        displayBadge: 'Palavra Fácil • OI',
        emoji: '🐱',
        vowelTag: 'I',
        motorLevel: 'medio',
        title: 'Escrevendo OI para o Miau!',
        prompt:
          'Faça a voltinha do O e depois o traço reto do I para formar OI!',
        teachScript:
          'Miau! Vamos escrever OI! Primeiro desenhe a bola redonda do O e ao lado trace a letra I.',
        contextHint: 'O + I forma a palavrinha OI!',
      },
    ],
  },
  {
    id: 'wr_unit_4_o',
    number: 4,
    title: 'Letra O: A Volta Redondinha',
    subtitle: 'Treine curvas suaves com O e OVO',
    focusLabel: 'Vogal O • Movimento Circular',
    emoji: '🥚',
    accentGradient: 'from-amber-100 via-yellow-50 to-orange-100',
    coinReward: 45,
    xpReward: 50,
    challenges: [
      {
        id: 'wr_o_largo',
        unitId: 'wr_unit_4_o',
        targetText: 'O',
        displayBadge: 'Letra O • Traço Largo',
        emoji: '🥚',
        vowelTag: 'O',
        motorLevel: 'largo',
        title: 'Contornando a letra O',
        prompt:
          'Comece lá em cima, dê a volta redondinha e feche no mesmo pontinho!',
        teachScript:
          'Miau! Para escrever o O de Ovo, comece lá no alto, dê uma volta suave pela esquerda e feche a rodinha no topo!',
        contextHint: 'Movimento contínuo sem tirar o dedo até fechar!',
      },
      {
        id: 'wr_o_fino',
        unitId: 'wr_unit_4_o',
        targetText: 'O',
        displayBadge: 'Letra O • Coordenação Fina',
        emoji: '👓',
        vowelTag: 'O',
        motorLevel: 'fino',
        title: 'Círculo perfeito no traço fino',
        prompt:
          'Faça uma curva bem redondinha seguindo o pontilhado fino do O.',
        teachScript:
          'Agora deixe sua voltinha do O super redondinha no guia fino!',
        contextHint: 'Devagarinho nas curvas para ficar bem redondo.',
      },
      {
        id: 'wr_word_ovo',
        unitId: 'wr_unit_4_o',
        targetText: 'OVO',
        displayBadge: 'Palavra Fácil • OVO',
        emoji: '🍳',
        vowelTag: 'O',
        motorLevel: 'medio',
        title: 'Escrevendo a palavra OVO',
        prompt:
          'Cubra O, depois o V em pontinha e mais um O no final!',
        teachScript:
          'Uau, uma palavra inteira! Vamos escrever OVO: uma bolinha do O, um escorregador V e outra bolinha do O!',
        contextHint: 'O - V - O: leia e escreva OVO!',
      },
    ],
  },
  {
    id: 'wr_unit_5_u',
    number: 5,
    title: 'Letra U: O Sorriso Redondo',
    subtitle: 'Escreva a vogal U e a palavra UVA',
    focusLabel: 'Vogal U • Curva Inferior',
    emoji: '🍇',
    accentGradient: 'from-violet-100 via-fuchsia-50 to-pink-100',
    coinReward: 45,
    xpReward: 50,
    challenges: [
      {
        id: 'wr_u_largo',
        unitId: 'wr_unit_5_u',
        targetText: 'U',
        displayBadge: 'Letra U • Traço Largo',
        emoji: '🍇',
        vowelTag: 'U',
        motorLevel: 'largo',
        title: 'O sorriso da letra U',
        prompt:
          'Desça pela esquerda, curve suave embaixo e suba até o alto à direita!',
        teachScript:
          'Miau! A letra U de Uva parece um sorriso feliz! Desça reto à esquerda, faça a curva redondinha embaixo e suba à direita!',
        contextHint: 'U de Uva e Urso!',
      },
      {
        id: 'wr_u_fino',
        unitId: 'wr_unit_5_u',
        targetText: 'U',
        displayBadge: 'Letra U • Coordenação Fina',
        emoji: '🐻',
        vowelTag: 'U',
        motorLevel: 'fino',
        title: 'Letra U no traço fino',
        prompt:
          'Controle a curva embaixo para não fazer bico, mantendo o U redondinho!',
        teachScript:
          'Treine o sorriso bem suave da letra U no traço fino!',
        contextHint: 'Um movimento único contínuo!',
      },
      {
        id: 'wr_word_uva',
        unitId: 'wr_unit_5_u',
        targetText: 'UVA',
        displayBadge: 'Palavra Fácil • UVA',
        emoji: '🍇',
        vowelTag: 'U',
        motorLevel: 'medio',
        title: 'Escrevendo a palavra UVA',
        prompt:
          'Junte U + V + A com o dedinho para escrever UVA!',
        teachScript:
          'Delícia de frutinha! Vamos cobrir as três letras de UVA: o sorriso do U, o V e o triângulo do A!',
        contextHint: 'U - V - A forma UVA!',
      },
    ],
  },
  {
    id: 'wr_unit_6_encontros',
    number: 6,
    title: 'Encontros Vocálicos',
    subtitle: 'Combine vogais com firmeza e ritmo',
    focusLabel: 'Encontros • AI, AU, UI',
    emoji: '✨',
    accentGradient: 'from-rose-100 via-purple-50 to-indigo-100',
    coinReward: 55,
    xpReward: 60,
    challenges: [
      {
        id: 'wr_enc_ai',
        unitId: 'wr_unit_6_encontros',
        targetText: 'AI',
        displayBadge: 'Encontro • AI',
        emoji: '🩹',
        motorLevel: 'medio',
        title: 'Escrevendo AI',
        prompt: 'Cubra o A e ao lado o I para formar AI!',
        teachScript:
          'Agora que você domina todas as vogais, vamos juntar A com I para escrever AI!',
        contextHint: 'A + I = AI',
      },
      {
        id: 'wr_enc_au',
        unitId: 'wr_unit_6_encontros',
        targetText: 'AU',
        displayBadge: 'Encontro • AU',
        emoji: '🐶',
        motorLevel: 'medio',
        title: 'Escrevendo AU',
        prompt: 'Trace o A e o sorriso do U para formar AU!',
        teachScript:
          'Miau! Como faz o cachorrinho? AU! Escreva a letra A e depois a letra U.',
        contextHint: 'A + U = AU',
      },
      {
        id: 'wr_enc_ui',
        unitId: 'wr_unit_6_encontros',
        targetText: 'UI',
        displayBadge: 'Encontro • UI (Fino)',
        emoji: '😮',
        motorLevel: 'fino',
        title: 'Escrevendo UI no traço fino',
        prompt: 'Passe o dedinho no guia fino de U e I!',
        teachScript:
          'Vamos treinar no guia fino! Faça o U bem redondo e o I bem retinho formando UI.',
        contextHint: 'U + I = UI',
      },
    ],
  },
  {
    id: 'wr_unit_7_palavras',
    number: 7,
    title: 'Primeiras Palavras Fáceis',
    subtitle: 'Escreva LUA, SOL e MIAU com o dedo!',
    focusLabel: 'Palavras Fáceis • Mestre da Escrita',
    emoji: '🏆',
    accentGradient: 'from-amber-100 via-pink-50 to-purple-100',
    coinReward: 70,
    xpReward: 80,
    challenges: [
      {
        id: 'wr_word_lua',
        unitId: 'wr_unit_7_palavras',
        targetText: 'LUA',
        displayBadge: 'Palavra Fácil • LUA',
        emoji: '🌙',
        motorLevel: 'medio',
        title: 'Escrevendo LUA',
        prompt: 'Cubra L, U e A bem devagar seguindo os números.',
        teachScript:
          'Olha que lindo: vamos escrever LUA! Comece pelo L, depois o sorriso do U e termine com a letra A!',
        contextHint: 'L - U - A = LUA',
      },
      {
        id: 'wr_word_sol',
        unitId: 'wr_unit_7_palavras',
        targetText: 'SOL',
        displayBadge: 'Palavra Fácil • SOL',
        emoji: '☀️',
        motorLevel: 'medio',
        title: 'Escrevendo SOL',
        prompt: 'Faça a cobrinha do S, a bola do O e o canto do L!',
        teachScript:
          'Vamos iluminar o caderno escrevendo SOL! Curve o S suave, feche a bolinha do O e termine com o L.',
        contextHint: 'S - O - L = SOL',
      },
      {
        id: 'wr_word_miau',
        unitId: 'wr_unit_7_palavras',
        targetText: 'MIAU',
        displayBadge: 'Palavra Especial • MIAU',
        emoji: '🐱',
        motorLevel: 'fino',
        title: 'Desafio Final: Escreva MIAU!',
        prompt:
          'Escreva o nome do seu amiguinho gatinho MIAU com traço caprichado!',
        teachScript:
          'Purrr! Chegou o grande momento: escreva o meu nome, MIAU! Capriche no M, no I, no A e no U!',
        contextHint: 'M - I - A - U = MIAU!',
      },
    ],
  },
];
