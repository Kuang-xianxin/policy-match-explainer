import { describe, expect, it } from 'vitest';
import { searchCuratedEnterpriseResearch } from '../data/curated-enterprises.js';

describe('curated enterprise lookup', () => {
  it('does not match Huaao Data from generic AI keywords for a different company', () => {
    const results = searchCuratedEnterpriseResearch(['深圳市乐牙科技有限公司', '乐牙科技', '深圳', '科技公司']);

    expect(results).toHaveLength(0);
  });

  it.each([
    ['深圳市乐牙科技有限公司', ['深圳市乐牙科技有限公司', '乐牙科技', '深圳', '科技公司']],
    ['深圳市有方科技股份有限公司', ['深圳市有方科技股份有限公司', '有方科技', '深圳', '龙华区', '物联网']],
    ['深圳市杰普特光电股份有限公司', ['深圳市杰普特光电股份有限公司', '杰普特', '深圳', '龙华', '光电设备']],
    ['深圳市科达利实业股份有限公司', ['深圳市科达利实业股份有限公司', '科达利', '深圳', '龙华总部', '新能源']]
  ])('does not map unknown Longhua sample %s to a curated known company', (_companyName, keywords) => {
    const results = searchCuratedEnterpriseResearch(keywords);

    expect(results).toHaveLength(0);
  });

  it('still matches Huaao Data by abbreviation and full legal name', () => {
    const byAbbreviation = searchCuratedEnterpriseResearch(['华傲数据']);
    const byFullName = searchCuratedEnterpriseResearch(['深圳市华傲数据技术有限公司']);

    expect(byAbbreviation[0]?.company_name).toBe('深圳市华傲数据技术有限公司');
    expect(byFullName[0]?.company_name).toBe('深圳市华傲数据技术有限公司');
  });
});
