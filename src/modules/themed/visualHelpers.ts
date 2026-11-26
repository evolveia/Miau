export function createPastelVisualSvgUrl(
  emoji: string,
  badge: string,
  bgStart = '#eef6ff',
  bgEnd = '#e4dcff',
  ringColor = '#6e45a5'
): string {
  const safeBadge = badge.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bgStart}"/><stop offset="100%" stop-color="${bgEnd}"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#g)" stroke="${ringColor}" stroke-width="3"/><circle cx="60" cy="52" r="34" fill="#ffffff" fill-opacity="0.78"/><text x="60" y="64" font-size="42" text-anchor="middle">${emoji}</text><rect x="14" y="90" width="92" height="20" rx="10" fill="${ringColor}"/><text x="60" y="104" font-family="sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">${safeBadge}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createColorSwatchSvgUrl(
  fillHex: string,
  ringHex: string,
  label: string
): string {
  const safeLabel = label.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#ffffff" stroke="${ringHex}" stroke-width="3"/><circle cx="60" cy="52" r="32" fill="${fillHex}" stroke="${ringHex}" stroke-width="4"/><ellipse cx="48" cy="39" rx="10" ry="6" fill="#ffffff" fill-opacity="0.45" transform="rotate(-25 48 39)"/><rect x="14" y="90" width="92" height="20" rx="10" fill="${ringHex}"/><text x="60" y="104" font-family="sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type GeometricShapeKind =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'rectangle'
  | 'star'
  | 'heart'
  | 'big_small';

export function createShapeSvgUrl(
  kind: GeometricShapeKind,
  fillHex: string,
  strokeHex: string,
  badge: string
): string {
  const safeBadge = badge.replace(/[<>&"']/g, '');
  let shapeEl = '';
  if (kind === 'circle') {
    shapeEl = `<circle cx="60" cy="50" r="28" fill="${fillHex}" stroke="${strokeHex}" stroke-width="4"/>`;
  } else if (kind === 'square') {
    shapeEl = `<rect x="33" y="23" width="54" height="54" rx="6" fill="${fillHex}" stroke="${strokeHex}" stroke-width="4"/>`;
  } else if (kind === 'triangle') {
    shapeEl = `<polygon points="60,20 90,74 30,74" fill="${fillHex}" stroke="${strokeHex}" stroke-width="4" stroke-linejoin="round"/>`;
  } else if (kind === 'rectangle') {
    shapeEl = `<rect x="20" y="31" width="80" height="40" rx="6" fill="${fillHex}" stroke="${strokeHex}" stroke-width="4"/>`;
  } else if (kind === 'star') {
    shapeEl = `<polygon points="60,18 68,38 90,39 73,53 79,74 60,62 41,74 47,53 30,39 52,38" fill="${fillHex}" stroke="${strokeHex}" stroke-width="3.5" stroke-linejoin="round"/>`;
  } else if (kind === 'heart') {
    shapeEl = `<path d="M60 76 C60 76 28 56 28 38 C28 27 37 21 47 21 C53 21 58 25 60 29 C62 25 67 21 73 21 C83 21 92 27 92 38 C92 56 60 76 60 76 Z" fill="${fillHex}" stroke="${strokeHex}" stroke-width="3.5" stroke-linejoin="round"/>`;
  } else {
    shapeEl = `<circle cx="42" cy="48" r="23" fill="${fillHex}" stroke="${strokeHex}" stroke-width="3.5"/><circle cx="84" cy="56" r="11" fill="#fde047" stroke="${strokeHex}" stroke-width="3"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#f8f7ff" stroke="${strokeHex}" stroke-width="3"/>${shapeEl}<rect x="14" y="90" width="92" height="20" rx="10" fill="${strokeHex}"/><text x="60" y="104" font-family="sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">${safeBadge}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createCountingSvgUrl(
  emoji: string,
  count: number,
  badge: string,
  bgStart = '#e0f2fe',
  bgEnd = '#ede9fe',
  ringColor = '#4f46e5'
): string {
  const safeBadge = badge.replace(/[<>&"']/g, '');
  const clamped = Math.max(1, Math.min(20, count));
  const cols = clamped <= 4 ? clamped : clamped <= 9 ? 3 : 5;
  const rows = Math.ceil(clamped / cols);
  const fontSize = clamped <= 6 ? 24 : clamped <= 12 ? 18 : 15;
  const areaWidth = 104;
  const areaHeight = 76;
  const cellW = areaWidth / cols;
  const cellH = areaHeight / rows;

  const items: string[] = [];
  for (let i = 0; i < clamped; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = Math.round(18 + c * cellW + cellW / 2);
    const y = Math.round(12 + r * cellH + cellH / 2 + fontSize * 0.34);
    items.push(
      `<text x="${x}" y="${y}" font-size="${fontSize}" text-anchor="middle">${emoji}</text>`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 120"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bgStart}"/><stop offset="100%" stop-color="${bgEnd}"/></linearGradient></defs><rect width="140" height="120" rx="24" fill="url(#cg)" stroke="${ringColor}" stroke-width="3"/><rect x="10" y="8" width="120" height="78" rx="16" fill="#ffffff" fill-opacity="0.78"/>${items.join('')}<rect x="20" y="92" width="100" height="20" rx="10" fill="${ringColor}"/><text x="70" y="106" font-family="sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">${safeBadge}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function renderGroupedEmojisSvg(
  emoji: string,
  count: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  dimmed = false
): string {
  const clamped = Math.max(0, Math.min(10, count));
  if (clamped === 0) {
    return `<text x="${Math.round(x0 + w / 2)}" y="${Math.round(y0 + h / 2 + 5)}" font-family="sans-serif" font-size="14" font-weight="bold" fill="#94a3b8" text-anchor="middle">0</text>`;
  }
  const cols = clamped <= 2 ? clamped : clamped <= 6 ? 3 : 4;
  const rows = Math.ceil(clamped / cols);
  const fontSize = clamped <= 2 ? 20 : clamped <= 6 ? 15 : 12;
  const cellW = w / cols;
  const cellH = h / rows;
  const parts: string[] = [];
  for (let i = 0; i < clamped; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = Math.round(x0 + c * cellW + cellW / 2);
    const y = Math.round(y0 + r * cellH + cellH / 2 + fontSize * 0.35);
    parts.push(
      `<text x="${x}" y="${y}" font-size="${fontSize}" text-anchor="middle"${dimmed ? ' opacity="0.45"' : ''}>${emoji}</text>`
    );
    if (dimmed) {
      parts.push(
        `<line x1="${x - 6}" y1="${y - 10}" x2="${x + 6}" y2="${y + 2}" stroke="#e11d48" stroke-width="2" stroke-linecap="round"/>`
      );
    }
  }
  return parts.join('');
}

export function createMathEquationSvgUrl(
  leftEmoji: string,
  leftCount: number,
  operator: '+' | '-',
  rightEmoji: string,
  rightCount: number,
  resultLabel: string,
  badge: string,
  bgStart = '#eff6ff',
  bgEnd = '#fef3c7',
  ringColor = '#6366f1'
): string {
  const safeBadge = badge.replace(/[<>&"']/g, '');
  const safeResult = resultLabel.replace(/[<>&"']/g, '');
  const opColor = operator === '+' ? '#16a34a' : '#e11d48';
  const leftItems = renderGroupedEmojisSvg(leftEmoji, leftCount, 12, 16, 62, 60, false);
  const rightItems = renderGroupedEmojisSvg(
    rightEmoji,
    rightCount,
    102,
    16,
    62,
    60,
    operator === '-'
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 130"><defs><linearGradient id="meq" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bgStart}"/><stop offset="100%" stop-color="${bgEnd}"/></linearGradient></defs><rect width="240" height="130" rx="22" fill="url(#meq)" stroke="${ringColor}" stroke-width="3"/><rect x="10" y="12" width="66" height="68" rx="14" fill="#ffffff" fill-opacity="0.88" stroke="#cbd5e1" stroke-width="1.5"/>${leftItems}<circle cx="88" cy="46" r="11" fill="${opColor}"/><text x="88" y="51" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">${operator}</text><rect x="100" y="12" width="66" height="68" rx="14" fill="#ffffff" fill-opacity="0.88" stroke="${operator === '-' ? '#fda4af' : '#cbd5e1'}" stroke-width="1.5"/>${rightItems}<text x="178" y="52" font-family="sans-serif" font-size="18" font-weight="bold" fill="${ringColor}" text-anchor="middle">=</text><rect x="188" y="20" width="42" height="52" rx="14" fill="#ffffff" stroke="${ringColor}" stroke-width="3"/><text x="209" y="53" font-family="sans-serif" font-size="22" font-weight="bold" fill="${ringColor}" text-anchor="middle">${safeResult}</text><rect x="28" y="94" width="184" height="24" rx="12" fill="${ringColor}"/><text x="120" y="110" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">${safeBadge}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createMathCompareSvgUrl(
  leftEmoji: string,
  leftCount: number,
  leftLabel: string,
  centerSymbol: string,
  rightEmoji: string,
  rightCount: number,
  rightLabel: string,
  badge: string,
  ringColor = '#7c3aed'
): string {
  const safeBadge = badge.replace(/[<>&"']/g, '');
  const safeLeft = leftLabel.replace(/[<>&"']/g, '');
  const safeRight = rightLabel.replace(/[<>&"']/g, '');
  const safeCenter = centerSymbol.replace(/[<>&"']/g, '');
  const leftItems = renderGroupedEmojisSvg(leftEmoji, leftCount, 14, 14, 78, 56, false);
  const rightItems = renderGroupedEmojisSvg(rightEmoji, rightCount, 148, 14, 78, 56, false);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 130"><rect width="240" height="130" rx="22" fill="#f5f3ff" stroke="${ringColor}" stroke-width="3"/><rect x="12" y="12" width="82" height="72" rx="14" fill="#ffffff" stroke="#c4b5fd" stroke-width="2"/>${leftItems}<text x="53" y="80" font-family="sans-serif" font-size="11" font-weight="bold" fill="#4c1d95" text-anchor="middle">${safeLeft}</text><circle cx="120" cy="48" r="16" fill="#fef3c7" stroke="${ringColor}" stroke-width="2.5"/><text x="120" y="54" font-family="sans-serif" font-size="18" font-weight="bold" fill="${ringColor}" text-anchor="middle">${safeCenter}</text><rect x="146" y="12" width="82" height="72" rx="14" fill="#ffffff" stroke="#c4b5fd" stroke-width="2"/>${rightItems}<text x="187" y="80" font-family="sans-serif" font-size="11" font-weight="bold" fill="#4c1d95" text-anchor="middle">${safeRight}</text><rect x="28" y="94" width="184" height="24" rx="12" fill="${ringColor}"/><text x="120" y="110" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">${safeBadge}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
