import { describe, expect, it } from 'vitest';
import { renderReportMarkdown } from './report-markdown';

describe('renderReportMarkdown', () => {
  it('turns markdown heading markers into structured headings instead of visible hashes', () => {
    const blocks = renderReportMarkdown(
      [
        '#### 综合结论',
        '企业具备申报基础。',
        '',
        '- 准备营业执照',
        '- 准备研发费用辅助账',
        '',
        '1. 先核对政策原文',
        '2. 再补齐材料'
      ].join('\n')
    );

    expect(blocks[0]).toEqual({ type: 'heading', level: 4, text: '综合结论' });
    expect(JSON.stringify(blocks)).not.toContain('####');
    expect(blocks).toContainEqual({
      type: 'list',
      ordered: false,
      items: ['准备营业执照', '准备研发费用辅助账']
    });
    expect(blocks).toContainEqual({
      type: 'list',
      ordered: true,
      items: ['先核对政策原文', '再补齐材料']
    });
  });

  it('treats known report section titles as headings even without markdown hashes', () => {
    expect(renderReportMarkdown('材料准备清单\n- 营业执照')[0]).toEqual({
      type: 'heading',
      level: 2,
      text: '材料准备清单'
    });
  });
});
