export interface DemoCompanyPayload {
  company_name: string;
  credit_code: string;
  business_address: string;
  registration_status: string;
  registered_year: number;
  registered_capital: number;
  industry: string;
  business_scope: string;
  is_high_tech_enterprise: boolean;
  is_tech_sme: boolean;
  has_specialized_new_sme: boolean;
}

const demoCompanies: DemoCompanyPayload[] = [
  {
    company_name: '深圳市龙华智造科技有限公司',
    credit_code: '91440300MA5DEMO001',
    business_address: '深圳市龙华区民治街道数字创新园',
    registration_status: '存续',
    registered_year: 2020,
    registered_capital: 5000000,
    industry: '软件和信息技术服务业',
    business_scope: '人工智能软件开发、数据治理平台、企业数字化转型咨询、计算机系统集成。',
    is_high_tech_enterprise: true,
    is_tech_sme: true,
    has_specialized_new_sme: false
  },
  {
    company_name: '深圳市龙华专精特新智能装备有限公司',
    credit_code: '91440300MA5DEMO002',
    business_address: '深圳市龙华区观澜街道高端制造产业园',
    registration_status: '存续',
    registered_year: 2018,
    registered_capital: 12000000,
    industry: '智能制造装备',
    business_scope: '智能制造装备研发、工业自动化设备、智能检测产线和制造执行系统。',
    is_high_tech_enterprise: true,
    is_tech_sme: false,
    has_specialized_new_sme: true
  }
];

export function findDemoCompanies(queryName: string): DemoCompanyPayload[] {
  const normalized = queryName.trim().toLowerCase();
  const matched = demoCompanies.filter((company) => company.company_name.toLowerCase().includes(normalized));
  if (matched.length > 0) return matched;
  return demoCompanies;
}
