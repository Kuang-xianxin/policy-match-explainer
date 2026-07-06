import { describe, expect, it } from 'vitest';
import {
  derivePolicyRules,
  fetchText,
  isMatchablePolicyDocument,
  parseListPage,
  type CollectedPolicyDocument,
  type PolicySourceConfig
} from '../services/longhua-policy-collector.js';

function documentFixture(overrides: Partial<CollectedPolicyDocument> = {}): CollectedPolicyDocument {
  return {
    title: '深圳市龙华区工业和信息化局关于印发专精特新企业数字化转型资助申报指南的通知',
    documentType: 'application_guide',
    sourceUrl: 'https://www.szlhq.gov.cn/xxgk/xwzx/tzgg/content/post_rule.html',
    listUrl: 'https://www.szlhq.gov.cn/xxgk/xwzx/tzgg/index.html',
    sourceSite: '龙华政府在线',
    sourceDepartment: '深圳市龙华区工业和信息化局',
    publishDate: '2026-01-02',
    contentText: '支持龙华区企业围绕智能制造、数字化改造、专精特新和研发投入开展项目申报。',
    rawHtml: '<html>rule</html>',
    rawPayload: { attachments: [] },
    ...overrides
  };
}

describe('longhua policy collector pure behavior', () => {
  const policySource: PolicySourceConfig = {
    name: 'policy-files',
    listUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html',
    documentType: 'policy_file',
    maxPages: 1,
    sourceDepartment: '深圳市龙华区人民政府'
  };

  it('falls back to the legacy TLS fetcher when the public site rejects default TLS negotiation', async () => {
    const badEcpointError = new TypeError('fetch failed');
    badEcpointError.cause = { code: 'ERR_SSL_BAD_ECPOINT', message: 'bad ecpoint' };

    const html = await fetchText('https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html', {
      fetcher: async () => {
        throw badEcpointError;
      },
      legacyTlsFetcher: async (url) => `<html>${url}</html>`
    });

    expect(html).toContain('qzcxwj/index.html');
  });

  it('uses the legacy TLS fetcher for generic fetch failures on the Longhua public site', async () => {
    const html = await fetchText('https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html', {
      fetcher: async () => {
        throw new TypeError('fetch failed');
      },
      legacyTlsFetcher: async () => '<html>legacy ok</html>'
    });

    expect(html).toBe('<html>legacy ok</html>');
  });

  it('derives an initial rule set for imported Longhua enterprise policy documents', () => {
    const rules = derivePolicyRules(documentFixture());

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field_key: 'district', operator: 'equals', expected_value: '龙华区', required: true }),
        expect.objectContaining({ field_key: 'has_specialized_new_sme', operator: 'is_true', expected_value: true }),
        expect.objectContaining({ field_key: 'project_direction', operator: 'in' }),
        expect.objectContaining({ field_key: 'rd_expense_ratio', operator: 'gte' })
      ])
    );
  });

  it('keeps result notices and procurement notices out of matchable policy rules', () => {
    expect(
      isMatchablePolicyDocument(
        documentFixture({
          title: '章阁重点企业周边环境提升工程施工中标公告',
          documentType: 'department_notice',
          contentText: '章阁重点企业周边环境提升工程施工中标结果公告。'
        })
      )
    ).toBe(false);
    expect(
      isMatchablePolicyDocument(
        documentFixture({
          title: '龙华区2026年科技创新专项资金拟资助名单公示',
          documentType: 'department_notice',
          contentText: '现将拟资助名单予以公示。'
        })
      )
    ).toBe(false);
    expect(
      isMatchablePolicyDocument(
        documentFixture({
          title: '深圳市龙华区科技创新局关于开展科技创新专项资金申报的通知',
          documentType: 'department_notice',
          contentText: '支持龙华区企业申报科技创新专项资金。'
        })
      )
    ).toBe(true);
  });

  it('extracts policy-file records embedded in the Longhua policy library page script', () => {
    const html = `
      <script>
        var zcData = [{
          'title':'深圳市龙华区人民政府关于印发《龙华区促进上市培育服务工作三年行动方案》的通知',
          'display_publish_time':1751299200,
          'source':'龙华区发展和改革局',
          'url':'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/content/post_12257851.html',
          'EXT_isvalid':'是',
          'EXT_qytsfl':'金融扶持'
        }];
      </script>
    `;

    const items = parseListPage(html, policySource.listUrl, policySource);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: '深圳市龙华区人民政府关于印发《龙华区促进上市培育服务工作三年行动方案》的通知',
      sourceUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/content/post_12257851.html',
      publishDate: '2025-07-01',
      sourceDepartment: '龙华区发展和改革局',
      documentType: 'policy_file'
    });
  });
});
