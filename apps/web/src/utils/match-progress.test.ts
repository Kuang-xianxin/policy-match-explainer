import { describe, expect, it } from 'vitest';
import {
  lookupProgressSteps,
  matchProgressPercent,
  matchProgressSteps,
  operationEstimate,
  progressPercent
} from './match-progress';

describe('match progress steps', () => {
  it('marks earlier matching steps as done and the current step as active', () => {
    expect(matchProgressSteps('ai_review')).toEqual([
      expect.objectContaining({ key: 'saving_profile', status: 'done' }),
      expect.objectContaining({ key: 'scoring_rules', status: 'done' }),
      expect.objectContaining({ key: 'ai_review', status: 'active' }),
      expect.objectContaining({ key: 'opening_results', status: 'pending' })
    ]);
  });

  it('marks candidate lookup stages and exposes expected time for search actions', () => {
    expect(lookupProgressSteps('web_research')).toEqual([
      expect.objectContaining({ key: 'planning_query', status: 'done' }),
      expect.objectContaining({ key: 'web_research', status: 'active' }),
      expect.objectContaining({ key: 'candidate_filtering', status: 'pending' })
    ]);
    expect(operationEstimate('candidate_search')).toEqual({
      label: '预计 30-45 秒',
      estimatedSeconds: 45
    });
  });

  it('exposes expected time for candidate profile generation', () => {
    expect(operationEstimate('profile_generation')).toEqual({
      label: '预计 20-40 秒',
      estimatedSeconds: 40
    });
  });

  it('caps simulated progress before completion so the UI never appears stuck at 100%', () => {
    expect(progressPercent(0, 45)).toBe(8);
    expect(progressPercent(20, 45)).toBe(44);
    expect(progressPercent(60, 45)).toBe(92);
    expect(matchProgressPercent('ai_review', 10)).toBeGreaterThan(50);
  });
});
