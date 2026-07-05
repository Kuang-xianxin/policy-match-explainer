import { describe, expect, it } from 'vitest';
import { profileFieldLabel } from './profile-field-labels';

describe('profile field labels', () => {
  it('renders AI missing profile field keys as Chinese enterprise information labels', () => {
    expect(profileFieldLabel('industry')).toBe('所属行业');
    expect(profileFieldLabel('is_tech_sme')).toBe('科技型中小企业资质');
    expect(profileFieldLabel('rd_expense_ratio')).toBe('研发投入占比');
  });

  it('keeps unknown fields readable without showing a bare key only', () => {
    expect(profileFieldLabel('custom_internal_metric')).toBe('其他企业信息：custom_internal_metric');
  });
});
