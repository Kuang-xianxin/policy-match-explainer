import type {
  AiMatchReview,
  BaselineMatchResult,
  CompanyLookupPlan,
  EnterpriseProfile,
  FieldSource,
  Policy
} from '@policy-match/shared';

export interface AiConfig {
  apiKey?: string;
  model: string;
  baseUrl: string;
  timeoutMs?: number;
}

export interface ExtractProfileInput {
  rawPayload: Record<string, unknown>;
  sourceName: string;
}

export interface ExtractedProfileResult {
  mapped_profile: Partial<EnterpriseProfile>;
  field_sources: FieldSource[];
  missing_fields: string[];
  ai_confidence: number;
  ai_mode: 'deepseek' | 'mock';
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function hasApiKey(config: AiConfig): boolean {
  return Boolean(config.apiKey && config.apiKey.trim().length > 0);
}

async function callDeepSeekJson<T>(config: AiConfig, systemPrompt: string, userPayload: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15000);
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) }
      ]
    })
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned empty content');
  return JSON.parse(content) as T;
}

function mockCompanyLookupPlan(queryName: string): CompanyLookupPlan {
  const normalizedQuery = queryName.trim();
  const withoutCompanySuffix = normalizedQuery.replace(/(有限责任公司|股份有限公司|有限公司|公司)$/u, '');
  const searchKeywords = uniqueNonEmpty([normalizedQuery, withoutCompanySuffix]);

  return {
    normalized_query: normalizedQuery,
    search_keywords: searchKeywords.length > 0 ? searchKeywords : [normalizedQuery],
    recommended_sources: ['local_longhua_enterprise_index', 'official_open_data_api'],
    explanation:
      'Mock mode only normalizes the company query. Real enterprise facts must come from backend data providers or local authorized indexes, not from model generation.',
    ai_mode: 'mock'
  };
}

export async function planCompanyLookup(queryName: string, config: AiConfig): Promise<CompanyLookupPlan> {
  if (!hasApiKey(config)) return mockCompanyLookupPlan(queryName);

  const fallback = mockCompanyLookupPlan(queryName);
  let result: Partial<CompanyLookupPlan>;
  try {
    result = await callDeepSeekJson<Partial<CompanyLookupPlan>>(
      config,
      [
        'You are an enterprise lookup query planner for a policy matching system.',
        'You cannot browse the web and you must not invent company candidates or enterprise facts.',
        'Only output a JSON query plan for backend data-source tools.',
        'The backend will use local enterprise indexes or official public data providers to fetch raw company records.',
        'Output JSON keys: normalized_query, search_keywords, recommended_sources, explanation.'
      ].join('\n'),
      { query_name: queryName }
    );
  } catch (error) {
    return {
      ...fallback,
      explanation: `${fallback.explanation} DeepSeek query planning failed and mock fallback was used: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
  const searchKeywords = uniqueNonEmpty([
    fallback.normalized_query,
    ...(Array.isArray(result.search_keywords) ? result.search_keywords.map(String) : fallback.search_keywords)
  ]);
  const recommendedSources = uniqueNonEmpty(
    Array.isArray(result.recommended_sources)
      ? result.recommended_sources.map(String)
      : fallback.recommended_sources
  );
  const normalizedQuery = String(result.normalized_query ?? fallback.normalized_query).trim();
  return {
    normalized_query:
      normalizedQuery && !normalizedQuery.toLowerCase().includes('unknown') ? normalizedQuery : fallback.normalized_query,
    search_keywords: searchKeywords.length > 0 ? searchKeywords : fallback.search_keywords,
    recommended_sources: recommendedSources.length > 0 ? recommendedSources : fallback.recommended_sources,
    explanation: String(result.explanation ?? fallback.explanation),
    ai_mode: 'deepseek'
  };
}

function mockExtractProfile(input: ExtractProfileInput): ExtractedProfileResult {
  const raw = input.rawPayload;
  const mappedProfile: Partial<EnterpriseProfile> = {
    company_name: String(raw.company_name ?? ''),
    credit_code: String(raw.credit_code ?? ''),
    city: '深圳市',
    district: '龙华区',
    registered_year: Number(raw.registered_year ?? 2021),
    registered_capital: Number(raw.registered_capital ?? 1000000),
    business_address: String(raw.business_address ?? '深圳市龙华区'),
    listed_status: 'unlisted',
    employee_count: 0,
    industry: String(raw.industry ?? '软件和信息技术服务业'),
    main_business: String(raw.business_scope ?? '人工智能、数据治理和企业数字化软件服务。'),
    main_products: ['AI 数据治理平台', '企业政策分析系统'],
    customer_type: ['enterprise', 'government'],
    business_model: 'SaaS',
    main_revenue_source: '软件订阅、项目交付和技术服务',
    revenue_last_year: 0,
    profit_last_year: 0,
    tax_paid_last_year: 0,
    rd_expense_last_year: 0,
    rd_expense_ratio: 0,
    rd_employee_count: 0,
    is_high_tech_enterprise: Boolean(raw.is_high_tech_enterprise ?? true),
    is_tech_sme: Boolean(raw.is_tech_sme ?? true),
    has_specialized_new_sme: Boolean(raw.has_specialized_new_sme ?? false),
    patent_count: 0,
    software_copyright_count: 0,
    tax_credit_level: 'unknown',
    has_major_violation: false,
    social_security_normal: true,
    apply_project_name: 'AI 数据治理平台产业化项目',
    project_direction: 'AI',
    project_stage: 'launched',
    project_budget: 0,
    digital_transformation_status: '已形成产品并服务企业客户',
    award_titles: ['科技型中小企业'],
    revenue_range: 'unknown',
    profit_range: 'unknown',
    tax_paid_range: 'unknown',
    rd_expense_range: 'unknown',
    rd_employee_range: 'unknown',
    project_budget_range: 'unknown'
  };

  const inferredFields = ['industry', 'main_business', 'main_products', 'business_model'];
  const sourceIsDemo = input.sourceName.toLowerCase().includes('demo');
  const fieldSources = Object.keys(mappedProfile).map((fieldKey) => ({
    field_key: fieldKey,
    source_name: inferredFields.includes(fieldKey) ? 'DeepSeek mock inference from demo payload' : input.sourceName,
    source_type: inferredFields.includes(fieldKey) || sourceIsDemo ? 'inferred' : 'official_open_data',
    confidence: inferredFields.includes(fieldKey) || sourceIsDemo ? 0.72 : 0.9,
    is_user_confirmed: false
  })) satisfies FieldSource[];

  return {
    mapped_profile: mappedProfile,
    field_sources: fieldSources,
    missing_fields: [
      'employee_count',
      'revenue_last_year',
      'profit_last_year',
      'tax_paid_last_year',
      'rd_expense_last_year',
      'rd_employee_count',
      'project_budget'
    ],
    ai_confidence: 0.78,
    ai_mode: 'mock'
  };
}

export async function extractEnterpriseProfile(
  input: ExtractProfileInput,
  config: AiConfig
): Promise<ExtractedProfileResult> {
  if (!hasApiKey(config)) return mockExtractProfile(input);

  try {
    const result = await callDeepSeekJson<Partial<ExtractedProfileResult>>(
      config,
      [
        '你是企业画像字段解耦助手。',
        '只能从输入 rawPayload 中提取字段，低风险推断必须标记为 inferred。',
        '不得编造员工数、营收、利润、纳税、研发、社保、项目预算等内部字段；没有证据时使用 0 和 unknown 区间。',
        '必须输出 JSON，字段为 mapped_profile, field_sources, missing_fields, ai_confidence。'
      ].join('\n'),
      input
    );
    return {
      mapped_profile: result.mapped_profile ?? {},
      field_sources: Array.isArray(result.field_sources) ? result.field_sources : [],
      missing_fields: Array.isArray(result.missing_fields) ? result.missing_fields.map(String) : [],
      ai_confidence: Number.isFinite(Number(result.ai_confidence)) ? Number(result.ai_confidence) : 0.5,
      ai_mode: 'deepseek'
    };
  } catch {
    return mockExtractProfile(input);
  }
}

function mockReview(baseline: BaselineMatchResult): AiMatchReview {
  const hasHardFailure = baseline.hard_failures.length > 0;
  const adjustment = hasHardFailure ? 0 : baseline.baseline_level === 'potential' ? 3 : 0;
  return {
    ai_review_summary: hasHardFailure
      ? 'AI 复核：该政策存在硬性条件失败，只能作为后续整改参考。'
      : 'AI 复核：规则命中项与企业画像方向一致，建议优先关注命中度较高的政策。',
    ai_explanation:
      baseline.matched_conditions.length > 0
        ? `已命中 ${baseline.matched_conditions.length} 项条件，主要优势集中在区域、产业方向和创新资质。`
        : '当前公开或已填写信息不足，建议先补齐企业资质、研发投入和项目预算。',
    ai_missing_fields: baseline.missing_conditions.map((item) => item.field_key),
    ai_suggested_actions: hasHardFailure
      ? ['先处理硬性不符合项，再考虑申报。']
      : ['核对政策原文和申报窗口。', '补充研发、纳税和项目预算证明材料。'],
    ai_confidence: 0.74,
    ai_adjustment: adjustment,
    ai_mode: 'mock'
  };
}

export async function reviewPolicyMatch(
  profile: EnterpriseProfile,
  policy: Policy,
  baseline: BaselineMatchResult,
  config: AiConfig
): Promise<AiMatchReview> {
  if (!hasApiKey(config)) return mockReview(baseline);

  try {
    const result = await callDeepSeekJson<AiMatchReview>(
      config,
      [
        '你是龙华区惠企政策匹配复核助手。',
        '你只能基于企业画像、政策原文、政策规则和规则引擎基线结果解释。',
        '硬性条件失败时不得把政策改成推荐。',
        'ai_adjustment 必须在 -5 到 5 之间。',
        '必须输出 JSON。'
      ].join('\n'),
      { profile, policy, baseline }
    );
    const fallback = mockReview(baseline);

    return {
      ai_review_summary: String(result.ai_review_summary ?? fallback.ai_review_summary),
      ai_explanation: String(result.ai_explanation ?? fallback.ai_explanation),
      ai_missing_fields: Array.isArray(result.ai_missing_fields)
        ? result.ai_missing_fields.map(String)
        : fallback.ai_missing_fields,
      ai_suggested_actions: Array.isArray(result.ai_suggested_actions)
        ? result.ai_suggested_actions.map(String)
        : fallback.ai_suggested_actions,
      ai_confidence: Number.isFinite(Number(result.ai_confidence)) ? Number(result.ai_confidence) : fallback.ai_confidence,
      ai_adjustment: Math.max(-5, Math.min(5, Number(result.ai_adjustment ?? 0))),
      ai_mode: 'deepseek'
    };
  } catch {
    return mockReview(baseline);
  }
}

type ReportMatchResult = BaselineMatchResult & AiMatchReview & {
  final_score?: number;
  final_level?: string;
  source_url?: string;
  category?: string;
  policy?: { title?: string; category?: string; source_url?: string };
};

const reportLevelLabels: Record<string, string> = {
  recommended: '优先推荐',
  potential: '可重点关注',
  need_more_info: '需要补充信息',
  not_recommended: '暂不推荐'
};

function reportLevel(result: ReportMatchResult): string {
  return result.final_level ?? result.baseline_level;
}

function reportScore(result: ReportMatchResult): number {
  return Number(result.final_score ?? result.baseline_score ?? 0);
}

function reportPolicyTitle(result: ReportMatchResult, index: number): string {
  return result.policy_title || result.policy?.title || `政策 ${index + 1}`;
}

function uniqueText(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function fallbackReport(
  profile: EnterpriseProfile,
  results: ReportMatchResult[]
): string {
  const sortedResults = [...results].sort((a, b) => reportScore(b) - reportScore(a));
  const recommended = sortedResults.filter((item) => reportLevel(item) === 'recommended').length;
  const potential = sortedResults.filter((item) => reportLevel(item) === 'potential').length;
  const needMoreInfo = sortedResults.filter((item) => reportLevel(item) === 'need_more_info').length;
  const hardFailureCount = sortedResults.filter((item) => item.hard_failures.length > 0).length;
  const topPolicies = sortedResults.slice(0, 3);
  const missingFields = uniqueText([
    ...sortedResults.flatMap((item) => item.missing_conditions.map((condition) => condition.field_key)),
    ...sortedResults.flatMap((item) => item.ai_missing_fields)
  ]).slice(0, 6);
  const suggestedActions = uniqueText(sortedResults.flatMap((item) => item.ai_suggested_actions)).slice(0, 5);
  const risks = uniqueText([
    ...sortedResults.flatMap((item) => item.hard_failures),
    ...sortedResults.flatMap((item) => item.risk_notes)
  ]).slice(0, 5);

  const policyLines = topPolicies.length
    ? topPolicies.map((item, index) => {
        const level = reportLevelLabels[reportLevel(item)] ?? reportLevel(item);
        const matched = item.matched_conditions.length;
        const missing = item.missing_conditions.length;
        return `${index + 1}. ${reportPolicyTitle(item, index)}：当前 ${reportScore(item)} 分，状态为“${level}”。已命中 ${matched} 项条件，仍有 ${missing} 项信息需要补充或核对。`;
      })
    : ['1. 暂无可排序政策结果，建议先补齐企业画像后重新匹配。'];
  const actionLines = [
    '1. 先核对政策原文和申报窗口：确认政策是否仍在有效期、是否有年度申报通知、是否需要线上系统填报。',
    '2. 再补齐影响评分的关键材料：优先准备研发费用、纳税证明、项目预算、知识产权和资质证明。',
    '3. 最后复跑匹配并筛选申报顺序：先处理分数高且无硬性失败的政策，再评估需要整改的政策。'
  ];
  const aiActionLines = suggestedActions.map((action, index) => `${index + 4}. ${action}`);
  const missingLine = missingFields.length
    ? `建议优先补充字段：${missingFields.join('、')}。`
    : '当前没有明显缺失字段，但正式申报前仍应核对证明材料原件和政策附件要求。';
  const riskLines = risks.length
    ? risks.map((risk, index) => `${index + 1}. ${risk}`)
    : ['1. 未发现明确硬性失败项，但本报告不能替代政策主管部门的最终审核。'];

  return [
    '## 综合结论',
    `${profile.company_name} 当前画像显示具备龙华区政策匹配基础。系统已识别优先推荐政策 ${recommended} 项、可重点关注政策 ${potential} 项、需要补充信息政策 ${needMoreInfo} 项、存在硬性失败或暂不推荐政策 ${hardFailureCount} 项。`,
    `${profile.industry}、${profile.main_business}、${profile.project_direction} 等方向可以作为解释匹配理由的核心依据，但营收、纳税、研发投入和项目预算仍应以企业真实材料为准。`,
    '',
    '## 申报优先级',
    ...policyLines,
    '',
    '## 可行建议',
    ...actionLines,
    ...aiActionLines,
    '',
    '## 材料准备清单',
    `- 企业主体材料：营业执照、统一社会信用代码、注册地址或经营地址证明、无重大违法违规说明。`,
    `- 财税经营材料：上一年度营收、利润、纳税证明、税务信用等级及社保缴纳情况。`,
    `- 研发项目材料：研发费用辅助账、研发人员清单、知识产权清单、项目预算、项目阶段和已落地成果。`,
    `- 政策对应材料：围绕 ${topPolicies.map((item, index) => reportPolicyTitle(item, index)).join('、') || '目标政策'} 核对专项申报指南和附件模板。`,
    missingLine,
    '',
    '## 风险与限制',
    ...riskLines,
    `${riskLines.length + 1}. 本报告仅基于当前画像和本地政策规则生成；如政策原文、申报指南或企业经营数据发生变化，应重新匹配。`
  ].join('\n');
}

function mockReport(
  profile: EnterpriseProfile,
  results: Array<BaselineMatchResult & AiMatchReview>
): { content_text: string; ai_mode: 'mock' } {
  return {
    ai_mode: 'mock',
    content_text: fallbackReport(profile, results)
  };
}

export async function generateReport(
  profile: EnterpriseProfile,
  results: Array<BaselineMatchResult & AiMatchReview>,
  config: AiConfig
): Promise<{ content_text: string; ai_mode: 'deepseek' | 'mock' }> {
  if (!hasApiKey(config)) return mockReport(profile, results);

  try {
    const result = await callDeepSeekJson<{ content_text: string }>(
      config,
      [
        '你是企业惠企政策评估报告助手。',
        '不得编造政策、申报入口或企业经营数据。',
        '必须基于输入的企业画像、规则基线和 AI 复核结果写详细中文报告。',
        '报告必须包含这些标题：综合结论、申报优先级、可行建议、材料准备清单、风险与限制。',
        '报告使用 Markdown 格式；主标题统一使用二级标题（##），不要使用四级或更深标题（####、#####、######）。',
        '可行建议必须按可执行顺序写，说明先做什么、为什么做、需要准备什么。',
        '材料清单必须区分企业主体材料、财税经营材料、研发项目材料和政策对应材料。',
        '风险与限制必须说明硬性失败项、待补字段和需要核对政策原文/申报窗口的事项。',
        '不要虚构申报时间、金额、网址、政策名称或企业未提供的经营数据。',
        '输出 JSON: { "content_text": string }。'
      ].join('\n'),
      { profile, results }
    );

    if (!result.content_text || typeof result.content_text !== 'string') return mockReport(profile, results);
    return { content_text: result.content_text, ai_mode: 'deepseek' };
  } catch {
    return mockReport(profile, results);
  }
}
