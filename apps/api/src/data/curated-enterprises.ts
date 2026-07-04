import type { CompanyResearchPayload } from '../services/company-research.js';

interface CuratedEnterpriseRecord extends CompanyResearchPayload {
  aliases: string[];
}

const curatedEnterprises: CuratedEnterpriseRecord[] = [
  {
    aliases: ['华傲数据', '华傲', '深圳华傲数据技术有限公司', '深圳市华傲数据技术有限公司', 'audaque'],
    source_type: 'official_public_page',
    query_name: '华傲数据',
    company_name: '深圳市华傲数据技术有限公司',
    credit_code: '914403005685284492',
    legal_representative: '贾西贝',
    establishment_date: '2011-01-28',
    registered_year: 2011,
    registered_capital: 19456911,
    registration_status: '开业',
    business_address: '深圳市龙华区民治街道北站社区汇德大厦1号楼2203/2204',
    district: '龙华区',
    industry: '软件和信息技术服务业',
    business_scope: '计算机软件、大数据、网络工程、数据治理、数据质量、数据集成和复杂数据管理相关技术开发、咨询、服务和转让。',
    listed_status: 'unlisted',
    employee_count: 500,
    employee_range: 'gte_300',
    revenue_last_year: 0,
    revenue_range: 'unknown',
    profit_last_year: 0,
    profit_range: 'unknown',
    tax_paid_last_year: 0,
    tax_paid_range: 'unknown',
    rd_expense_last_year: 0,
    rd_expense_range: 'unknown',
    rd_expense_ratio: 0,
    rd_employee_count: 0,
    rd_employee_range: 'unknown',
    is_high_tech_enterprise: false,
    is_tech_sme: false,
    has_specialized_new_sme: true,
    patent_count: 0,
    software_copyright_count: 0,
    main_business: '为政府和大型企业提供数据治理、数据质量、数据集成、大数据分析和复杂数据管理产品及解决方案。',
    main_products: ['数据质量管理系统', '数据剖析系统', '数据集成及数据清洗系统', '复杂数据管理系统'],
    customer_type: ['government', 'enterprise'],
    business_model: 'B2G',
    main_revenue_source: '数据治理软件产品、行业解决方案和项目交付服务',
    project_direction: '数据治理',
    project_stage: 'launched',
    known_projects: ['龙华区企业服务平台', '数据治理平台建设项目', '数据质量管理产品研发'],
    production_projects: ['龙华区企业服务平台', '政企数据治理解决方案落地项目'],
    evidence: [
      {
        title: '爱企查工商注册信息',
        url: 'https://aiqicha.baidu.com/company_detail_32072216595416',
        snippet: '公开工商信息显示企业名称、统一社会信用代码、法定代表人、成立日期、注册资本、经营状态和龙华区注册地址。',
        fields: [
          'company_name',
          'credit_code',
          'legal_representative',
          'establishment_date',
          'registered_year',
          'registered_capital',
          'registration_status',
          'business_address',
          'district'
        ],
        confidence: 0.9
      },
      {
        title: '华傲数据官网',
        url: 'https://www.audaque.com/',
        snippet: '公司官网介绍其聚焦数字中国建设，提供覆盖数据生命周期的数据智能产品和行业解决方案。',
        fields: ['industry', 'main_business', 'main_products', 'project_direction'],
        confidence: 0.86
      },
      {
        title: '36氪创投平台项目信息',
        url: 'https://pitchhub.36kr.com/project/1678319905666051',
        snippet: '公开项目信息列出数据质量、数据剖析、数据集成清洗和复杂数据管理等产品方向。',
        fields: ['main_products', 'main_business', 'business_model', 'customer_type'],
        confidence: 0.82
      },
      {
        title: '21财经华傲数据报道',
        url: 'https://www.21jingji.com/article/20220701/herald/17323a2418ca447a2fd512ab48063407.html',
        snippet: '报道提到龙华区企业服务平台由华傲数据与龙华区工信部门及企业服务中心联合研发。',
        fields: ['known_projects', 'production_projects', 'customer_type'],
        confidence: 0.82
      },
      {
        title: '猎聘公司公开招聘页',
        url: 'https://m.liepin.com/company/6825371/',
        snippet: '招聘页公开标注公司规模为500-999人，用于估算员工人数区间。',
        fields: ['employee_count', 'employee_range'],
        confidence: 0.68
      }
    ],
    confidence: 0.9
  }
];

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '').replace(/^深圳市?/u, '深圳');
}

function matchesKeyword(record: CuratedEnterpriseRecord, keyword: string): boolean {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return false;
  const haystack = [record.company_name, record.credit_code, record.business_address, record.industry, ...record.aliases]
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeSearchText)
    .join(' ');
  return haystack.includes(normalizedKeyword) || normalizedKeyword.includes(normalizeSearchText(record.company_name));
}

export function searchCuratedEnterpriseResearch(keywords: string[]): CompanyResearchPayload[] {
  const matched = curatedEnterprises.filter((record) => keywords.some((keyword) => matchesKeyword(record, keyword)));
  return matched.map(({ aliases: _aliases, ...payload }) => payload);
}
