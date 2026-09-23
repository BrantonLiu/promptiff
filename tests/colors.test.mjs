import test from 'node:test';
import assert from 'node:assert/strict';
import { blendColors, colorStorageKey, defaultColors, readColors } from '../public/canvas/colors.mjs';

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
