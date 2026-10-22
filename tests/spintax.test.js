import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpintax } from '../lib/spintax.js';

describe('Spintax Parser', () => {
  it('should return plain text unchanged when no spintax syntax is present', () => {
    const text = 'Chào bạn, mình nhận làm phần mềm.';
    assert.equal(parseSpintax(text), text);
  });

  it('should resolve simple 1-level spintax', () => {
    const template = '{Chào|Hi|Hello} bạn';
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(parseSpintax(template));
    }
    assert.ok(results.has('Chào bạn'));
    assert.ok(results.has('Hi bạn'));
    assert.ok(results.has('Hello bạn'));
    assert.equal(results.size, 3);
  });

  it('should resolve nested spintax correctly', () => {
    const template = '{Chào {bạn|fen}|Hello {bro|fen}}';
    const validOutputs = [
      'Chào bạn',
      'Chào fen',
      'Hello bro',
      'Hello fen'
    ];
    for (let i = 0; i < 40; i++) {
      const output = parseSpintax(template);
      assert.ok(validOutputs.includes(output), `Unexpected output: ${output}`);
    }
  });

  it('should handle multiple spintax blocks in one sentence', () => {
    const template = '{Chào|Hi} fen, {mình|team mình} nhận {làm web|viết bot}.';
    const output = parseSpintax(template);
    assert.ok(output.startsWith('Chào fen') || output.startsWith('Hi fen'));
    assert.ok(output.includes('mình nhận') || output.includes('team mình nhận'));
    assert.ok(output.endsWith('làm web.') || output.endsWith('viết bot.'));
  });

  it('should support deterministic selection with custom randomFn', () => {
    const template = '{A|B|C}';
    // randomFn always returning 0 selects first option 'A'
    const first = parseSpintax(template, () => 0);
    assert.equal(first, 'A');

    // randomFn returning 0.99 selects last option 'C'
    const last = parseSpintax(template, () => 0.99);
    assert.equal(last, 'C');
  });
});
