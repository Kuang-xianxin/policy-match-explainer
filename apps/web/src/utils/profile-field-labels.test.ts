import { describe, expect, it } from 'vitest';
import { profileFieldLabel, profileFieldLabelsFor, replaceProfileFieldKeys } from './profile-field-labels';

describe('profile field labels', () => {
  it('renders AI missing profile field keys as Chinese enterprise information labels', () => {
    expect(profileFieldLabel('industry')).toBe('所属行业');
    expect(profileFieldLabel('is_tech_sme')).toBe('科技型中小企业资质');
    expect(profileFieldLabel('rd_expense_ratio')).toBe('研发投入占比');
  });

  it('renders generated profile missing fields as Chinese labels in batch', () => {
    expect(
      profileFieldLabelsFor([
        'revenue_last_year',
        'profit_last_year',
        'tax_paid_last_year',
        'rd_expense_last_year',
        'rd_employee_count',
        'project_budget'
      ])
    ).toEqual(['上一年度营收', '上一年度利润', '上一年度纳税额', '上一年度研发费用', '研发人员数量', '项目预算']);
  });

  it('keeps unknown fields readable without showing a bare key only', () => {
    expect(profileFieldLabel('custom_internal_metric')).toBe('其他企业信息：custom_internal_metric');
  });

  it('replaces field keys inside risk notes before rendering them on web pages', () => {
    expect(replaceProfileFieldKeys('project_budget 不符合硬性条件，revenue_last_year 需要补充')).toBe(
      '项目预算 不符合硬性条件，上一年度营收 需要补充'
    );
  });
});
