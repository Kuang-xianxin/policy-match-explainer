import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createProfileFromResearchPayload,
  missingFieldsForProfile,
  researchCompaniesWithDoubao,
  researchFieldSources,
  type CompanyResearchPayload
} from '../services/company-research.js';

describe('company research provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts a real non-seed company candidate from Doubao search evidence', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          candidates: [
            {
              company_name: '深圳市汇川技术股份有限公司',
              credit_code: '914403007488622263',
              legal_representative: '朱兴明',
              establishment_date: '2003-04-10',
              registered_year: 2003,
              registered_capital: 476961349,
              registration_status: '存续',
              business_address: '深圳市龙华区观湖街道鹭湖社区澜清二路6号汇川技术总部大厦',
              district: '龙华区',
              industry: '工业自动化控制',
              business_scope: '工业自动化产品、新能源汽车电驱和工业机器人相关产品研发、生产和销售。',
              listed_status: 'listed',
              employee_count: 30000,
              employee_range: 'gte_300',
              revenue_last_year: 30420000000,
              revenue_range: 'gte_100m',
              rd_expense_last_year: 3100000000,
              rd_expense_range: 'gte_100m',
              rd_employee_count: 8000,
              rd_employee_range: 'gte_300',
              main_business: '工业自动化控制产品、新能源汽车电驱系统和工业机器人业务。',
              main_products: ['工业自动化控制产品', '新能源汽车电驱系统', '工业机器人'],
              customer_type: ['enterprise'],
              business_model: 'manufacturing',
              main_revenue_source: '工业自动化和新能源汽车相关产品销售',
              project_direction: '智能制造',
              project_stage: 'scaling',
              known_projects: ['汇川技术总部大厦', '工业机器人研发项目'],
              production_projects: ['工业自动化控制产品量产', '新能源汽车电驱系统量产'],
              evidence: [
                {
                  title: '汇川技术投资者关系',
                  url: 'https://www.inovance.com/investor',
                  snippet: '联系地址位于深圳市龙华区观湖街道鹭湖社区澜清二路6号。',
                  fields: ['business_address', 'district'],
                  confidence: 0.92
                },
                {
                  title: '汇川技术年度报告',
                  url: 'https://www.cninfo.com.cn/',
                  snippet: '披露员工人数、营业收入和研发投入。',
                  fields: ['employee_count', 'revenue_last_year', 'rd_expense_last_year'],
                  confidence: 0.86
                }
              ],
              confidence: 0.91
            }
          ]
        })
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const candidates = await researchCompaniesWithDoubao('汇川技术', ['汇川技术'], {
      apiKey: 'test-key',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/responses',
      model: 'doubao-seed-1-6-250615',
      timeoutMs: 1000
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key'
        })
      })
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].company_name).toBe('深圳市汇川技术股份有限公司');
    expect(candidates[0].credit_code).toBe('914403007488622263');
    expect(candidates[0].registered_year).toBe(2003);
    expect(candidates[0].source_type).toBe('official_public_page');
    expect(candidates[0].evidence.length).toBeGreaterThanOrEqual(2);
  });

  it('maps evidence-backed research payload into a useful enterprise profile', () => {
    const payload: CompanyResearchPayload = {
      source_type: 'official_public_page',
      query_name: '汇川技术',
      company_name: '深圳市汇川技术股份有限公司',
      credit_code: '914403007488622263',
      legal_representative: '朱兴明',
      establishment_date: '2003-04-10',
      registered_year: 2003,
      registered_capital: 476961349,
      registration_status: '存续',
      business_address: '深圳市龙华区观湖街道鹭湖社区澜清二路6号汇川技术总部大厦',
      district: '龙华区',
      industry: '工业自动化控制',
      business_scope: '工业自动化控制产品、新能源汽车电驱系统和工业机器人业务。',
      listed_status: 'listed',
      employee_count: 30000,
      employee_range: 'gte_300',
      revenue_last_year: 30420000000,
      revenue_range: 'gte_100m',
      rd_expense_last_year: 3100000000,
      rd_expense_range: 'gte_100m',
      rd_employee_count: 8000,
      rd_employee_range: 'gte_300',
      main_business: '工业自动化控制产品、新能源汽车电驱系统和工业机器人业务。',
      main_products: ['工业自动化控制产品', '新能源汽车电驱系统', '工业机器人'],
      customer_type: ['enterprise'],
      business_model: 'manufacturing',
      main_revenue_source: '工业自动化和新能源汽车相关产品销售',
      project_direction: '智能制造',
      project_stage: 'scaling',
      known_projects: ['汇川技术总部大厦', '工业机器人研发项目'],
      production_projects: ['工业自动化控制产品量产', '新能源汽车电驱系统量产'],
      evidence: [
        {
          title: '汇川技术投资者关系',
          url: 'https://www.inovance.com/investor',
          snippet: '联系地址位于深圳市龙华区观湖街道鹭湖社区澜清二路6号。',
          fields: ['business_address', 'district'],
          confidence: 0.92
        }
      ],
      confidence: 0.91
    };

    const profile = createProfileFromResearchPayload(payload, {});
    const fieldSources = researchFieldSources(payload, 'doubao_web_search');
    const missingFields = missingFieldsForProfile(profile);

    expect(profile.company_name).toBe('深圳市汇川技术股份有限公司');
    expect(profile.legal_representative).toBe('朱兴明');
    expect(profile.registered_year).toBe(2003);
    expect(profile.business_address).toContain('龙华区');
    expect(profile.employee_count).toBe(30000);
    expect(profile.employee_range).toBe('gte_300');
    expect(profile.revenue_last_year).toBe(30420000000);
    expect(profile.rd_expense_last_year).toBe(3100000000);
    expect(profile.known_projects).toContain('工业机器人研发项目');
    expect(profile.production_projects).toContain('新能源汽车电驱系统量产');
    expect(fieldSources.some((source) => source.field_key === 'business_address' && source.source_type === 'official_public_page')).toBe(true);
    expect(missingFields).not.toContain('employee_count');
    expect(missingFields).not.toContain('revenue_last_year');
    expect(missingFields).toContain('tax_paid_last_year');
  });

  it.each([
    {
      query: '科达利',
      payload: {
        source_type: 'official_public_page',
        query_name: '科达利',
        company_name: '深圳市科达利实业股份有限公司',
        credit_code: '914403002793003543',
        establishment_date: '1996-09-20',
        registered_year: 1996,
        business_address: '深圳市龙华区大浪街道',
        district: '龙华区',
        industry: '锂电池精密结构件',
        business_scope: '锂电池精密结构件和汽车结构件研发、生产和销售。',
        listed_status: 'listed',
        employee_count: 12000,
        employee_range: 'gte_300',
        main_business: '锂电池精密结构件研发、生产和销售。',
        main_products: ['锂电池精密结构件', '汽车结构件'],
        customer_type: ['enterprise'],
        business_model: 'manufacturing',
        main_revenue_source: '精密结构件销售',
        project_direction: '智能制造',
        project_stage: 'scaling',
        known_projects: ['新能源动力电池精密结构件项目'],
        production_projects: ['锂电池精密结构件量产'],
        evidence: [
          {
            title: '科达利公司介绍',
            url: 'https://www.kedali.com.cn/about/',
            snippet: '公司成立于1996年，主营锂电池精密结构件。',
            fields: ['company_name', 'registered_year', 'main_business', 'main_products'],
            confidence: 0.86
          }
        ],
        confidence: 0.84
      } satisfies CompanyResearchPayload
    },
    {
      query: '英维克',
      payload: {
        source_type: 'official_public_page',
        query_name: '英维克',
        company_name: '深圳市英维克科技股份有限公司',
        credit_code: '91440300786581573T',
        establishment_date: '2005-08-15',
        registered_year: 2005,
        business_address: '深圳市龙华区观澜街道',
        district: '龙华区',
        industry: '精密温控节能设备',
        business_scope: '数据中心、储能、通信和工业场景温控产品研发、生产和销售。',
        listed_status: 'listed',
        employee_count: 3000,
        employee_range: 'gte_300',
        main_business: '精密温控节能设备和解决方案。',
        main_products: ['数据中心温控', '储能温控', '通信温控'],
        customer_type: ['enterprise'],
        business_model: 'manufacturing',
        main_revenue_source: '温控设备销售和解决方案服务',
        project_direction: '智能制造',
        project_stage: 'scaling',
        known_projects: ['英维克研发总部项目'],
        production_projects: ['储能温控产品量产'],
        evidence: [
          {
            title: '英维克公司介绍',
            url: 'https://www.envicool.com/about.html',
            snippet: '公司聚焦精密温控节能设备和解决方案。',
            fields: ['company_name', 'industry', 'main_business', 'main_products'],
            confidence: 0.83
          }
        ],
        confidence: 0.82
      } satisfies CompanyResearchPayload
    }
  ])('maps non-demo company sample $query without falling back to inferred draft', ({ payload }) => {
    const profile = createProfileFromResearchPayload(payload, {});
    const missingFields = missingFieldsForProfile(profile);

    expect(profile.company_name).toBe(payload.company_name);
    expect(profile.credit_code).not.toMatch(/^UNCONFIRMED-/);
    expect(profile.registered_year).toBe(payload.registered_year);
    expect(profile.business_address).toContain('龙华区');
    expect(profile.employee_count).toBeGreaterThan(0);
    expect(profile.main_products.length).toBeGreaterThan(0);
    expect(profile.known_projects?.length).toBeGreaterThan(0);
    expect(profile.production_projects?.length).toBeGreaterThan(0);
    expect(missingFields).not.toContain('employee_count');
  });
});
