import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import { pool, closePool } from '../db/pool.js';
import { resetDatabase } from '../db/reset.js';
import {
  collectLonghuaPolicies,
  pageUrlFor,
  parseDetailPage,
  parseListPage,
  upsertCollectedDocuments,
  type CollectedPolicyDocument,
  type PolicySourceConfig
} from '../services/longhua-policy-collector.js';

const policySource: PolicySourceConfig = {
  name: 'policy-files',
  listUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html',
  documentType: 'policy_file',
  maxPages: 2,
  sourceDepartment: '深圳市龙华区人民政府'
};

const noticeSource: PolicySourceConfig = {
  name: 'notices',
  listUrl: 'https://www.szlhq.gov.cn/xxgk/xwzx/tzgg/index.html',
  documentType: 'department_notice',
  maxPages: 1
};

describe('longhua policy collector', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closePool();
  });

  it('builds Longhua pagination URLs used by public list pages', () => {
    expect(pageUrlFor(policySource.listUrl, 1)).toBe(policySource.listUrl);
    expect(pageUrlFor(policySource.listUrl, 2)).toBe(
      'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index_2.html'
    );
  });

  it('extracts enterprise policy links from list pages and classifies application guides', () => {
    const html = `
      <ul>
        <li><a href="/xxgk/zcfg/qgfxwj/qzcxwj/content/post_128.html">关于印发《深圳市龙华区推动现代时尚文旅产业发展的若干措施申报指南（非时尚活动类）》的通知 2025-07-02</a></li>
        <li><a href="/xxgk/xwzx/tzgg/content/post_999.html">关于龙华区2026年第三季度建设工程招标计划的公示 2026-07-03</a></li>
      </ul>
    `;

    const policyItems = parseListPage(html, policySource.listUrl, policySource);
    expect(policyItems).toHaveLength(2);
    expect(policyItems[0]).toMatchObject({
      title: '关于印发《深圳市龙华区推动现代时尚文旅产业发展的若干措施申报指南（非时尚活动类）》的通知',
      documentType: 'application_guide',
      publishDate: '2025-07-02'
    });
    expect(policyItems[0].sourceUrl).toBe('https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/content/post_128.html');

    const noticeItems = parseListPage(html, noticeSource.listUrl, noticeSource);
    expect(noticeItems.map((item) => item.title)).toContain(
      '关于印发《深圳市龙华区推动现代时尚文旅产业发展的若干措施申报指南（非时尚活动类）》的通知'
    );
    expect(noticeItems.map((item) => item.title)).not.toContain('关于龙华区2026年第三季度建设工程招标计划的公示');
  });

  it('extracts title, department, date, content, and attachments from detail pages', () => {
    const html = `
      <html>
        <head><title>深圳市龙华区科技创新局关于开展科技创新专项资金申报的通知</title></head>
        <body>
          <h1>深圳市龙华区科技创新局关于开展科技创新专项资金申报的通知</h1>
          <span>发布机构：深圳市龙华区科技创新局</span>
          <span>发布日期：2025-06-20</span>
          <div class="content">
            <p>支持龙华区企业申报科技创新专项资金，申报单位应具有独立法人资格。</p>
            <script>window.noise = true;</script>
            <a href="./P020250620123456.pdf">附件：申报材料清单.pdf</a>
          </div>
        </body>
      </html>
    `;

    const item = parseListPage(
      '<a href="/xxgk/xwzx/tzgg/content/post_200.html">深圳市龙华区科技创新局关于开展科技创新专项资金申报的通知 2025-06-20</a>',
      noticeSource.listUrl,
      noticeSource
    )[0];
    const detail = parseDetailPage(html, item);

    expect(detail.title).toBe('深圳市龙华区科技创新局关于开展科技创新专项资金申报的通知');
    expect(detail.publishDate).toBe('2025-06-20');
    expect(detail.sourceDepartment).toBe('深圳市龙华区科技创新局');
    expect(detail.contentText).toContain('支持龙华区企业申报科技创新专项资金');
    expect(detail.contentText).not.toContain('window.noise');
    expect(detail.rawPayload.attachments).toEqual([
      {
        title: '附件：申报材料清单.pdf',
        url: 'https://www.szlhq.gov.cn/xxgk/xwzx/tzgg/content/P020250620123456.pdf'
      }
    ]);
  });

  it('upserts all source documents and syncs only matchable policy documents into policies', async () => {
    const documents: CollectedPolicyDocument[] = [
      {
        title: '深圳市龙华区科技创新专项资金申报指南',
        documentType: 'application_guide',
        sourceUrl: 'https://www.szlhq.gov.cn/xxgk/xwzx/tzgg/content/post_a.html',
        listUrl: noticeSource.listUrl,
        sourceSite: '龙华政府在线',
        sourceDepartment: '深圳市龙华区科技创新局',
        publishDate: '2025-06-20',
        contentText: '支持龙华区企业申报科技创新专项资金。',
        rawHtml: '<html>guide</html>',
        rawPayload: { attachments: [] }
      },
      {
        title: '《深圳市龙华区科技创新专项资金申报指南》政策解读',
        documentType: 'policy_interpretation',
        sourceUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/zcjd/content/post_b.html',
        listUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/zcjd/qnzcjd/index.html',
        sourceSite: '龙华政府在线',
        sourceDepartment: '深圳市龙华区科技创新局',
        publishDate: '2025-06-21',
        contentText: '本解读说明申报指南背景。',
        rawHtml: '<html>interpretation</html>',
        rawPayload: { attachments: [] }
      }
    ];

    const first = await upsertCollectedDocuments(pool, documents);
    const second = await upsertCollectedDocuments(pool, documents);

    expect(first.sourceDocumentsInserted).toBe(2);
    expect(first.policiesUpserted).toBe(1);
    expect(second.sourceDocumentsInserted).toBe(0);
    expect(second.sourceDocumentsUpdated).toBe(2);
    expect(second.policiesUpserted).toBe(1);

    const sourceCount = await pool.query('SELECT count(*)::int AS count FROM source_documents');
    const policyCount = await pool.query('SELECT count(*)::int AS count FROM policies');
    const policy = await pool.query(
      'SELECT title, category, document_type, source_department, publish_date::text AS publish_date FROM policies WHERE title = $1',
      ['深圳市龙华区科技创新专项资金申报指南']
    );

    expect(sourceCount.rows[0].count).toBe(2);
    expect(policyCount.rows[0].count).toBe(1);
    expect(policy.rows[0]).toMatchObject({
      title: '深圳市龙华区科技创新专项资金申报指南',
      category: '科技创新',
      document_type: 'application_guide',
      source_department: '深圳市龙华区科技创新局',
      publish_date: '2025-06-20'
    });
  });

  it('collects public list pages with an injected fetcher before writing to PostgreSQL', async () => {
    const listUrl = policySource.listUrl;
    const detailUrl = 'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/content/post_300.html';
    const fetcher = async (url: string) => {
      if (url === listUrl) {
        return `<a href="${detailUrl}">深圳市龙华区智能传感器产业集群高质量发展若干措施 2025-12-25</a>`;
      }
      if (url === detailUrl) {
        return `
          <h1>深圳市龙华区智能传感器产业集群高质量发展若干措施</h1>
          <span>发布机构：深圳市龙华区工业和信息化局</span>
          <span>发布日期：2025-12-25</span>
          <p>支持龙华区企业围绕智能传感器产业集群开展研发、制造和产业化。</p>
        `;
      }
      throw new Error(`unexpected url ${url}`);
    };

    const result = await collectLonghuaPolicies({ sources: [{ ...policySource, maxPages: 1 }], fetcher, delayMs: 0 });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toMatchObject({
      title: '深圳市龙华区智能传感器产业集群高质量发展若干措施',
      documentType: 'policy_file',
      sourceDepartment: '深圳市龙华区工业和信息化局',
      publishDate: '2025-12-25'
    });
    expect(result.errors).toEqual([]);
  });
});
