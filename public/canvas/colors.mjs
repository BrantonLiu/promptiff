export const colorStorageKey = 'promptiff.comparisonColors.v1';
export const defaultColors = Object.freeze({ similar: '#b6d4f0', different: '#f9dc84' });
export const colorPresets = Object.freeze([
  { id: 'classic', name: '经典蓝金', nameEn: 'Classic blue & gold', ...defaultColors },
  { id: 'sage', name: '鼠尾草与杏', nameEn: 'Sage & apricot', similar: '#c9e2d2', different: '#f4d8b5' },
  { id: 'lilac', name: '雾紫与珊瑚', nameEn: 'Lilac & coral', similar: '#d8d0ed', different: '#f2ccbe' },
  { id: 'sea', name: '海盐与暖沙', nameEn: 'Sea salt & sand', similar: '#b9dde2', different: '#efd8bd' },
]);

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
