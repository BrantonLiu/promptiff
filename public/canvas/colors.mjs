export const colorStorageKey = 'promptiff.comparisonColors.v1';
export const defaultColors = Object.freeze({ similar: '#b6d4f0', different: '#f9dc84' });

const validColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export function readColors(storage) {
  try {
    const saved = JSON.parse(storage.getItem(colorStorageKey));
    return {
      similar: validColor(saved?.similar) ? saved.similar.toLowerCase() : defaultColors.similar,
      different: validColor(saved?.different) ? saved.different.toLowerCase() : defaultColors.different,
    };
  } catch {
    return { ...defaultColors };
  }
}

export function blendColors(different, similar, amount) {
  const t = Math.max(0, Math.min(1, amount));
  const channel = (hex, index) => Number.parseInt(hex.slice(index, index + 2), 16);
  return `rgb(${[1, 3, 5].map((index) => Math.round(channel(different, index) * (1 - t) + channel(similar, index) * t)).join(', ')})`;
}
