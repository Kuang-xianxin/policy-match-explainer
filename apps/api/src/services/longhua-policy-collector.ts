import { createHash } from 'node:crypto';
import https from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import type { PolicyRule } from '@policy-match/shared';

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
  policiesDemoted: number;
}

interface Queryable {
  query: Pool['query'];
}

interface Anchor {
  href: string;
  text: string;
}

const SOURCE_SITE = '龙华政府在线';
const requestHeaders = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'user-agent': 'policy-match-explainer/0.1 (+https://github.com/Kuang-xianxin/policy-match-explainer)'
};

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface FetchTextOptions {
  fetcher?: FetchLike;
  legacyTlsFetcher?: (url: string) => Promise<string>;
}

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
const nonMatchableNoticeKeywords = [
  '中标公告',
  '招标公告',
  '采购公告',
  '采购需求',
  '施工招标',
  '施工中标',
  '工程施工',
  '遗失公告',
  '送达公告',
  '行政处罚',
  '听证公告',
  '注销',
  '拟补贴名单',
  '拟资助名单',
  '拟发放',
  '初审结果',
  '名单公示',
  '符合发放条件名单',
  '执法证'
];
const policyDocumentSignals = [
  '申报指南',
  '申请指南',
  '申报通知',
  '申请通知',
  '开展',
  '受理',
  '政策',
  '措施',
  '办法',
  '实施方案',
  '工作方案',
  '管理办法',
  '若干措施'
];

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

function decodeJavascriptString(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\\/g, '\\')
  );
}

function extractRecordField(record: string, fieldName: string): string | undefined {
  const pattern = new RegExp(`['"]${fieldName}['"]\\s*:\\s*['"]((?:\\\\.|[^'"])*)['"]`, 'u');
  const value = record.match(pattern)?.[1];
  return value ? decodeJavascriptString(value) : undefined;
}

function extractRecordNumberField(record: string, fieldName: string): number | undefined {
  const pattern = new RegExp(`['"]${fieldName}['"]\\s*:\\s*(\\d{10,13})`, 'u');
  const value = record.match(pattern)?.[1];
  return value ? Number(value) : undefined;
}

function dateFromChinaTimestamp(value: number): string | undefined {
  if (!Number.isFinite(value)) return undefined;
  const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
  return new Date(milliseconds + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function extractEmbeddedPolicyRecords(
  html: string,
  listUrl: string,
  source: PolicySourceConfig
): CollectedPolicyListItem[] {
  const items: CollectedPolicyListItem[] = [];
  const recordPattern = /\{[\s\S]*?['"]url['"]\s*:\s*['"]([^'"]*\/content\/post_[^'"]+)['"][\s\S]*?\}/giu;

  for (const match of html.matchAll(recordPattern)) {
    const sourceUrl = resolveLink(decodeJavascriptString(match[1] ?? ''), listUrl);
    if (!sourceUrl || !sourceUrl.includes('szlhq.gov.cn') || !isDetailUrl(sourceUrl)) continue;

    const record = match[0];
    const rawTitle = extractRecordField(record, 'title') ?? extractRecordField(record, 'content') ?? '';
    const { title, publishDate: titleDate } = stripDateFromTitle(rawTitle);
    if (isNavigationTitle(title)) continue;

    const publishTimeText = extractRecordField(record, 'display_publish_time');
    const publishDate =
      publishTimeText?.match(/20\d{2}-\d{2}-\d{2}/)?.[0] ??
      dateFromChinaTimestamp(extractRecordNumberField(record, 'display_publish_time') ?? Number.NaN) ??
      titleDate;
    const sourceDepartment =
      extractRecordField(record, 'source') ?? extractRecordField(record, 'EXT_fbjg') ?? source.sourceDepartment;

    items.push({
      title,
      sourceUrl,
      listUrl,
      documentType: classifyDocumentType(title, source.documentType),
      sourceSite: SOURCE_SITE,
      sourceDepartment,
      publishDate
    });
  }

  return items;
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

  for (const item of extractEmbeddedPolicyRecords(html, listUrl, source)) {
    if (seen.has(item.sourceUrl)) continue;
    items.push(item);
    seen.add(item.sourceUrl);
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

function shouldRetryWithLegacyTls(url: string, error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
  const message = `${error instanceof Error ? error.message : String(error)} ${
    cause instanceof Error ? cause.message : typeof cause === 'object' && cause !== null && 'message' in cause ? String(cause.message) : ''
  }`;
  const normalizedMessage = message.toLowerCase();
  return (
    code === 'ERR_SSL_BAD_ECPOINT' ||
    normalizedMessage.includes('bad ecpoint') ||
    (url.includes('szlhq.gov.cn') && normalizedMessage.includes('fetch failed'))
  );
}

function fetchTextWithLegacyTls(url: string, redirectCount = 0): Promise<string> {
  if (redirectCount > 5) return Promise.reject(new Error(`Too many redirects while fetching ${url}`));

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        headers: requestHeaders,
        ecdhCurve: 'prime256v1',
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.2',
        timeout: 30000
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          fetchTextWithLegacyTls(new URL(location, url).toString(), redirectCount + 1).then(resolve, reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode} while fetching ${url}`));
          return;
        }

        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.on('end', () => resolve(body));
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Request timed out while fetching ${url}`));
    });
    request.on('error', reject);
    request.end();
  });
}

export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  try {
    const response = await (options.fetcher ?? fetch)(url, { headers: requestHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.text();
  } catch (error) {
    if (!shouldRetryWithLegacyTls(url, error)) throw error;
    return (options.legacyTlsFetcher ?? fetchTextWithLegacyTls)(url);
  }
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

function isOperationalNotice(title: string): boolean {
  const hasPolicySignal = policyDocumentSignals.some((keyword) => title.includes(keyword));
  if (hasPolicySignal && !/名单|中标|招标|采购|注销|处罚|听证/u.test(title)) return false;
  return nonMatchableNoticeKeywords.some((keyword) => title.includes(keyword));
}

export function isMatchablePolicyDocument(document: CollectedPolicyDocument): boolean {
  if (document.documentType === 'policy_interpretation') return false;
  if (isOperationalNotice(document.title)) return false;
  return hasEnterprisePolicyKeyword(`${document.title} ${document.contentText}`);
}

function shouldSyncPolicy(document: CollectedPolicyDocument): boolean {
  return isMatchablePolicyDocument(document);
}

function pushRule(rules: PolicyRule[], rule: PolicyRule): void {
  const duplicated = rules.some(
    (item) =>
      item.field_key === rule.field_key &&
      item.operator === rule.operator &&
      JSON.stringify(item.expected_value) === JSON.stringify(rule.expected_value)
  );
  if (!duplicated) rules.push(rule);
}

export function derivePolicyRules(document: CollectedPolicyDocument): PolicyRule[] {
  const text = `${document.title} ${document.contentText}`;
  const rules: PolicyRule[] = [];

  pushRule(rules, {
    field_key: 'district',
    operator: 'equals',
    expected_value: '龙华区',
    weight: 18,
    required: true,
    evidence_text: '政策来源为龙华区公开政策或申报公告，申报主体应属于龙华区。'
  });

  pushRule(rules, {
    field_key: 'has_major_violation',
    operator: 'is_false',
    expected_value: false,
    weight: 14,
    required: true,
    evidence_text: '惠企政策通常要求申报主体无重大违法违规记录。'
  });

  if (/专精特新/u.test(text)) {
    pushRule(rules, {
      field_key: 'has_specialized_new_sme',
      operator: 'is_true',
      expected_value: true,
      weight: 24,
      required: /专精特新.*(奖励|资助|申报|项目|企业)/u.test(text),
      evidence_text: '政策文本涉及专精特新企业或相关资助方向。'
    });
  }

  if (/高新技术/u.test(text)) {
    pushRule(rules, {
      field_key: 'is_high_tech_enterprise',
      operator: 'is_true',
      expected_value: true,
      weight: 18,
      required: false,
      evidence_text: '政策文本涉及高新技术企业或科技创新资质。'
    });
  }

  if (/科技型中小|中小企业|小微企业/u.test(text)) {
    pushRule(rules, {
      field_key: 'is_tech_sme',
      operator: 'is_true',
      expected_value: true,
      weight: 14,
      required: false,
      evidence_text: '政策文本涉及科技型中小企业、中小企业或小微企业。'
    });
  }

  if (/研发|创新|科技|孵化器|众创空间|协同创新/u.test(text)) {
    pushRule(rules, {
      field_key: 'rd_expense_ratio',
      operator: 'gte',
      expected_value: 5,
      weight: 14,
      required: false,
      evidence_text: '政策文本涉及研发投入、科技创新或创新载体建设。'
    });
  }

  if (/数字化|智能制造|人工智能|AI|数据|上云|上平台|工业互联网|软件|信息技术/u.test(text)) {
    pushRule(rules, {
      field_key: 'project_direction',
      operator: 'in',
      expected_value: ['AI', '数据治理', '智能制造', '数字化转型'],
      weight: 18,
      required: false,
      evidence_text: '政策文本涉及数字化、智能制造、数据或软件信息技术方向。'
    });
  }

  if (/制造|工业|工信|产业链|传感器|装备|低空经济/u.test(text)) {
    pushRule(rules, {
      field_key: 'industry',
      operator: 'contains',
      expected_value: '制造',
      weight: 12,
      required: false,
      evidence_text: '政策文本涉及工业制造、装备、传感器或产业链方向。'
    });
  }

  if (/软件|信息技术|数据|人工智能|数字经济/u.test(text)) {
    pushRule(rules, {
      field_key: 'industry',
      operator: 'contains',
      expected_value: '软件',
      weight: 12,
      required: false,
      evidence_text: '政策文本涉及软件、信息技术、数据或数字经济方向。'
    });
  }

  if (/文化|旅游|文旅|时尚|体育/u.test(text)) {
    pushRule(rules, {
      field_key: 'industry',
      operator: 'contains',
      expected_value: '文旅',
      weight: 12,
      required: false,
      evidence_text: '政策文本涉及文化、旅游、体育或现代时尚产业。'
    });
  }

  if (/商贸|消费|零售|餐饮|服务业/u.test(text)) {
    pushRule(rules, {
      field_key: 'industry',
      operator: 'contains',
      expected_value: '服务',
      weight: 12,
      required: false,
      evidence_text: '政策文本涉及商贸、消费、零售、餐饮或服务业。'
    });
  }

  if (/上市|挂牌|融资|资本市场/u.test(text)) {
    pushRule(rules, {
      field_key: 'listed_status',
      operator: 'in',
      expected_value: ['listed', 'new_third_board', 'pre_listing'],
      weight: 16,
      required: false,
      evidence_text: '政策文本涉及上市培育、挂牌、融资或资本市场服务。'
    });
  }

  if (/营收|营业收入|销售额|产值|规模以上|规上/u.test(text)) {
    pushRule(rules, {
      field_key: 'revenue_last_year',
      operator: 'gte',
      expected_value: 1000000,
      weight: 12,
      required: false,
      evidence_text: '政策文本涉及营收、销售额、产值或规模以上企业基础。'
    });
  }

  if (/纳税|税务|信用/u.test(text)) {
    pushRule(rules, {
      field_key: 'tax_credit_level',
      operator: 'in',
      expected_value: ['A', 'B', 'M'],
      weight: 10,
      required: false,
      evidence_text: '政策文本涉及纳税、税务信用或信用状况。'
    });
  }

  if (/项目|建设|改造|投入|资助|补贴|扶持/u.test(text)) {
    pushRule(rules, {
      field_key: 'project_budget',
      operator: 'gte',
      expected_value: 100000,
      weight: 10,
      required: false,
      evidence_text: '政策文本涉及项目建设、改造投入、资助或补贴。'
    });
  }

  return rules;
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
  const rules = derivePolicyRules(document);
  const rawPayload = {
    ...document.rawPayload,
    rules_generated_by: 'keyword_heuristic_v1'
  };

  await queryable.query(
    `
    INSERT INTO policies (
      source_document_id, title, category, source_url, status, policy_text, rules,
      publish_date, source_department, document_type, raw_payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::jsonb)
    ON CONFLICT (title) DO UPDATE SET
      source_document_id = EXCLUDED.source_document_id,
      category = EXCLUDED.category,
      source_url = EXCLUDED.source_url,
      status = EXCLUDED.status,
      policy_text = EXCLUDED.policy_text,
      rules = CASE
        WHEN jsonb_array_length(policies.rules) = 0 OR policies.raw_payload->>'rules_generated_by' = 'keyword_heuristic_v1'
        THEN EXCLUDED.rules
        ELSE policies.rules
      END,
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
      JSON.stringify(rules),
      document.publishDate ?? null,
      document.sourceDepartment ?? null,
      document.documentType,
      JSON.stringify(rawPayload)
    ]
  );
}

async function clearGeneratedPolicyRules(queryable: Queryable, document: CollectedPolicyDocument): Promise<number> {
  const result = await queryable.query(
    `
    UPDATE policies
    SET rules = '[]'::jsonb,
        raw_payload = jsonb_set(raw_payload, '{rules_demoted_by}', '"matchable_filter_v1"', true)
    WHERE source_url = $1
      AND raw_payload->>'rules_generated_by' = 'keyword_heuristic_v1'
      AND jsonb_array_length(rules) > 0
    `,
    [document.sourceUrl]
  );
  return result.rowCount ?? 0;
}

export async function upsertCollectedDocuments(
  queryable: Queryable,
  documents: CollectedPolicyDocument[]
): Promise<UpsertCollectedDocumentsStats> {
  const stats: UpsertCollectedDocumentsStats = {
    sourceDocumentsInserted: 0,
    sourceDocumentsUpdated: 0,
    policiesUpserted: 0,
    skippedPolicies: 0,
    policiesDemoted: 0
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
      stats.policiesDemoted += await clearGeneratedPolicyRules(queryable, document);
    }
  }

  return stats;
}
