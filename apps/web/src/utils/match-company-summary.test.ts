import { describe, expect, it } from 'vitest';
import { matchCompanySummary } from './match-company-summary';

describe('matchCompanySummary', () => {
  it('summarizes the company behind the current match result', () => {
    expect(
      matchCompanySummary({
        company_name: '深圳华傲数据技术有限公司',
        credit_code: '914403007488656882',
        city: '深圳市',
        district: '龙华区'
      })
    ).toEqual({
      title: '深圳华傲数据技术有限公司',
      detail: '914403007488656882 · 深圳市龙华区',
      location: '深圳市龙华区'
    });
  });

  it('returns null when no company snapshot is available', () => {
    expect(matchCompanySummary(null)).toBeNull();
  });
});
