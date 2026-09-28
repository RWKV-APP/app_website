import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCumulativeNotes } from './sync-release-notes.mjs';

test('a patch release preserves its series history and the latest approved build', () => {
  const original = '## 4.8.0\n\n- [New] PALM CPU\n- [New] G1j\n';
  const corrected = '## 4.8.1\n\n- [Fix] Works without key setup\n';
  const latest = '## 4.8.2\n\n- [Improved] Performance\n';
  const notes = {
    '754-4.7.2.md': '## 4.7.2\n\n- Previous series\n',
    '755-4.8.0.md': original,
    '756-4.8.1.md': '## 4.8.1\n\n- [Fix] Requires key setup\n',
    '757-4.8.1.md': corrected,
    '758-4.8.2.md': latest,
  };
  const expected = [latest.trim(), corrected.trim(), original.trim()].join('\n\n') + '\n';
  assert.equal(buildCumulativeNotes('758-4.8.2.md', notes), expected);
  notes['758-4.8.2.md'] = expected;
  assert.equal(buildCumulativeNotes('758-4.8.2.md', notes), expected);
  assert.equal(
    buildCumulativeNotes('758-4.8.2.md', {
      ...notes,
      '758-4.8.2.md': expected.replaceAll('\n', '\r\n'),
    }),
    expected,
  );

  for (const invalid of [
    expected.replace('- [New] G1j\n', ''),
    expected + '\n## 4.7.2\n\n- Wrong series\n',
    expected + '\n## 4.8.0\n\n- Duplicate\n',
    '## 4.8.2\n',
    '## 4.8.3\n\n- Wrong version\n',
  ]) {
    assert.throws(() =>
      buildCumulativeNotes('758-4.8.2.md', {
        ...notes,
        '758-4.8.2.md': invalid,
      }),
    );
  }
  notes['759-4.9.0.md'] = '## 4.9.0\n\n- A new minor series\n';
  assert.equal(buildCumulativeNotes('759-4.9.0.md', notes), notes['759-4.9.0.md']);
});
