import type {
  AmountRange,
  BusinessModel,
  CustomerType,
  EmployeeRange,
  EnterpriseProfile,
  FieldSource,
  ListedStatus,
  ProfileFieldSourceType,
  ProjectStage
} from '@policy-match/shared';
import { enterpriseProfileSchema } from '@policy-match/shared';
import https from 'node:https';
import os, { type NetworkInterfaceInfo } from 'node:os';

export interface DoubaoResearchConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  directFallback?: boolean;
  directResolvedIp?: string;
  directLocalAddress?: string;
}

export interface ResearchEvidence {
  title: string;
  url: string;
  snippet: string;
  fields: string[];
  confidence: number;
}

export interface CompanyResearchPayload {
  source_type: ProfileFieldSourceType;
  query_name: string;
  company_name: string;
  credit_code: string;
  legal_representative?: string;
  establishment_date?: string;
  registered_year?: number;
  registered_capital?: number;
  registration_status?: string;
  business_address?: string;
  district?: string;
  industry?: string;
  business_scope?: string;
  listed_status?: ListedStatus;
  employee_count?: number;
  employee_range?: EmployeeRange;
  revenue_last_year?: number;
  revenue_range?: AmountRange;
  profit_last_year?: number;
  profit_range?: 'unknown' | 'loss' | 'break_even' | 'lt_500k' | '500k_2m' | '2m_10m' | 'gte_10m';
  tax_paid_last_year?: number;
  tax_paid_range?: AmountRange;
  rd_expense_last_year?: number;
  rd_expense_range?: AmountRange;
  rd_expense_ratio?: number;
  rd_employee_count?: number;
  rd_employee_range?: EmployeeRange;
  is_high_tech_enterprise?: boolean;
  is_tech_sme?: boolean;
  has_specialized_new_sme?: boolean;
  patent_count?: number;
  software_copyright_count?: number;
  main_business?: string;
  main_products?: string[];
  customer_type?: CustomerType[];
  business_model?: BusinessModel;
  main_revenue_source?: string;
  project_direction?: string;
  project_stage?: ProjectStage;
  is_headquarters?: boolean;
  is_above_scale_enterprise?: boolean;
  digital_transformation_status?: string;
  award_titles?: string[];
  known_projects?: string[];
  production_projects?: string[];
  evidence: ResearchEvidence[];
  confidence: number;
}

export interface RejectedCompanyResearch {
  company_name: string;
  business_address?: string;
  district?: string;
  reason: string;
}

export interface CompanyResearchResult {
  candidates: CompanyResearchPayload[];
  rejected_companies: RejectedCompanyResearch[];
}

const amountRanges: AmountRange[] = ['unknown', 'none', 'lt_1m', '1m_5m', '5m_20m', '20m_100m', 'gte_100m'];
const employeeRanges: EmployeeRange[] = ['unknown', 'lt_10', '10_50', '50_100', '100_300', 'gte_300'];
const listedStatuses: ListedStatus[] = ['unlisted', 'listed', 'new_third_board', 'pre_listing', 'unknown'];
const businessModels: BusinessModel[] = ['B2B', 'B2G', 'B2C', 'SaaS', 'platform', 'manufacturing', 'service', 'other'];
const customerTypes: CustomerType[] = ['government', 'enterprise', 'individual', 'overseas', 'other'];
const projectStages: ProjectStage[] = ['planning', 'researching', 'developing', 'launched', 'scaling'];
const sourceTypes: ProfileFieldSourceType[] = [
  'manual',
  'official_open_data',
  'official_public_page',
  'commercial_api',
  'local_seed',
  'inferred'
];
const longhuaDistrictName = '龙华区';

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

function containsLonghua(value: string | undefined): boolean {
  return typeof value === 'string' && value.includes('龙华');
}

function longhuaScopeRejectionReason(payload: CompanyResearchPayload): string | null {
  if (containsLonghua(payload.district) || containsLonghua(payload.business_address)) return null;

  const district = payload.district?.trim();
  if (district) return `公开资料显示所在区为${district}，不属于深圳市${longhuaDistrictName}。`;

  const address = payload.business_address?.trim();
  if (address) return `公开资料显示地址为${address}，未发现${longhuaDistrictName}注册地址或经营地址。`;

  return '未找到可核验的龙华区注册地址或经营地址证据。';
}

export function assertLonghuaResearchPayload(payload: CompanyResearchPayload): void {
  const reason = longhuaScopeRejectionReason(payload);
  if (reason) {
    throw new Error(`当前企业不在深圳市龙华区政策匹配范围内：${reason}`);
  }
}

function rejectedCompanyFromPayload(payload: CompanyResearchPayload): RejectedCompanyResearch {
  return {
    company_name: payload.company_name,
    business_address: payload.business_address,
    district: payload.district,
    reason: longhuaScopeRejectionReason(payload) ?? ''
  };
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function boundedConfidence(value: unknown, fallback = 0.65): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : fallback;
}

function simpleHash(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(6, '0').slice(0, 8);
}

function isVirtualInterfaceName(name: string): boolean {
  return /meta|loopback|vethernet|hyper-v|wsl|docker|vmware|virtualbox|zerotier|tailscale/i.test(name);
}

function isUsableDirectIpv4(address: NetworkInterfaceInfo): boolean {
  return (
    address.family === 'IPv4' &&
    !address.internal &&
    !address.address.startsWith('198.18.') &&
    !address.address.startsWith('169.254.')
  );
}

export function selectDirectLocalAddress(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = os.networkInterfaces()
): string | undefined {
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (isVirtualInterfaceName(name) || !addresses) continue;
    const address = addresses.find(isUsableDirectIpv4);
    if (address) return address.address;
  }
  return undefined;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function shouldUseDirectArkFallback(error: unknown, baseUrl: string): boolean {
  let host = '';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return false;
  }
  if (!host.endsWith('.volces.com')) return false;
  return /ECONNRESET|fetch failed|TLS|secure TLS|handshake|socket disconnected/i.test(errorText(error));
}

async function resolveHostWithDoh(hostname: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, {
      signal: controller.signal
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { Answer?: Array<{ data?: unknown }> };
    return payload.Answer?.map((item) => stringValue(item.data))
      .find((value) => /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(value));
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDoubaoJson(config: DoubaoResearchConfig, requestBody: Record<string, unknown>): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 45_000);
  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Doubao request failed: ${response.status} ${await response.text()}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function directHttpsDoubaoJson(config: DoubaoResearchConfig, requestBody: Record<string, unknown>): Promise<unknown> {
  const url = new URL(config.baseUrl);
  const body = JSON.stringify(requestBody);
  const resolvedIp = config.directResolvedIp || (await resolveHostWithDoh(url.hostname));
  const localAddress = config.directLocalAddress || selectDirectLocalAddress();

  return new Promise((resolve, reject) => {
    const requestOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port ? Number(url.port) : 443,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      servername: url.hostname,
      localAddress,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: config.timeoutMs ?? 45_000
    };

    if (resolvedIp) {
      requestOptions.lookup = ((_hostname: string, _options: unknown, callback: unknown) => {
        (callback as (error: NodeJS.ErrnoException | null, address: string, family: number) => void)(null, resolvedIp, 4);
      }) as https.RequestOptions['lookup'];
    }

    const request = https.request(requestOptions, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Doubao direct fallback failed: ${response.statusCode ?? 'NO_STATUS'} ${text}`));
          return;
        }
        try {
          resolve(JSON.parse(text) as unknown);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('Doubao direct fallback timed out.'));
    });
    request.end(body);
  });
}

async function requestDoubaoJson(config: DoubaoResearchConfig, requestBody: Record<string, unknown>): Promise<unknown> {
  try {
    return await fetchDoubaoJson(config, requestBody);
  } catch (error) {
    if (config.directFallback !== false && shouldUseDirectArkFallback(error, config.baseUrl)) {
      return directHttpsDoubaoJson(config, requestBody);
    }
    throw error;
  }
}

function creditCode(value: unknown, companyName: string): string {
  const code = stringValue(value);
  return code.length >= 6 ? code : `UNCONFIRMED-${simpleHash(companyName)}`;
}

function registeredYearFrom(value: unknown, establishmentDate?: string): number {
  const explicitYear = numberValue(value, 0);
  if (explicitYear >= 1900 && explicitYear <= 2100) return Math.trunc(explicitYear);
  const dateYear = establishmentDate?.match(/^(19|20)\d{2}/u)?.[0];
  return dateYear ? Number(dateYear) : new Date().getFullYear();
}

function amountRangeFromValue(value: number): AmountRange {
  if (value <= 0) return 'unknown';
  if (value < 1_000_000) return 'lt_1m';
  if (value < 5_000_000) return '1m_5m';
  if (value < 20_000_000) return '5m_20m';
  if (value < 100_000_000) return '20m_100m';
  return 'gte_100m';
}

function employeeRangeFromValue(value: number): EmployeeRange {
  if (value <= 0) return 'unknown';
  if (value < 10) return 'lt_10';
  if (value < 50) return '10_50';
  if (value < 100) return '50_100';
  if (value < 300) return '100_300';
  return 'gte_300';
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }
  return '';
}

function extractResponseText(response: unknown): string {
  const root = response as Record<string, unknown>;
  const outputText = stringValue(root.output_text);
  if (outputText) return outputText;

  const chunks: string[] = [];
  const output = Array.isArray(root.output) ? root.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const text = stringValue((part as { text?: unknown }).text);
        if (text) chunks.push(text);
      }
    }
    const text = stringValue((item as { text?: unknown }).text);
    if (text) chunks.push(text);
  }

  const choices = Array.isArray(root.choices) ? root.choices : [];
  for (const choice of choices) {
    const content = (choice as { message?: { content?: unknown } }).message?.content;
    if (typeof content === 'string') chunks.push(content);
  }

  return chunks.join('\n').trim();
}

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/u)?.[1];
  const raw = fenced ?? text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Doubao response did not contain a JSON object.');
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeEvidence(value: unknown): ResearchEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): ResearchEvidence | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const title = stringValue(raw.title, '未命名来源');
      const url = stringValue(raw.url);
      const snippet = stringValue(raw.snippet);
      const fields = arrayOfStrings(raw.fields);
      if (!url && !snippet) return null;
      return {
        title,
        url,
        snippet,
        fields,
        confidence: boundedConfidence(raw.confidence, 0.7)
      };
    })
    .filter((item): item is ResearchEvidence => item !== null);
}

function normalizeCandidate(raw: unknown, queryName: string): CompanyResearchPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const companyName = stringValue(item.company_name);
  if (!companyName) return null;

  const establishmentDate = stringValue(item.establishment_date) || undefined;
  const normalizedCreditCode = creditCode(item.credit_code, companyName);
  const evidence = normalizeEvidence(item.evidence);
  const requestedSourceType = enumValue(item.source_type, sourceTypes, 'official_public_page');
  const sourceType = normalizedCreditCode.startsWith('UNCONFIRMED-') ? 'inferred' : requestedSourceType;
  const employeeCount = numberValue(item.employee_count, 0);
  const revenueLastYear = numberValue(item.revenue_last_year, 0);
  const rdExpenseLastYear = numberValue(item.rd_expense_last_year, 0);
  const rdEmployeeCount = numberValue(item.rd_employee_count, 0);
  const taxPaidLastYear = numberValue(item.tax_paid_last_year, 0);

  return {
    source_type: sourceType,
    query_name: queryName,
    company_name: companyName,
    credit_code: normalizedCreditCode,
    legal_representative: stringValue(item.legal_representative) || undefined,
    establishment_date: establishmentDate,
    registered_year: registeredYearFrom(item.registered_year, establishmentDate),
    registered_capital: numberValue(item.registered_capital, 0),
    registration_status: stringValue(item.registration_status) || undefined,
    business_address: stringValue(item.business_address) || undefined,
    district: stringValue(item.district) || undefined,
    industry: stringValue(item.industry) || undefined,
    business_scope: stringValue(item.business_scope) || undefined,
    listed_status: enumValue(item.listed_status, listedStatuses, 'unknown'),
    employee_count: employeeCount,
    employee_range: enumValue(item.employee_range, employeeRanges, employeeRangeFromValue(employeeCount)),
    revenue_last_year: revenueLastYear,
    revenue_range: enumValue(item.revenue_range, amountRanges, amountRangeFromValue(revenueLastYear)),
    profit_last_year: numberValue(item.profit_last_year, 0),
    tax_paid_last_year: taxPaidLastYear,
    tax_paid_range: enumValue(item.tax_paid_range, amountRanges, amountRangeFromValue(taxPaidLastYear)),
    rd_expense_last_year: rdExpenseLastYear,
    rd_expense_range: enumValue(item.rd_expense_range, amountRanges, amountRangeFromValue(rdExpenseLastYear)),
    rd_expense_ratio: numberValue(item.rd_expense_ratio, 0),
    rd_employee_count: rdEmployeeCount,
    rd_employee_range: enumValue(item.rd_employee_range, employeeRanges, employeeRangeFromValue(rdEmployeeCount)),
    is_high_tech_enterprise: booleanValue(item.is_high_tech_enterprise, false),
    is_tech_sme: booleanValue(item.is_tech_sme, false),
    has_specialized_new_sme: booleanValue(item.has_specialized_new_sme, false),
    patent_count: numberValue(item.patent_count, 0),
    software_copyright_count: numberValue(item.software_copyright_count, 0),
    main_business: stringValue(item.main_business) || undefined,
    main_products: arrayOfStrings(item.main_products),
    customer_type: Array.isArray(item.customer_type)
      ? item.customer_type.filter((value): value is CustomerType => customerTypes.includes(value as CustomerType))
      : [],
    business_model: enumValue(item.business_model, businessModels, 'other'),
    main_revenue_source: stringValue(item.main_revenue_source) || undefined,
    project_direction: stringValue(item.project_direction) || undefined,
    project_stage: enumValue(item.project_stage, projectStages, 'planning'),
    is_headquarters: booleanValue(item.is_headquarters, false),
    is_above_scale_enterprise: booleanValue(item.is_above_scale_enterprise, false),
    digital_transformation_status: stringValue(item.digital_transformation_status) || undefined,
    award_titles: arrayOfStrings(item.award_titles),
    known_projects: arrayOfStrings(item.known_projects),
    production_projects: arrayOfStrings(item.production_projects),
    evidence,
    confidence: boundedConfidence(item.confidence, evidence.length > 0 ? 0.78 : 0.55)
  };
}

export async function researchCompaniesWithDoubaoDetailed(
  queryName: string,
  keywords: string[],
  config: DoubaoResearchConfig
): Promise<CompanyResearchResult> {
  if (!config.apiKey?.trim()) return { candidates: [], rejected_companies: [] };

  const instructions = [
    '你是深圳市龙华区企业公开资料研究员。',
    '必须使用联网搜索证据回答，只输出 JSON，不要输出解释文字。',
    '任务是根据用户输入的企业简称或全名，找出最可能的真实企业候选，并抽取企业政策匹配画像字段。',
    '优先使用企业官网、政府网站、交易所公告、年报、权威媒体和公开工商信息页面。',
    '重点抽取公开可核验字段：统一社会信用代码、法定代表人、成立日期、注册资本、登记状态、经营地址、行业、经营范围、上市状态、总部企业、规上企业、高新技术企业、科技型中小企业、专精特新、奖项荣誉、专利、软著、主营产品、客户类型、业务模式、数字化转型状态、公开披露的在研/建设项目和已投产/落地项目。',
    '公开年报、招股书、交易所公告或官网披露了员工人数、营收、利润、纳税、研发投入、研发人员、项目投入时才可填写数值或区间，并在 evidence.fields 标明对应字段。',
    '不得编造统一社会信用代码、法定代表人、成立日期、纳税、营收、利润、研发投入、员工人数或项目数据；没有公开证据的内部经营数据必须填 unknown 或 0。',
    '没有来源证据的普通字段填空字符串、0、false、unknown 或空数组。',
    '只保留深圳市龙华区企业，或公开资料显示总部/项目/办公地址与龙华区强相关的企业。',
    '输出 JSON 结构：{"candidates":[{company_name,credit_code,legal_representative,establishment_date,registered_year,registered_capital,registration_status,business_address,district,industry,business_scope,listed_status,employee_count,employee_range,revenue_last_year,revenue_range,profit_last_year,profit_range,tax_paid_last_year,tax_paid_range,rd_expense_last_year,rd_expense_range,rd_expense_ratio,rd_employee_count,rd_employee_range,is_high_tech_enterprise,is_tech_sme,has_specialized_new_sme,patent_count,software_copyright_count,main_business,main_products,customer_type,business_model,main_revenue_source,project_direction,project_stage,is_headquarters,is_above_scale_enterprise,digital_transformation_status,award_titles,known_projects,production_projects,evidence,confidence}]}',
    'evidence 每项必须包含 title,url,snippet,fields,confidence；fields 写明该来源支撑的字段名。'
  ].join('\n');

  try {
    const json = await requestDoubaoJson(config, {
      model: config.model,
      instructions,
      input: JSON.stringify({ query_name: queryName, search_keywords: keywords }),
      tools: [{ type: 'web_search', max_keyword: 3, limit: 10 }],
      temperature: 0.1
    });
    const text = extractResponseText(json);
    const parsed = parseJsonObject(text) as { candidates?: unknown };
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const normalizedCandidates = candidates
      .map((candidate) => normalizeCandidate(candidate, queryName))
      .filter((candidate): candidate is CompanyResearchPayload => candidate !== null)
      .sort((a, b) => b.confidence - a.confidence);
    const accepted: CompanyResearchPayload[] = [];
    const rejected: RejectedCompanyResearch[] = [];

    for (const candidate of normalizedCandidates) {
      const rejectionReason = longhuaScopeRejectionReason(candidate);
      if (rejectionReason) {
        rejected.push(rejectedCompanyFromPayload(candidate));
        continue;
      }
      accepted.push(candidate);
    }

    return {
      candidates: accepted.slice(0, 5),
      rejected_companies: rejected.slice(0, 5)
    };
  } catch (error) {
    const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
    const causeCode =
      cause && typeof cause === 'object' && 'code' in cause ? ` (${String((cause as { code?: unknown }).code)})` : '';
    const causeHost =
      cause && typeof cause === 'object' && 'host' in cause ? ` host=${String((cause as { host?: unknown }).host)}` : '';
    throw new Error(`${error instanceof Error ? error.message : String(error)}${causeCode}${causeHost}`);
  }
}

export async function researchCompaniesWithDoubao(
  queryName: string,
  keywords: string[],
  config: DoubaoResearchConfig
): Promise<CompanyResearchPayload[]> {
  return (await researchCompaniesWithDoubaoDetailed(queryName, keywords, config)).candidates;
}

export function createProfileFromResearchPayload(
  payload: CompanyResearchPayload,
  mappedProfile: Partial<EnterpriseProfile>
): EnterpriseProfile {
  assertLonghuaResearchPayload(payload);
  const employeeCount = numberValue(payload.employee_count, numberValue(mappedProfile.employee_count, 0));
  const revenueLastYear = numberValue(payload.revenue_last_year, numberValue(mappedProfile.revenue_last_year, 0));
  const profitLastYear = numberValue(payload.profit_last_year, numberValue(mappedProfile.profit_last_year, 0));
  const taxPaidLastYear = numberValue(payload.tax_paid_last_year, numberValue(mappedProfile.tax_paid_last_year, 0));
  const rdExpenseLastYear = numberValue(payload.rd_expense_last_year, numberValue(mappedProfile.rd_expense_last_year, 0));
  const rdEmployeeCount = numberValue(payload.rd_employee_count, numberValue(mappedProfile.rd_employee_count, 0));
  const rdExpenseRatio = numberValue(
    payload.rd_expense_ratio,
    revenueLastYear > 0 ? Math.round((rdExpenseLastYear / revenueLastYear) * 1000) / 10 : 0
  );
  const mainBusiness = firstNonEmpty(payload.main_business, mappedProfile.main_business, payload.business_scope, '待补充');
  const mainProducts =
    payload.main_products && payload.main_products.length > 0
      ? payload.main_products
      : Array.isArray(mappedProfile.main_products)
        ? mappedProfile.main_products.map(String).filter(Boolean)
        : [];

  return enterpriseProfileSchema.parse({
    company_name: payload.company_name,
    credit_code: payload.credit_code,
    city: '深圳市',
    district: '龙华区',
    registered_year: registeredYearFrom(payload.registered_year, payload.establishment_date),
    listed_status: enumValue(payload.listed_status, listedStatuses, 'unknown'),
    employee_count: employeeCount,
    industry: firstNonEmpty(payload.industry, mappedProfile.industry, '待补充'),
    main_business: mainBusiness,
    main_products: mainProducts,
    customer_type:
      payload.customer_type && payload.customer_type.length > 0
        ? payload.customer_type
        : Array.isArray(mappedProfile.customer_type)
          ? mappedProfile.customer_type.filter((value): value is CustomerType => customerTypes.includes(value as CustomerType))
          : [],
    business_model: enumValue(payload.business_model ?? mappedProfile.business_model, businessModels, 'other'),
    main_revenue_source: firstNonEmpty(payload.main_revenue_source, mappedProfile.main_revenue_source, '待补充'),
    revenue_last_year: revenueLastYear,
    profit_last_year: profitLastYear,
    tax_paid_last_year: taxPaidLastYear,
    rd_expense_last_year: rdExpenseLastYear,
    rd_expense_ratio: rdExpenseRatio,
    rd_employee_count: rdEmployeeCount,
    is_high_tech_enterprise: booleanValue(payload.is_high_tech_enterprise, booleanValue(mappedProfile.is_high_tech_enterprise, false)),
    is_tech_sme: booleanValue(payload.is_tech_sme, booleanValue(mappedProfile.is_tech_sme, false)),
    has_specialized_new_sme: booleanValue(payload.has_specialized_new_sme, booleanValue(mappedProfile.has_specialized_new_sme, false)),
    patent_count: numberValue(payload.patent_count, numberValue(mappedProfile.patent_count, 0)),
    software_copyright_count: numberValue(payload.software_copyright_count, numberValue(mappedProfile.software_copyright_count, 0)),
    tax_credit_level: 'unknown',
    has_major_violation: false,
    social_security_normal: true,
    apply_project_name: `${payload.company_name}${firstNonEmpty(payload.project_direction, '数字化转型')}项目`,
    project_direction: firstNonEmpty(payload.project_direction, mappedProfile.project_direction, '数字化转型'),
    project_stage: enumValue(payload.project_stage ?? mappedProfile.project_stage, projectStages, 'planning'),
    project_budget: numberValue(mappedProfile.project_budget, 0),
    registered_capital: numberValue(payload.registered_capital, numberValue(mappedProfile.registered_capital, 0)),
    business_address: firstNonEmpty(payload.business_address, mappedProfile.business_address),
    legal_representative: firstNonEmpty(payload.legal_representative, mappedProfile.legal_representative),
    establishment_date: firstNonEmpty(payload.establishment_date, mappedProfile.establishment_date),
    registration_status: firstNonEmpty(payload.registration_status, mappedProfile.registration_status),
    is_headquarters: booleanValue(payload.is_headquarters, booleanValue(mappedProfile.is_headquarters, false)),
    is_above_scale_enterprise: booleanValue(
      payload.is_above_scale_enterprise,
      booleanValue(mappedProfile.is_above_scale_enterprise, false)
    ),
    digital_transformation_status: firstNonEmpty(payload.digital_transformation_status, mappedProfile.digital_transformation_status),
    award_titles:
      payload.award_titles && payload.award_titles.length > 0
        ? payload.award_titles
        : Array.isArray(mappedProfile.award_titles)
          ? mappedProfile.award_titles.map(String).filter(Boolean)
          : [],
    known_projects: payload.known_projects ?? [],
    production_projects: payload.production_projects ?? [],
    employee_range: enumValue(payload.employee_range, employeeRanges, employeeRangeFromValue(employeeCount)),
    revenue_range: enumValue(payload.revenue_range, amountRanges, amountRangeFromValue(revenueLastYear)),
    profit_range: mappedProfile.profit_range ?? (profitLastYear === 0 ? 'unknown' : profitLastYear < 0 ? 'loss' : 'gte_10m'),
    tax_paid_range: enumValue(payload.tax_paid_range, amountRanges, amountRangeFromValue(taxPaidLastYear)),
    rd_expense_range: enumValue(payload.rd_expense_range, amountRanges, amountRangeFromValue(rdExpenseLastYear)),
    rd_employee_range: enumValue(payload.rd_employee_range, employeeRanges, employeeRangeFromValue(rdEmployeeCount)),
    project_budget_range: 'unknown'
  });
}

export function researchFieldSources(payload: CompanyResearchPayload, sourceName: string): FieldSource[] {
  const sources: FieldSource[] = [];
  const sourceType = payload.source_type;
  for (const evidence of payload.evidence) {
    const sourceLabel = evidence.url ? `${sourceName}: ${evidence.title} (${evidence.url})` : `${sourceName}: ${evidence.title}`;
    for (const field of evidence.fields.length > 0 ? evidence.fields : ['company_name']) {
      sources.push({
        field_key: field,
        source_name: sourceLabel,
        source_type: sourceType,
        confidence: evidence.confidence,
        is_user_confirmed: false
      });
    }
  }

  if (sources.length === 0) {
    sources.push({
      field_key: 'company_name',
      source_name: sourceName,
      source_type: sourceType,
      confidence: payload.confidence,
      is_user_confirmed: false
    });
  }

  return sources;
}

export function missingFieldsForProfile(profile: EnterpriseProfile): string[] {
  const missing: string[] = [];
  if (profile.credit_code.startsWith('UNCONFIRMED-')) missing.push('credit_code');
  if (!profile.legal_representative) missing.push('legal_representative');
  if (!profile.business_address) missing.push('business_address');
  if (profile.employee_count <= 0 || profile.employee_range === 'unknown') missing.push('employee_count');
  if (profile.revenue_last_year <= 0 || profile.revenue_range === 'unknown') missing.push('revenue_last_year');
  if (profile.profit_last_year === 0 || profile.profit_range === 'unknown') missing.push('profit_last_year');
  if (profile.tax_paid_last_year <= 0 || profile.tax_paid_range === 'unknown') missing.push('tax_paid_last_year');
  if (profile.rd_expense_last_year <= 0 || profile.rd_expense_range === 'unknown') missing.push('rd_expense_last_year');
  if (profile.rd_employee_count <= 0 || profile.rd_employee_range === 'unknown') missing.push('rd_employee_count');
  if (profile.project_budget <= 0 || profile.project_budget_range === 'unknown') missing.push('project_budget');
  return Array.from(new Set(missing));
}
