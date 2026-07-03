import type {
  AiMatchReview,
  BaselineMatchResult,
  EnterpriseProfile,
  FieldSource,
  Policy
} from '@policy-match/shared';

export interface AiConfig {
  apiKey?: string;
  model: string;
  baseUrl: string;
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

function hasApiKey(config: AiConfig): boolean {
  return Boolean(config.apiKey && config.apiKey.trim().length > 0);
}

async function callDeepSeekJson<T>(config: AiConfig, systemPrompt: string, userPayload: unknown): Promise<T> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
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
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned empty content');
  return JSON.parse(content) as T;
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
    employee_count: 80,
    industry: String(raw.industry ?? '软件和信息技术服务业'),
    main_business: String(raw.business_scope ?? '人工智能、数据治理和企业数字化软件服务。'),
    main_products: ['AI 数据治理平台', '企业政策分析系统'],
    customer_type: ['enterprise', 'government'],
    business_model: 'SaaS',
    main_revenue_source: '软件订阅、项目交付和技术服务',
    revenue_last_year: 6000000,
    profit_last_year: 900000,
    tax_paid_last_year: 350000,
    rd_expense_last_year: 900000,
    rd_expense_ratio: 15,
    rd_employee_count: 24,
    is_high_tech_enterprise: Boolean(raw.is_high_tech_enterprise ?? true),
    is_tech_sme: Boolean(raw.is_tech_sme ?? true),
    has_specialized_new_sme: Boolean(raw.has_specialized_new_sme ?? false),
    patent_count: 6,
    software_copyright_count: 12,
    tax_credit_level: 'A',
    has_major_violation: false,
    social_security_normal: true,
    apply_project_name: 'AI 数据治理平台产业化项目',
    project_direction: 'AI',
    project_stage: 'launched',
    project_budget: 1200000,
    digital_transformation_status: '已形成产品并服务企业客户',
    award_titles: ['科技型中小企业']
  };

  const inferredFields = ['industry', 'main_business', 'main_products', 'business_model'];
  const fieldSources = Object.keys(mappedProfile).map((fieldKey) => ({
    field_key: fieldKey,
    source_name: inferredFields.includes(fieldKey) ? 'DeepSeek mock inference from demo payload' : input.sourceName,
    source_type: inferredFields.includes(fieldKey) ? 'inferred' : 'official_open_data',
    confidence: inferredFields.includes(fieldKey) ? 0.72 : 0.9,
    is_user_confirmed: false
  })) satisfies FieldSource[];

  return {
    mapped_profile: mappedProfile,
    field_sources: fieldSources,
    missing_fields: [],
    ai_confidence: 0.78,
    ai_mode: 'mock'
  };
}

export async function extractEnterpriseProfile(
  input: ExtractProfileInput,
  config: AiConfig
): Promise<ExtractedProfileResult> {
  if (!hasApiKey(config)) return mockExtractProfile(input);

  return callDeepSeekJson<ExtractedProfileResult>(
    config,
    [
      '你是企业画像字段解耦助手。',
      '只能从输入 rawPayload 中提取字段，低风险推断必须标记为 inferred。',
      '不得编造营收、利润、纳税、研发、社保、项目预算等内部字段。',
      '必须输出 JSON，字段为 mapped_profile, field_sources, missing_fields, ai_confidence。'
    ].join('\n'),
    input
  ).then((result) => ({ ...result, ai_mode: 'deepseek' }));
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

  return {
    ...result,
    ai_adjustment: Math.max(-5, Math.min(5, Number(result.ai_adjustment ?? 0))),
    ai_mode: 'deepseek'
  };
}

export async function generateReport(
  profile: EnterpriseProfile,
  results: Array<BaselineMatchResult & AiMatchReview>,
  config: AiConfig
): Promise<{ content_text: string; ai_mode: 'deepseek' | 'mock' }> {
  if (!hasApiKey(config)) {
    const recommended = results.filter((item) => item.baseline_level === 'recommended').length;
    const potential = results.filter((item) => item.baseline_level === 'potential').length;
    return {
      ai_mode: 'mock',
      content_text: [
        `综合结论：${profile.company_name} 当前画像显示具备龙华区政策匹配基础。`,
        `推荐关注政策 ${recommended} 项，可能匹配政策 ${potential} 项。`,
        '主要优势：企业位于深圳市龙华区，业务方向覆盖 AI、数据治理和软件服务，研发投入比例较高。',
        '主要短板：正式申报前仍需核对政策原文、申报窗口、纳税证明、研发费用辅助账和项目预算材料。',
        '下一步建议：优先处理推荐关注政策，补齐缺失字段后再复跑匹配。'
      ].join('\n')
    };
  }

  const result = await callDeepSeekJson<{ content_text: string }>(
    config,
    [
      '你是企业惠企政策评估报告助手。',
      '不得编造政策、申报入口或企业经营数据。',
      '必须基于输入的匹配结果写出简洁中文报告，并输出 JSON: { "content_text": string }。'
    ].join('\n'),
    { profile, results }
  );

  return { content_text: result.content_text, ai_mode: 'deepseek' };
}
