import test from 'node:test';
import assert from 'node:assert/strict';
import { blendColors, colorPresets, colorStorageKey, defaultColors, readColors } from '../public/canvas/colors.mjs';

test('comparison colors restore defaults and reject malformed stored values', () => {
  const storage = { getItem: () => null };
  assert.deepEqual(readColors(storage), defaultColors);
  storage.getItem = () => JSON.stringify({ similar: '#123456', different: 'red' });
  assert.deepEqual(readColors(storage), { similar: '#123456', different: defaultColors.different });
  storage.getItem = () => '{';
  assert.deepEqual(readColors(storage), defaultColors);
  assert.equal(colorStorageKey, 'promptiff.comparisonColors.v1');
});

test('comparison color scale uses exact chosen endpoints', () => {
  assert.equal(blendColors('#000000', '#ffffff', 0), 'rgb(0, 0, 0)');
  assert.equal(blendColors('#000000', '#ffffff', 0.5), 'rgb(128, 128, 128)');
  assert.equal(blendColors('#000000', '#ffffff', 1), 'rgb(255, 255, 255)');
});

test('curated comparison palettes are distinct, valid, and keep the classic default', () => {
  assert.deepEqual(
    { similar: colorPresets[0].similar, different: colorPresets[0].different },
    defaultColors,
  );
  assert.equal(new Set(colorPresets.map(({ similar, different }) => `${similar}/${different}`)).size, colorPresets.length);
  for (const preset of colorPresets) {
    assert.match(preset.similar, /^#[0-9a-f]{6}$/);
    assert.match(preset.different, /^#[0-9a-f]{6}$/);
    assert.notEqual(preset.similar, preset.different);
  }
});
