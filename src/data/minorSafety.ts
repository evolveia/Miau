export const MINOR_REFUSAL_TEXT = 'Vamos falar de outros assuntos e coisas boas?';

export function isMinorAgeClient(age?: number | null): boolean {
  return typeof age === 'number' && Number.isFinite(age) && age >= 0 && age < 18;
}

function normalizeClientSafetyText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CLIENT_MINOR_UNSAFE_PATTERNS: RegExp[] = [
  /\b(sexo|sexual|sexuais|transar|transa|porn|porno|pornografia|erotic[oa]|nudez|nudes|pelad[oa]s?|orgasmo|masturb|prostit|fetiche|boquete|punheta|penis|vagina|bunda|peito[s]?\s+nu|hentai|nsfw|onlyfans|estupr[oa])\b/,
  /\b(droga[s]?|cocaina|crack|maconha|heroina|lsd|ecstasy|metanfetamina|trafico|traficante|entorpecente|overdose|cheirar\s+po|fumar\s+beck|baseado|cigarro|vape|bebida\s+alcoolica|cachaca|vodka|cerveja|embebedar|ficar\s+bebado|roubar|furto|assalt[oa]|lavagem\s+de\s+dinheiro|crime|criminoso|ilicito|ilegal)\b/,
  /\b(suicid|me\s+matar|se\s+matar|automutil|cortar\s+os\s+pulsos|enforcar|bomba|explosiv[oa]|arma\s+de\s+fogo|pistola|fuzil|revolver|esfaquear|matar\s+alguem|assassin[oa]|homicidio|sequestr[oa]|tortur[oa]|terroris|veneno\s+para\s+matar)\b/,
  /\b(racis[mt]|nazis[mt]|supremacia\s+branca|preconceit[oa]|homofob|transfob|xenofob|capacitismo|antissemit|macaco\s+sujo|preto\s+imundo|crioulo|viadinho|bichinha|sapat[ao]|aleijado|retardado|escoria|inferioridade\s+racial)\b/,
  /\b(porra|caralho|puta|putaria|vagabunda|arrombad[oa]|cuzao|foda\s*se|vai\s+tomar\s+no\s+cu|filho\s+da\s+puta|merda\s+de|desgracad[oa])\b/,
];

export function isUnsafeTopicForMinorClient(text: string): boolean {
  const norm = normalizeClientSafetyText(text);
  if (!norm) return false;
  return CLIENT_MINOR_UNSAFE_PATTERNS.some((rx) => rx.test(norm));
}
