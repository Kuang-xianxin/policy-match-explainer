import { describe, expect, it } from 'vitest';
import { matchProgressSteps } from './match-progress';

describe('match progress steps', () => {
  it('marks earlier matching steps as done and the current step as active', () => {
    expect(matchProgressSteps('ai_review')).toEqual([
      expect.objectContaining({ key: 'saving_profile', status: 'done' }),
      expect.objectContaining({ key: 'scoring_rules', status: 'done' }),
      expect.objectContaining({ key: 'ai_review', status: 'active' }),
      expect.objectContaining({ key: 'opening_results', status: 'pending' })
    ]);
  });
});
