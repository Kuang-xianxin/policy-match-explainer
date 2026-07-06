export interface MatchCompanySummaryInput {
  company_name?: string | null;
  credit_code?: string | null;
  city?: string | null;
  district?: string | null;
}

export interface MatchCompanySummary {
  title: string;
  detail: string;
  location: string;
}

export function matchCompanySummary(company?: MatchCompanySummaryInput | null): MatchCompanySummary | null {
  if (!company?.company_name) return null;

  const location = [company.city, company.district].filter(Boolean).join('');
  const detailParts = [company.credit_code, location].filter((item): item is string => Boolean(item));

  return {
    title: company.company_name,
    detail: detailParts.length > 0 ? detailParts.join(' · ') : '企业主体信息待补充',
    location: location || '经营区域待补充'
  };
}
