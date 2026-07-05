import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';

export type LonghuaPolicyDocumentType =
  | 'policy_file'
  | 'application_guide'
  | 'department_notice'
  | 'policy_interpretation';

export interface PolicySourceConfig {
  name: string;
  listUrl: string;
  documentType: LonghuaPolicyDocumentType;
  maxPages: number;
  sourceDepartment?: string;
}

export interface CollectedPolicyListItem {
  title: string;
  sourceUrl: string;
  listUrl: string;
  documentType: LonghuaPolicyDocumentType;
  sourceSite: string;
  sourceDepartment?: string;
  publishDate?: string;
}

export interface CollectedPolicyDocument extends CollectedPolicyListItem {
  contentText: string;
  rawHtml: string;
  rawPayload: Record<string, unknown>;
}

export interface CollectLonghuaPoliciesOptions {
  sources?: PolicySourceConfig[];
  fetcher?: (url: string) => Promise<string>;
  delayMs?: number;
}

export interface CollectLonghuaPoliciesResult {
  documents: CollectedPolicyDocument[];
  errors: string[];
}

export interface UpsertCollectedDocumentsStats {
  sourceDocumentsInserted: number;
  sourceDocumentsUpdated: number;
  policiesUpserted: number;
  skippedPolicies: number;
}

interface Queryable {
  query: Pool['query'];
}

interface Anchor {
  href: string;
  text: string;
}

const SOURCE_SITE = '龙华政府在线';

export const defaultLonghuaPolicySources: PolicySourceConfig[] = [
  {
    name: 'policy-files',
    listUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html',
    documentType: 'policy_file',
    maxPages: 30,
    sourceDepartment: '深圳市龙华区人民政府'
  },
  {
    name: 'policy-interpretation-text',
    listUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/zcjd/qnzcjd/index.html',
    documentType: 'policy_interpretation',
    maxPages: 30
  },
  {
    name: 'policy-interpretation-graphic',
    listUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/zcjd/mtjd/index.html',
    documentType: 'policy_interpretation',
    maxPages: 30
  },
  {
    name: 'policy-interpretation-audio',
    listUrl: 'https://www.szlhq.gov.cn/xxgk/zcfg/zcjd/ypjd/index.html',
    documentType: 'policy_interpretation',
    maxPages: 15
  },
  {
    name: 'announcements',
    listUrl: 'https://www.szlhq.gov.cn/xxgk/xwzx/tzgg/index.html',
    documentType: 'department_notice',
    maxPages: 120
  }
];

const navigationTexts = new Set([
  '首页',
  '政务公开',
  '政策法规',
  '政策解读',
  '通知公告',
  '第一页',
  '上一页',
  '下一页',
  '最后一页',
  '网站地图',
  '版权保护',
  '隐私声明',
  '无障碍声明'
]);

const enterprisePolicyKeywords = [
  '企业',
  '产业',
  '专项资金',
  '资金',
  '补贴',
  '资助',
  '奖励',
  '扶持',
  '申报',
  '申请',
  '受理',
  '认定',
  '备案',
  '高新技术',
  '科技创新',
  '专精特新',
  '数字经济',
  '智能制造',
  '上云',
  '上平台',
  '智慧园区',
  '孵化器',
  '创业',
  '上市',
  '融资',
  '招商',
  '商贸',
  '工业',
  '软件',
  '人才',
  '总部经济',
  '数据资源',
  '传感器',
  '现代时尚',
  '文旅产业'
];

const applicationGuideKeywords = ['申报指南', '申请指南', '申报', '申请', '受理', '备案', '认定', '补贴', '资助', '奖励'];

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function normalizeWhitespace(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function stripDateFromTitle(value: string): { title: string; publishDate?: string } {
  const publishDate = value.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
  const title = normalizeWhitespace(value.replace(/20\d{2}-\d{2}-\d{2}/g, ''));
  return { title, publishDate };
}

function isNavigationTitle(title: string): boolean {
  if (!title || title.length < 6) return true;
  if (navigationTexts.has(title)) return true;
  if (/^\d+$/.test(title)) return true;
  if (/^(EN|FRANÇAIS|Language|搜索|移动端|无障碍|关怀版)$/i.test(title)) return true;
  return false;
}

function isDetailUrl(url: string): boolean {
  return url.includes('/content/') || /post_\d+/i.test(url);
}

function hasEnterprisePolicyKeyword(text: string): boolean {
  return enterprisePolicyKeywords.some((keyword) => text.includes(keyword));
}

function classifyDocumentType(title: string, defaultType: LonghuaPolicyDocumentType): LonghuaPolicyDocumentType {
  if (defaultType !== 'policy_interpretation' && applicationGuideKeywords.some((keyword) => title.includes(keyword))) {
    return 'application_guide';
  }
  return defaultType;
}

function extractAnchors(html: string): Anchor[] {
  const anchors: Anchor[] = [];
  const anchorPattern = /<a\b[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const href = decodeHtmlEntities(match[1] ?? '').trim();
    const text = stripHtml(match[2] ?? '');
    if (href && text) anchors.push({ href, text });
  }
  return anchors;
}

function resolveLink(href: string, baseUrl: string): string | null {
  if (/^(javascript|mailto|tel):/i.test(href)) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function discoverPageCount(html: string, listUrl: string, maxPages: number): number {
  let highestPage = 1;
  for (const anchor of extractAnchors(html)) {
    const url = resolveLink(anchor.href, listUrl);
    if (!url) continue;
    const page = url.match(/index_(\d+)\.html/i)?.[1];
    if (page) highestPage = Math.max(highestPage, Number.parseInt(page, 10));
  }
  return Math.max(1, Math.min(maxPages, highestPage));
}

export function pageUrlFor(listUrl: string, page: number): string {
  if (page <= 1) return listUrl;
  if (/index\.html$/i.test(listUrl)) return listUrl.replace(/index\.html$/i, `index_${page}.html`);
  return new URL(`index_${page}.html`, listUrl.endsWith('/') ? listUrl : `${listUrl}/`).toString();
}

export function parseListPage(html: string, listUrl: string, source: PolicySourceConfig): CollectedPolicyListItem[] {
  const items: CollectedPolicyListItem[] = [];
  const seen = new Set<string>();

  for (const anchor of extractAnchors(html)) {
    const sourceUrl = resolveLink(anchor.href, listUrl);
    if (!sourceUrl || !sourceUrl.includes('szlhq.gov.cn') || !isDetailUrl(sourceUrl)) continue;

    const { title, publishDate } = stripDateFromTitle(anchor.text);
    if (isNavigationTitle(title) || seen.has(sourceUrl)) continue;

    const documentType = classifyDocumentType(title, source.documentType);
    if (source.documentType === 'department_notice' && documentType !== 'application_guide' && !hasEnterprisePolicyKeyword(title)) {
      continue;
    }

    items.push({
      title,
      sourceUrl,
      listUrl,
      documentType,
      sourceSite: SOURCE_SITE,
      sourceDepartment: source.sourceDepartment,
      publishDate
    });
    seen.add(sourceUrl);
  }

  return items;
}

function extractTitle(html: string, fallback: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return stripHtml(h1);
  const metaTitle = html.match(/<meta[^>]+(?:name|property)=["'](?:ArticleTitle|og:title)["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (metaTitle) return normalizeWhitespace(metaTitle);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) return stripHtml(title).replace(/[-_—|].*龙华政府在线.*/u, '').trim();
  return fallback;
}

function extractPublishDate(html: string, fallback?: string): string | undefined {
  const text = stripHtml(html);
  return text.match(/(?:发布日期|发布时间|发文日期|成文日期)[：:\s]*(20\d{2}-\d{2}-\d{2})/)?.[1] ?? fallback;
}

function extractDepartment(html: string, fallback?: string): string | undefined {
  const text = stripHtml(html);
  const department = text.match(/(?:发布机构|发布单位|信息来源|来源)[：:\s]*([^：:\s][^发布日期发布时间发文日期成文日期]{1,60}?)(?:\s+20\d{2}-\d{2}-\d{2}|\s+发布日期|\s+发布时间|\s+发文日期|\s+成文日期|$)/u)?.[1];
  return department ? normalizeWhitespace(department) : fallback;
}

function extractAttachments(html: string, sourceUrl: string): Array<{ title: string; url: string }> {
  const attachments: Array<{ title: string; url: string }> = [];
  const seen = new Set<string>();
  const attachmentPattern = /<a\b[^>]*href=["']?([^"'\s>]+\.(?:pdf|doc|docx|xls|xlsx|zip|rar)(?:\?[^"'\s>]*)?)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(attachmentPattern)) {
    const url = resolveLink(match[1] ?? '', sourceUrl);
    if (!url || seen.has(url)) continue;
    const title = stripHtml(match[2] ?? '') || url.split('/').pop() || 'attachment';
    attachments.push({ title, url });
    seen.add(url);
  }
  return attachments;
}

export function parseDetailPage(html: string, item: CollectedPolicyListItem): CollectedPolicyDocument {
  const title = extractTitle(html, item.title);
  const publishDate = extractPublishDate(html, item.publishDate);
  const sourceDepartment = extractDepartment(html, item.sourceDepartment);
  const attachments = extractAttachments(html, item.sourceUrl);

  return {
    ...item,
    title,
    publishDate,
    sourceDepartment,
    contentText: stripHtml(html),
    rawHtml: html,
    rawPayload: {
      attachments,
      collected_from: item.listUrl
    }
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'policy-match-explainer/0.1 (+https://github.com/Kuang-xianxin/policy-match-explainer)'
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response.text();
}

function fallbackDocument(item: CollectedPolicyListItem, error: unknown): CollectedPolicyDocument {
  return {
    ...item,
    contentText: item.title,
    rawHtml: '',
    rawPayload: {
      attachments: [],
      detail_fetch_error: error instanceof Error ? error.message : String(error),
      collected_from: item.listUrl
    }
  };
}

export async function collectLonghuaPolicies(
  options: CollectLonghuaPoliciesOptions = {}
): Promise<CollectLonghuaPoliciesResult> {
  const sources = options.sources ?? defaultLonghuaPolicySources;
  const fetcher = options.fetcher ?? fetchText;
  const delayMs = options.delayMs ?? 200;
  const documents = new Map<string, CollectedPolicyDocument>();
  const errors: string[] = [];

  for (const source of sources) {
    let pageLimit = source.maxPages;
    for (let page = 1; page <= pageLimit; page += 1) {
      const listUrl = pageUrlFor(source.listUrl, page);
      let listHtml = '';
      try {
        listHtml = await fetcher(listUrl);
      } catch (error) {
        errors.push(`${source.name} list page ${page} failed: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }

      if (page === 1) pageLimit = discoverPageCount(listHtml, source.listUrl, source.maxPages);
      const listItems = parseListPage(listHtml, listUrl, source);
      if (page > 1 && listItems.length === 0) break;

      for (const item of listItems) {
        if (documents.has(item.sourceUrl)) continue;
        try {
          const detailHtml = await fetcher(item.sourceUrl);
          documents.set(item.sourceUrl, parseDetailPage(detailHtml, item));
        } catch (error) {
          errors.push(`${item.sourceUrl} detail failed: ${error instanceof Error ? error.message : String(error)}`);
          documents.set(item.sourceUrl, fallbackDocument(item, error));
        }
        if (delayMs > 0) await delay(delayMs);
      }

      if (delayMs > 0) await delay(delayMs);
    }
  }

  return { documents: Array.from(documents.values()), errors };
}

function contentHashFor(document: CollectedPolicyDocument): string {
  return createHash('sha256')
    .update(document.sourceUrl)
    .update(document.title)
    .update(document.contentText)
    .update(document.rawHtml)
    .digest('hex');
}

function statusFor(document: CollectedPolicyDocument): 'active' | 'expired' | 'unknown' {
  const text = `${document.title} ${document.contentText}`;
  if (/废止|失效|停止执行|终止执行/u.test(text)) return 'expired';
  return 'active';
}

function categoryFor(document: CollectedPolicyDocument): string {
  const text = `${document.title} ${document.contentText}`;
  if (/科技|创新|高新技术|孵化器|研发/u.test(text)) return '科技创新';
  if (/工业|工信|制造|上云|上平台|数字化|智能|传感器/u.test(text)) return '工业和信息化';
  if (/专精特新|中小微|企业培育|上市|融资|总部经济/u.test(text)) return '企业培育';
  if (/商贸|消费|服务业/u.test(text)) return '商贸服务';
  if (/人才|工匠|青年/u.test(text)) return '人才扶持';
  if (/文旅|文化|旅游|时尚/u.test(text)) return '现代服务与文旅';
  return '其他';
}

function shouldSyncPolicy(document: CollectedPolicyDocument): boolean {
  if (document.documentType === 'policy_interpretation') return false;
  return hasEnterprisePolicyKeyword(`${document.title} ${document.contentText}`);
}

async function upsertSourceDocument(queryable: Queryable, document: CollectedPolicyDocument): Promise<{ id: string; inserted: boolean }> {
  const existing = await queryable.query('SELECT id FROM source_documents WHERE source_url = $1', [document.sourceUrl]);
  const contentHash = contentHashFor(document);
  if (existing.rows[0]) {
    const updated = await queryable.query(
      `
      UPDATE source_documents
      SET document_type = $2,
          title = $3,
          source_site = $4,
          source_department = $5,
          list_url = $6,
          publish_date = $7,
          content_text = $8,
          raw_html = $9,
          raw_payload = $10::jsonb,
          content_hash = $11,
          fetched_at = now(),
          updated_at = now()
      WHERE source_url = $1
      RETURNING id
      `,
      [
        document.sourceUrl,
        document.documentType,
        document.title,
        document.sourceSite,
        document.sourceDepartment ?? null,
        document.listUrl,
        document.publishDate ?? null,
        document.contentText,
        document.rawHtml,
        JSON.stringify(document.rawPayload),
        contentHash
      ]
    );
    return { id: updated.rows[0].id, inserted: false };
  }

  const inserted = await queryable.query(
    `
    INSERT INTO source_documents (
      source_url, document_type, title, source_site, source_department, list_url,
      publish_date, content_text, raw_html, raw_payload, content_hash
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
    RETURNING id
    `,
    [
      document.sourceUrl,
      document.documentType,
      document.title,
      document.sourceSite,
      document.sourceDepartment ?? null,
      document.listUrl,
      document.publishDate ?? null,
      document.contentText,
      document.rawHtml,
      JSON.stringify(document.rawPayload),
      contentHash
    ]
  );
  return { id: inserted.rows[0].id, inserted: true };
}

async function upsertPolicy(queryable: Queryable, sourceDocumentId: string, document: CollectedPolicyDocument): Promise<void> {
  await queryable.query(
    `
    INSERT INTO policies (
      source_document_id, title, category, source_url, status, policy_text, rules,
      publish_date, source_department, document_type, raw_payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7, $8, $9, $10::jsonb)
    ON CONFLICT (title) DO UPDATE SET
      source_document_id = EXCLUDED.source_document_id,
      category = EXCLUDED.category,
      source_url = EXCLUDED.source_url,
      status = EXCLUDED.status,
      policy_text = EXCLUDED.policy_text,
      publish_date = EXCLUDED.publish_date,
      source_department = EXCLUDED.source_department,
      document_type = EXCLUDED.document_type,
      raw_payload = EXCLUDED.raw_payload
    `,
    [
      sourceDocumentId,
      document.title,
      categoryFor(document),
      document.sourceUrl,
      statusFor(document),
      document.contentText,
      document.publishDate ?? null,
      document.sourceDepartment ?? null,
      document.documentType,
      JSON.stringify(document.rawPayload)
    ]
  );
}

export async function upsertCollectedDocuments(
  queryable: Queryable,
  documents: CollectedPolicyDocument[]
): Promise<UpsertCollectedDocumentsStats> {
  const stats: UpsertCollectedDocumentsStats = {
    sourceDocumentsInserted: 0,
    sourceDocumentsUpdated: 0,
    policiesUpserted: 0,
    skippedPolicies: 0
  };

  for (const document of documents) {
    const sourceDocument = await upsertSourceDocument(queryable, document);
    if (sourceDocument.inserted) stats.sourceDocumentsInserted += 1;
    else stats.sourceDocumentsUpdated += 1;

    if (shouldSyncPolicy(document)) {
      await upsertPolicy(queryable, sourceDocument.id, document);
      stats.policiesUpserted += 1;
    } else {
      stats.skippedPolicies += 1;
    }
  }

  return stats;
}
