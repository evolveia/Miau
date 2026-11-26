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
  consonantTag?: string;
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

export const TRACKED_WRITING_CONSONANTS: ReadonlyArray<string> = [
  'B',
  'C',
  'D',
  'F',
  'G',
  'H',
  'J',
  'K',
  'L',
  'M',
  'N',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'V',
  'W',
  'X',
  'Y',
  'Z',
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
  B: {
    char: 'B',
    aspectRatio: 0.78,
    overviewCue:
      'Para fazer a letra B, fazemos um tracinho reto em pé e depois duas barrigonas fofinhas para a direita!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.2, y: 0.08 },
          { x: 0.2, y: 0.92 },
        ],
        cue: '1. Desça uma linha reta firme de cima até a base.',
      },
      {
        id: 2,
        points: [
          { x: 0.2, y: 0.08 },
          { x: 0.52, y: 0.08 },
          ...sampleEllipticalArc(0.52, 0.29, 0.28, 0.21, -Math.PI / 2, Math.PI / 2, 16),
          { x: 0.2, y: 0.5 },
        ],
        cue: '2. Faça a primeira barriguinha no alto até o meio.',
      },
      {
        id: 3,
        points: [
          { x: 0.2, y: 0.5 },
          { x: 0.54, y: 0.5 },
          ...sampleEllipticalArc(0.54, 0.71, 0.3, 0.21, -Math.PI / 2, Math.PI / 2, 16),
          { x: 0.2, y: 0.92 },
        ],
        cue: '3. Agora faça a barriguinha de baixo fechando na base!',
      },
    ],
  },
  C: {
    char: 'C',
    aspectRatio: 0.82,
    overviewCue:
      'A letra C é uma curva aberta parecida com uma lua minguante!',
    strokes: [
      {
        id: 1,
        points: sampleEllipticalArc(0.54, 0.5, 0.36, 0.42, -0.58, -Math.PI * 2 + 0.58, 30),
        cue: '1. Comece perto do alto à direita, contorne para a esquerda e pare embaixo aberto!',
      },
    ],
  },
  D: {
    char: 'D',
    aspectRatio: 0.82,
    overviewCue:
      'Para o D, descemos um pauzinho reto e depois fazemos uma barriga bem grande fechando na base!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.2, y: 0.08 },
          { x: 0.2, y: 0.92 },
        ],
        cue: '1. Desça uma linha reta bem firme de cima até a base.',
      },
      {
        id: 2,
        points: [
          { x: 0.2, y: 0.08 },
          { x: 0.46, y: 0.08 },
          ...sampleEllipticalArc(0.46, 0.5, 0.38, 0.42, -Math.PI / 2, Math.PI / 2, 24),
          { x: 0.2, y: 0.92 },
        ],
        cue: '2. Contorne numa grande curva suave para a direita até fechar embaixo!',
      },
    ],
  },
  F: {
    char: 'F',
    aspectRatio: 0.74,
    overviewCue:
      'A letra F é igual ao E, mas só tem dois bracinhos no alto e no meio!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.24, y: 0.08 },
          { x: 0.24, y: 0.92 },
        ],
        cue: '1. Desça uma linha reta de cima até embaixo.',
      },
      {
        id: 2,
        points: [
          { x: 0.24, y: 0.08 },
          { x: 0.82, y: 0.08 },
        ],
        cue: '2. Puxe o bracinho de cima para a direita.',
      },
      {
        id: 3,
        points: [
          { x: 0.24, y: 0.49 },
          { x: 0.7, y: 0.49 },
        ],
        cue: '3. Puxe o bracinho do meio para a direita!',
      },
    ],
  },
  G: {
    char: 'G',
    aspectRatio: 0.86,
    overviewCue:
      'O G começa como uma letra C bem redondinha, sobe um pouquinho e ganha um degrau para dentro!',
    strokes: [
      {
        id: 1,
        points: [
          ...sampleEllipticalArc(0.52, 0.5, 0.36, 0.42, -0.52, -Math.PI * 2 + 0.1, 30),
          { x: 0.86, y: 0.54 },
          { x: 0.54, y: 0.54 },
        ],
        cue: '1. Contorne como um C, suba até o meio à direita e puxe o tracinho para dentro!',
      },
    ],
  },
  H: {
    char: 'H',
    aspectRatio: 0.82,
    overviewCue:
      'O H são duas torres em pé ligadas por uma pontezinha no meio!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.2, y: 0.08 },
          { x: 0.2, y: 0.92 },
        ],
        cue: '1. Desça a primeira linha reta à esquerda.',
      },
      {
        id: 2,
        points: [
          { x: 0.8, y: 0.08 },
          { x: 0.8, y: 0.92 },
        ],
        cue: '2. Desça a segunda linha reta à direita.',
      },
      {
        id: 3,
        points: [
          { x: 0.2, y: 0.5 },
          { x: 0.8, y: 0.5 },
        ],
        cue: '3. Ligue as duas torres com uma ponte no meio!',
      },
    ],
  },
  J: {
    char: 'J',
    aspectRatio: 0.68,
    overviewCue:
      'A letra J desce retinha e faz um ganchinho parecido com um guarda-chuva!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.68, y: 0.08 },
          { x: 0.68, y: 0.64 },
          ...sampleEllipticalArc(0.45, 0.64, 0.23, 0.28, 0, Math.PI * 0.95, 20),
        ],
        cue: '1. Desça pela direita e faça a curvinha suave virando para a esquerda!',
      },
      {
        id: 2,
        points: [
          { x: 0.36, y: 0.08 },
          { x: 0.86, y: 0.08 },
        ],
        cue: '2. Coloque o chapeuzinho reto no alto do J!',
      },
    ],
  },
  K: {
    char: 'K',
    aspectRatio: 0.8,
    overviewCue:
      'Para fazer o K, traçamos uma linha em pé e depois duas perninhas saindo do meio como um biquinho!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.22, y: 0.08 },
          { x: 0.22, y: 0.92 },
        ],
        cue: '1. Desça uma linha reta à esquerda.',
      },
      {
        id: 2,
        points: [
          { x: 0.8, y: 0.08 },
          { x: 0.22, y: 0.54 },
        ],
        cue: '2. Escorregue do alto direito até o meio da linha.',
      },
      {
        id: 3,
        points: [
          { x: 0.22, y: 0.54 },
          { x: 0.82, y: 0.92 },
        ],
        cue: '3. Saia do meio e escorregue para o pé direito!',
      },
    ],
  },
  N: {
    char: 'N',
    aspectRatio: 0.82,
    overviewCue:
      'O N sobe, desce escorregando na diagonal e sobe de novo como uma montanha!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.18, y: 0.92 },
          { x: 0.18, y: 0.08 },
        ],
        cue: '1. Suba uma linha reta pela esquerda.',
      },
      {
        id: 2,
        points: [
          { x: 0.18, y: 0.08 },
          { x: 0.82, y: 0.92 },
        ],
        cue: '2. Escorregue do alto esquerdo até a base direita.',
      },
      {
        id: 3,
        points: [
          { x: 0.82, y: 0.92 },
          { x: 0.82, y: 0.08 },
        ],
        cue: '3. Suba retinho pela direita até o topo!',
      },
    ],
  },
  P: {
    char: 'P',
    aspectRatio: 0.76,
    overviewCue:
      'O P é uma linha reta em pé com uma cabecinha redonda lá no alto!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.22, y: 0.08 },
          { x: 0.22, y: 0.92 },
        ],
        cue: '1. Desça uma linha reta de cima até embaixo.',
      },
      {
        id: 2,
        points: [
          { x: 0.22, y: 0.08 },
          { x: 0.52, y: 0.08 },
          ...sampleEllipticalArc(0.52, 0.3, 0.28, 0.22, -Math.PI / 2, Math.PI / 2, 18),
          { x: 0.22, y: 0.52 },
        ],
        cue: '2. Faça a curvinha redonda lá no alto fechando no meio!',
      },
    ],
  },
  Q: {
    char: 'Q',
    aspectRatio: 0.88,
    overviewCue:
      'O Q é uma bolinha redonda igual ao O, mas ganha um rabinho simpático embaixo!',
    strokes: [
      {
        id: 1,
        points: sampleEllipticalArc(
          0.5,
          0.48,
          0.34,
          0.4,
          -Math.PI / 2,
          -Math.PI / 2 - Math.PI * 2,
          34
        ),
        cue: '1. Contorne o círculo completo começando no alto.',
      },
      {
        id: 2,
        points: [
          { x: 0.58, y: 0.68 },
          { x: 0.86, y: 0.94 },
        ],
        cue: '2. Faça o tracinho inclinado embaixo à direita!',
      },
    ],
  },
  R: {
    char: 'R',
    aspectRatio: 0.8,
    overviewCue:
      'O R parece o P lá em cima, e depois ganha uma perninha inclinada apoiando na base!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.2, y: 0.08 },
          { x: 0.2, y: 0.92 },
        ],
        cue: '1. Desça a linha reta pela esquerda.',
      },
      {
        id: 2,
        points: [
          { x: 0.2, y: 0.08 },
          { x: 0.52, y: 0.08 },
          ...sampleEllipticalArc(0.52, 0.29, 0.26, 0.21, -Math.PI / 2, Math.PI / 2, 18),
          { x: 0.2, y: 0.5 },
        ],
        cue: '2. Faça a curvinha de cima fechando no meio.',
      },
      {
        id: 3,
        points: [
          { x: 0.44, y: 0.5 },
          { x: 0.82, y: 0.92 },
        ],
        cue: '3. Puxe a perninha escorregando para a direita até a base!',
      },
    ],
  },
  T: {
    char: 'T',
    aspectRatio: 0.8,
    overviewCue:
      'O T tem um chapéu bem comprido no alto e uma linha reta bem no meio!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.14, y: 0.08 },
          { x: 0.86, y: 0.08 },
        ],
        cue: '1. Trace o chapéu reto da esquerda para a direita no alto.',
      },
      {
        id: 2,
        points: [
          { x: 0.5, y: 0.08 },
          { x: 0.5, y: 0.92 },
        ],
        cue: '2. Desça uma linha reta bem no meio até a base!',
      },
    ],
  },
  W: {
    char: 'W',
    aspectRatio: 1.05,
    overviewCue:
      'O W parece dois Vs de mãos dadas: desce, sobe, desce e sobe!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.1, y: 0.08 },
          { x: 0.3, y: 0.92 },
          { x: 0.5, y: 0.36 },
          { x: 0.7, y: 0.92 },
          { x: 0.9, y: 0.08 },
        ],
        cue: '1. Desça à esquerda, suba ao meio, desça de novo e suba até o alto à direita!',
      },
    ],
  },
  X: {
    char: 'X',
    aspectRatio: 0.82,
    overviewCue:
      'O X são dois escorregadores que se cruzam bem no meiozinho!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.16, y: 0.08 },
          { x: 0.84, y: 0.92 },
        ],
        cue: '1. Escorregue do canto alto esquerdo até embaixo à direita.',
      },
      {
        id: 2,
        points: [
          { x: 0.84, y: 0.08 },
          { x: 0.16, y: 0.92 },
        ],
        cue: '2. Agora cruze do canto alto direito até embaixo à esquerda!',
      },
    ],
  },
  Y: {
    char: 'Y',
    aspectRatio: 0.8,
    overviewCue:
      'O Y faz um V curtinho lá no alto e depois desce uma perninha reta no meio!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.18, y: 0.08 },
          { x: 0.5, y: 0.5 },
        ],
        cue: '1. Escorregue do alto esquerdo até o meio.',
      },
      {
        id: 2,
        points: [
          { x: 0.82, y: 0.08 },
          { x: 0.5, y: 0.5 },
        ],
        cue: '2. Escorregue do alto direito até o mesmo ponto no meio.',
      },
      {
        id: 3,
        points: [
          { x: 0.5, y: 0.5 },
          { x: 0.5, y: 0.92 },
        ],
        cue: '3. Desça retinho do meio até a base!',
      },
    ],
  },
  Z: {
    char: 'Z',
    aspectRatio: 0.82,
    overviewCue:
      'O Z vai para a direita no alto, escorrega na diagonal até a base e volta para a direita embaixo!',
    strokes: [
      {
        id: 1,
        points: [
          { x: 0.16, y: 0.08 },
          { x: 0.84, y: 0.08 },
          { x: 0.16, y: 0.92 },
          { x: 0.84, y: 0.92 },
        ],
        cue: '1. Trace no alto para a direita, desça em zigue-zague para a esquerda e feche à direita na base!',
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

export const WRITING_CONSONANTS_UNITS: WritingUnitDef[] = [
  {
    id: 'wc_unit_1_bcd',
    number: 1,
    title: 'Consoantes B, C e D',
    subtitle: 'Barriguinhas suaves e curvas iniciais em ordem alfabética',
    focusLabel: 'Letras B, C e D • Traço Largo',
    emoji: '🐳',
    accentGradient: 'from-violet-100 via-purple-50 to-fuchsia-100',
    coinReward: 40,
    xpReward: 45,
    challenges: [
      {
        id: 'wc_b',
        unitId: 'wc_unit_1_bcd',
        targetText: 'B',
        displayBadge: 'Consoante B • Traço Largo',
        emoji: '🐳',
        consonantTag: 'B',
        motorLevel: 'largo',
        title: 'Vamos cobrir a letra B de Baleia!',
        prompt: 'Desça o traço reto número 1 e depois faça as duas barriguinhas do B.',
        teachScript:
          'Miau! A primeira consoante do alfabeto é o B de Baleia e Bola! Desça em pé e depois faça duas barriguinhas fofinhas para a direita!',
        contextHint: 'B de Baleia e Bola! Siga os números 1, 2 e 3.',
      },
      {
        id: 'wc_c',
        unitId: 'wc_unit_1_bcd',
        targetText: 'C',
        displayBadge: 'Consoante C • Traço Largo',
        emoji: '🐶',
        consonantTag: 'C',
        motorLevel: 'largo',
        title: 'Curva suave da letra C de Cachorro!',
        prompt: 'Contorne a meia-lua redondinha da letra C sem fechar a ponta.',
        teachScript:
          'Miau! Olha o C de Cachorro e Casa! Ele parece uma boquinha aberta ou uma lua minguante bem redondinha.',
        contextHint: 'C de Cachorro e Casa! Comece no pontinho 1 lá no alto.',
      },
      {
        id: 'wc_d',
        unitId: 'wc_unit_1_bcd',
        targetText: 'D',
        displayBadge: 'Consoante D • Traço Largo',
        emoji: '🦕',
        consonantTag: 'D',
        motorLevel: 'largo',
        title: 'Cobrindo a letra D de Dinossauro!',
        prompt: 'Trace o pauzinho reto e feche com uma barriga bem grande do alto até a base.',
        teachScript:
          'Vamos escrever o D de Dinossauro e Dado! Primeiro desça bem retinho e depois faça um barrigão redondo até fechar embaixo!',
        contextHint: 'D de Dinossauro e Dado!',
      },
    ],
  },
  {
    id: 'wc_unit_2_fgh',
    number: 2,
    title: 'Consoantes F, G e H',
    subtitle: 'Traços retos, curvas com degrau e pontes divertidas',
    focusLabel: 'Letras F, G e H • Traço Largo',
    emoji: '🦭',
    accentGradient: 'from-sky-100 via-cyan-50 to-indigo-100',
    coinReward: 40,
    xpReward: 45,
    challenges: [
      {
        id: 'wc_f',
        unitId: 'wc_unit_2_fgh',
        targetText: 'F',
        displayBadge: 'Consoante F • Traço Largo',
        emoji: '🦭',
        consonantTag: 'F',
        motorLevel: 'largo',
        title: 'Vamos cobrir a letra F de Foca!',
        prompt: 'Desça o traço em pé e puxe os dois bracinhos de cima para a direita.',
        teachScript:
          'Miau! Agora é a vez do F de Foca e Flor! Desça uma linha firme e puxe um bracinho lá no alto e outro no meio!',
        contextHint: 'F de Foca e Foguete!',
      },
      {
        id: 'wc_g',
        unitId: 'wc_unit_2_fgh',
        targetText: 'G',
        displayBadge: 'Consoante G • Traço Largo',
        emoji: '🐱',
        consonantTag: 'G',
        motorLevel: 'largo',
        title: 'Escrevendo o G de Gato como o Miau!',
        prompt: 'Contorne como um C, suba um pouco e puxe o tracinho para dentro.',
        teachScript:
          'Purrr! Essa é minha letra favorita: G de Gato! Contorne redondinho como o C e puxe um degrauzinho no meio para dentro.',
        contextHint: 'G de Gato e Girafa!',
      },
      {
        id: 'wc_h',
        unitId: 'wc_unit_2_fgh',
        targetText: 'H',
        displayBadge: 'Consoante H • Traço Médio',
        emoji: '🦛',
        consonantTag: 'H',
        motorLevel: 'medio',
        title: 'As duas torres do H de Hipopótamo!',
        prompt: 'Desça a torre esquerda, a torre direita e ligue no meio.',
        teachScript:
          'O H de Hipopótamo parece uma portinha com duas torres em pé e uma ponte no meio! Capriche nos três traços.',
        contextHint: 'H de Hipopótamo e Helicóptero!',
      },
    ],
  },
  {
    id: 'wc_unit_3_jkl',
    number: 3,
    title: 'Consoantes J, K e L',
    subtitle: 'Ganchinhos, diagonais e cantinhos bem feitos',
    focusLabel: 'Letras J, K e L • Traço Médio',
    emoji: '🐊',
    accentGradient: 'from-emerald-100 via-teal-50 to-sky-100',
    coinReward: 45,
    xpReward: 50,
    challenges: [
      {
        id: 'wc_j',
        unitId: 'wc_unit_3_jkl',
        targetText: 'J',
        displayBadge: 'Consoante J • Traço Médio',
        emoji: '🐊',
        consonantTag: 'J',
        motorLevel: 'medio',
        title: 'O ganchinho do J de Jacaré!',
        prompt: 'Desça e curve embaixo como um guarda-chuva, depois coloque o chapéu.',
        teachScript:
          'Miau! Olha o J de Jacaré e Joaninha! Desça com uma curvinha macia embaixo e finalize com o chapeuzinho no topo.',
        contextHint: 'J de Jacaré e Joaninha!',
      },
      {
        id: 'wc_k',
        unitId: 'wc_unit_3_jkl',
        targetText: 'K',
        displayBadge: 'Consoante K • Traço Médio',
        emoji: '🥝',
        consonantTag: 'K',
        motorLevel: 'medio',
        title: 'Cobrindo a letra K de Kiwi!',
        prompt: 'Faça a linha em pé e encoste os dois bracinhos inclinados no meio.',
        teachScript:
          'Vamos escrever o K de Kiwi! Trace a linha reta e depois faça as duas perninhas se encontrando no meio!',
        contextHint: 'K de Kiwi e Karaokê!',
      },
      {
        id: 'wc_l',
        unitId: 'wc_unit_3_jkl',
        targetText: 'L',
        displayBadge: 'Consoante L • Traço Médio',
        emoji: '🦁',
        consonantTag: 'L',
        motorLevel: 'medio',
        title: 'O cantinho da letra L de Leão!',
        prompt: 'Desça bem retinho pela esquerda e vire para a direita na base.',
        teachScript:
          'Roar! O L de Leão e Lua é super gostoso de escrever: desça retinho e faça a curva em L para a direita!',
        contextHint: 'L de Leão e Lua!',
      },
    ],
  },
  {
    id: 'wc_unit_4_mnp',
    number: 4,
    title: 'Consoantes M, N e P',
    subtitle: 'Montanhas altas e traços firmes com o dedo',
    focusLabel: 'Letras M, N e P • Traço Médio',
    emoji: '🐒',
    accentGradient: 'from-amber-100 via-orange-50 to-yellow-100',
    coinReward: 45,
    xpReward: 50,
    challenges: [
      {
        id: 'wc_m',
        unitId: 'wc_unit_4_mnp',
        targetText: 'M',
        displayBadge: 'Consoante M • Traço Médio',
        emoji: '🐒',
        consonantTag: 'M',
        motorLevel: 'medio',
        title: 'As duas montanhas do M de Macaco!',
        prompt: 'Suba à esquerda, faça o V no meio e desça à direita.',
        teachScript:
          'Miau! O M começa o meu nome e também o de Macaco! Suba a montanha, desça ao vale no meio e desça pelo outro lado!',
        contextHint: 'M de Macaco, Maçã e Miau!',
      },
      {
        id: 'wc_n',
        unitId: 'wc_unit_4_mnp',
        targetText: 'N',
        displayBadge: 'Consoante N • Traço Médio',
        emoji: '🚢',
        consonantTag: 'N',
        motorLevel: 'medio',
        title: 'Subindo e descendo no N de Navio!',
        prompt: 'Suba pela esquerda, escorregue na diagonal e suba pela direita.',
        teachScript:
          'Vamos navegar com o N de Navio e Nuvem! Suba à esquerda, escorregue até o cantinho de baixo e suba de novo!',
        contextHint: 'N de Navio e Nuvem!',
      },
      {
        id: 'wc_p',
        unitId: 'wc_unit_4_mnp',
        targetText: 'P',
        displayBadge: 'Consoante P • Traço Médio',
        emoji: '🦆',
        consonantTag: 'P',
        motorLevel: 'medio',
        title: 'Cobrindo a letra P de Pato!',
        prompt: 'Desça o traço reto e faça a cabecinha redonda no alto.',
        teachScript:
          'Quá-quá! O P de Pato e Peixe tem uma linha reta em pé e uma voltinha redonda lá no alto!',
        contextHint: 'P de Pato e Pipoca!',
      },
    ],
  },
  {
    id: 'wc_unit_5_qrs',
    number: 5,
    title: 'Consoantes Q, R e S',
    subtitle: 'Voltas completas, perninhas e curvas em S',
    focusLabel: 'Letras Q, R e S • Coordenação Média',
    emoji: '🧀',
    accentGradient: 'from-rose-100 via-pink-50 to-purple-100',
    coinReward: 50,
    xpReward: 55,
    challenges: [
      {
        id: 'wc_q',
        unitId: 'wc_unit_5_qrs',
        targetText: 'Q',
        displayBadge: 'Consoante Q • Traço Médio',
        emoji: '🧀',
        consonantTag: 'Q',
        motorLevel: 'medio',
        title: 'A bolinha com rabinho do Q de Queijo!',
        prompt: 'Feche o círculo bonito e puxe o tracinho embaixo à direita.',
        teachScript:
          'Miau! Para fazer o Q de Queijo, desenhe uma bola redonda bem fechadinha e depois coloque um rabinho inclinado embaixo!',
        contextHint: 'Q de Queijo e Quadrado!',
      },
      {
        id: 'wc_r',
        unitId: 'wc_unit_5_qrs',
        targetText: 'R',
        displayBadge: 'Consoante R • Traço Médio',
        emoji: '🐭',
        consonantTag: 'R',
        motorLevel: 'medio',
        title: 'Cobrindo a letra R de Rato!',
        prompt: 'Faça a forma do P e puxe a perninha escorregando para a direita.',
        teachScript:
          'Olha o R de Rato e Robô! Primeiro desça e faça a cabecinha no alto, depois puxe a perninha apoiada na base!',
        contextHint: 'R de Rato e Rei!',
      },
      {
        id: 'wc_s',
        unitId: 'wc_unit_5_qrs',
        targetText: 'S',
        displayBadge: 'Consoante S • Traço Fino',
        emoji: '🐸',
        consonantTag: 'S',
        motorLevel: 'fino',
        title: 'A curvinha sinuosa do S de Sapo!',
        prompt: 'Passe o dedo devagar seguindo as duas curvas da cobrinha do S.',
        teachScript:
          'Miau! O S de Sapo e Sol é uma cobrinha elegante! Curve lá em cima para a esquerda e deslize para a direita embaixo.',
        contextHint: 'S de Sapo e Sol!',
      },
    ],
  },
  {
    id: 'wc_unit_6_tvw',
    number: 6,
    title: 'Consoantes T, V e W',
    subtitle: 'Precisão fina em linhas retas e pontinhas ligadas',
    focusLabel: 'Letras T, V e W • Coordenação Fina',
    emoji: '🐢',
    accentGradient: 'from-teal-100 via-emerald-50 to-lime-100',
    coinReward: 55,
    xpReward: 60,
    challenges: [
      {
        id: 'wc_t',
        unitId: 'wc_unit_6_tvw',
        targetText: 'T',
        displayBadge: 'Consoante T • Traço Fino',
        emoji: '🐢',
        consonantTag: 'T',
        motorLevel: 'fino',
        title: 'Cobrindo o T de Tartaruga no traço fino!',
        prompt: 'Trace o chapéu lá no alto e desça bem no meio até a base.',
        teachScript:
          'Com calma de Tartaruga, vamos fazer o T no guia fino! Puxe o traço retinho no alto e desça pelo centro.',
        contextHint: 'T de Tartaruga e Trem!',
      },
      {
        id: 'wc_v',
        unitId: 'wc_unit_6_tvw',
        targetText: 'V',
        displayBadge: 'Consoante V • Traço Fino',
        emoji: '🐮',
        consonantTag: 'V',
        motorLevel: 'fino',
        title: 'Escorrega e sobe: letra V de Vaca!',
        prompt: 'Desça até uma pontinha bem no centro e suba firme para o alto.',
        teachScript:
          'Muu! O V de Vaca e Violão escorrega até uma ponta bem definida lá embaixo e sobe até o topo!',
        contextHint: 'V de Vaca e Vela!',
      },
      {
        id: 'wc_w',
        unitId: 'wc_unit_6_tvw',
        targetText: 'W',
        displayBadge: 'Consoante W • Traço Fino',
        emoji: '🧇',
        consonantTag: 'W',
        motorLevel: 'fino',
        title: 'Os dois Vs juntos do W de Wafer!',
        prompt: 'Desça, suba até o meio, desça de novo e suba firme até o fim.',
        teachScript:
          'Uau! O W parece dois Vs de mãos dadas! Vá devagarinho no guia fino: desce, sobe, desce e sobe!',
        contextHint: 'W de Wafer e Windsurf!',
      },
    ],
  },
  {
    id: 'wc_unit_7_xyz',
    number: 7,
    title: 'Consoantes Finais X, Y e Z',
    subtitle: 'Complete todo o alfabeto das consoantes do B ao Z!',
    focusLabel: 'Letras X, Y e Z • Mestre das Consoantes',
    emoji: '🦓',
    accentGradient: 'from-indigo-100 via-purple-50 to-pink-100',
    coinReward: 75,
    xpReward: 90,
    challenges: [
      {
        id: 'wc_x',
        unitId: 'wc_unit_7_xyz',
        targetText: 'X',
        displayBadge: 'Consoante X • Traço Fino',
        emoji: '☕',
        consonantTag: 'X',
        motorLevel: 'fino',
        title: 'Cruzando os dois traços do X de Xícara!',
        prompt: 'Faça um risco inclinado de cima para baixo e cruze com o outro no meio.',
        teachScript:
          'Miau! Olha o X de Xícara e Xilofone! Cruze dois escorregadores bem no meiozinho da caixa!',
        contextHint: 'X de Xícara e Xadrez!',
      },
      {
        id: 'wc_y',
        unitId: 'wc_unit_7_xyz',
        targetText: 'Y',
        displayBadge: 'Consoante Y • Traço Fino',
        emoji: '🧘',
        consonantTag: 'Y',
        motorLevel: 'fino',
        title: 'A forquilha equilibrada do Y de Yoga!',
        prompt: 'Junte dois tracinhos no meio e desça uma linha reta até a base.',
        teachScript:
          'Respiração zen com o Y de Yoga e Yakult! Faça o V curtinho no alto e desça retinho no meio!',
        contextHint: 'Y de Yoga e Yakissoba!',
      },
      {
        id: 'wc_z',
        unitId: 'wc_unit_7_xyz',
        targetText: 'Z',
        displayBadge: 'Consoante Z • Traço Fino',
        emoji: '🦓',
        consonantTag: 'Z',
        motorLevel: 'fino',
        title: 'Zigue-zague final: letra Z de Zebra!',
        prompt: 'Vá para a direita no alto, escorregue para a esquerda e volte à direita na base!',
        teachScript:
          'Parabéns por chegar à última letra! O Z de Zebra fecha todo o alfabeto com um zigue-zague super divertido!',
        contextHint: 'Z de Zebra e Zíper — Parabéns por completar do B ao Z!',
      },
    ],
  },
];
