import { describe, expect, it } from 'vitest';
import {
  normalizeEditablePromptSegments_ACU,
  normalizePromptSegments_ACU,
} from '../../../src/service/agent/agent-prompt-template';

const fallback = [{ role: 'system', content: 'fallback', deletable: false }];

describe('agent prompt template normalization', () => {
  it('keeps empty prompt segments in editing normalization', () => {
    const result = normalizeEditablePromptSegments_ACU([
      { role: 'USER', content: '', deletable: true },
    ], fallback);

    expect(result).toEqual([{ role: 'user', content: '', deletable: true }]);
  });

  it('filters empty prompt segments in runtime normalization', () => {
    const result = normalizePromptSegments_ACU([
      { role: 'USER', content: '', deletable: true },
    ], fallback);

    expect(result).toEqual(fallback);
  });
});
