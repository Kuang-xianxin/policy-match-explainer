import { describe, expect, it } from 'vitest';
import { reportActionText, reportNotice } from './report-feedback';

describe('report feedback helpers', () => {
  it('makes report generation action text explicit before and during generation', () => {
    expect(reportActionText(false)).toBe('生成综合评估报告');
    expect(reportActionText(true)).toBe('正在生成报告...');
  });

  it('shows a prominent completion notice after the report is generated', () => {
    expect(reportNotice('completed')).toEqual({
      tone: 'success',
      title: '报告已生成',
      message: '综合评估报告已更新到下方报告区，可继续查看建议动作和申报风险。'
    });
  });
});
