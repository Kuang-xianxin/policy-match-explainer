<script setup lang="ts">
import { computed, ref } from 'vue';
import { FileText, LogIn, PlayCircle, Save, Search, ShieldCheck } from 'lucide-vue-next';
import type { CustomerType, EnterpriseProfile } from '@policy-match/shared';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

interface UserResponse {
  user: { id: string; email: string; display_name: string };
  token: string;
}

interface Candidate {
  lookup_id: string;
  company_name: string;
  credit_code: string;
  business_address: string;
  registration_status: string;
  source_name: string;
}

interface LookupRecord {
  id: string;
}

interface ExtractResponse {
  lookup: LookupRecord;
  extracted_profile: EnterpriseProfile;
  ai_mode: 'deepseek' | 'mock';
}

interface EnterpriseProfileRecord {
  id: string;
  company_name: string;
  credit_code: string;
  profile: EnterpriseProfile;
}

interface MatchRun {
  id: string;
}

interface MatchResult {
  id: string;
  baseline_score: number;
  baseline_level: string;
  ai_adjustment: number;
  ai_mode: string;
  final_score: number;
  final_level: string;
  ai_explanation: string;
  policy: {
    title: string;
    category: string;
  };
}

interface ReportRecord {
  content_text: string;
}

const token = ref(localStorage.getItem('policy_match_token') ?? '');
const email = ref('demo@example.com');
const password = ref('secret123');
const displayName = ref('演示用户');
const queryName = ref('龙华智造');
const statusText = ref('');
const candidates = ref<Candidate[]>([]);
const lookup = ref<LookupRecord | null>(null);
const profile = ref<EnterpriseProfile | null>(null);
const profiles = ref<EnterpriseProfileRecord[]>([]);
const matchRun = ref<MatchRun | null>(null);
const matchResults = ref<MatchResult[]>([]);
const report = ref<ReportRecord | null>(null);

const isAuthed = computed(() => token.value.length > 0);
const sortedResults = computed(() =>
  [...matchResults.value].sort((a, b) => Number(b.final_score) - Number(a.final_score))
);

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token.value) headers.set('Authorization', `Bearer ${token.value}`);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
  return data as T;
}

async function register() {
  const data = await api<UserResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: email.value, password: password.value, display_name: displayName.value })
  });
  token.value = data.token;
  localStorage.setItem('policy_match_token', data.token);
  statusText.value = `已注册并登录：${data.user.display_name}`;
  await loadProfiles();
}

async function login() {
  const data = await api<UserResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.value, password: password.value })
  });
  token.value = data.token;
  localStorage.setItem('policy_match_token', data.token);
  statusText.value = `已登录：${data.user.display_name}`;
  await loadProfiles();
}

async function searchCompany() {
  const data = await api<{ candidates: Candidate[] }>('/api/company-lookup/search', {
    method: 'POST',
    body: JSON.stringify({ query_name: queryName.value })
  });
  candidates.value = data.candidates;
  lookup.value = null;
  profile.value = null;
  statusText.value = `找到 ${data.candidates.length} 个候选企业`;
}

async function extractProfile(lookupId: string) {
  const data = await api<ExtractResponse>(`/api/company-lookup/${lookupId}/ai-extract`, { method: 'POST' });
  lookup.value = data.lookup;
  profile.value = { ...data.extracted_profile };
  statusText.value = `画像已解耦：${data.ai_mode === 'mock' ? '本地模拟 AI' : 'DeepSeek'}`;
}

async function importProfile() {
  if (!lookup.value) return;
  const data = await api<{ enterprise_profile: EnterpriseProfileRecord }>(`/api/company-lookup/${lookup.value.id}/import`, { method: 'POST' });
  profile.value = data.enterprise_profile.profile;
  statusText.value = `画像已保存：${data.enterprise_profile.company_name}`;
  await loadProfiles();
}

async function saveManualProfile() {
  const data = await api<{ enterprise_profile: EnterpriseProfileRecord }>('/api/enterprise-profiles', {
    method: 'POST',
    body: JSON.stringify(profile.value)
  });
  statusText.value = `画像已保存：${data.enterprise_profile.company_name}`;
  await loadProfiles();
}

async function loadProfiles() {
  if (!token.value) return;
  const data = await api<{ enterprise_profiles: EnterpriseProfileRecord[] }>('/api/enterprise-profiles');
  profiles.value = data.enterprise_profiles;
}

async function runMatch(profileId: string) {
  const data = await api<{ match_run: MatchRun; results: MatchResult[] }>('/api/match-runs', {
    method: 'POST',
    body: JSON.stringify({ enterprise_profile_id: profileId })
  });
  matchRun.value = data.match_run;
  matchResults.value = data.results;
  report.value = null;
  statusText.value = `匹配完成：${data.results.length} 条政策`;
}

async function generateReport() {
  if (!matchRun.value) return;
  const data = await api<{ report: ReportRecord }>(`/api/match-runs/${matchRun.value.id}/report`, { method: 'POST' });
  report.value = data.report;
  statusText.value = '报告已生成';
}

function useDemoProfile() {
  profile.value = {
    company_name: '深圳市龙华智造科技有限公司',
    credit_code: '91440300MA5DEMO001',
    city: '深圳市',
    district: '龙华区',
    registered_year: 2020,
    listed_status: 'unlisted',
    employee_count: 80,
    industry: '软件和信息技术服务业',
    main_business: '人工智能、数据治理和企业数字化软件服务。',
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
    is_high_tech_enterprise: true,
    is_tech_sme: true,
    has_specialized_new_sme: false,
    patent_count: 6,
    software_copyright_count: 12,
    tax_credit_level: 'A',
    has_major_violation: false,
    social_security_normal: true,
    apply_project_name: 'AI 数据治理平台产业化项目',
    project_direction: 'AI',
    project_stage: 'launched',
    project_budget: 1200000,
    registered_capital: 5000000,
    business_address: '深圳市龙华区民治街道数字创新园'
  } satisfies EnterpriseProfile;
}

function setArrayField(field: 'main_products' | 'customer_type', value: string) {
  if (!profile.value) return;
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (field === 'customer_type') {
    const allowed: CustomerType[] = ['government', 'enterprise', 'individual', 'overseas', 'other'];
    profile.value.customer_type = values.filter((item): item is CustomerType => allowed.includes(item as CustomerType));
    return;
  }
  profile.value.main_products = values;
}
</script>

<template>
  <main class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <ShieldCheck :size="28" />
        <div>
          <strong>龙华政策匹配</strong>
          <span>MVP</span>
        </div>
      </div>
      <nav>
        <a href="#auth">账号</a>
        <a href="#lookup">企业画像</a>
        <a href="#match">匹配结果</a>
        <a href="#report">报告</a>
      </nav>
      <p class="status">{{ statusText || '等待操作' }}</p>
    </aside>

    <section class="workspace">
      <section id="auth" class="band auth-grid">
        <div>
          <h1>企业政策匹配工作台</h1>
          <p>深圳市龙华区 · PostgreSQL · TypeScript · Vue 3 · Express</p>
        </div>
        <div class="auth-form">
          <input v-model="email" placeholder="邮箱" />
          <input v-model="password" type="password" placeholder="密码" />
          <input v-model="displayName" placeholder="显示名" />
          <button @click="login"><LogIn :size="16" />登录</button>
          <button @click="register"><Save :size="16" />注册</button>
        </div>
      </section>

      <section id="lookup" class="band">
        <div class="section-title">
          <h2>企业画像</h2>
          <button @click="useDemoProfile"><Save :size="16" />填入演示画像</button>
        </div>

        <div class="lookup-bar">
          <input v-model="queryName" :disabled="!isAuthed" placeholder="企业名称" />
          <button :disabled="!isAuthed" @click="searchCompany"><Search :size="16" />查询</button>
        </div>

        <div v-if="candidates.length" class="candidate-list">
          <button v-for="item in candidates" :key="item.lookup_id" @click="extractProfile(item.lookup_id)">
            <span>{{ item.company_name }}</span>
            <small>{{ item.credit_code }} · {{ item.registration_status }}</small>
          </button>
        </div>

        <div v-if="profile" class="profile-grid">
          <label>企业名称<input v-model="profile.company_name" /></label>
          <label>信用代码<input v-model="profile.credit_code" /></label>
          <label>行业<input v-model="profile.industry" /></label>
          <label>成立年份<input v-model.number="profile.registered_year" type="number" /></label>
          <label>员工人数<input v-model.number="profile.employee_count" type="number" /></label>
          <label>主营业务<textarea v-model="profile.main_business" /></label>
          <label>产品标签<input :value="profile.main_products?.join(',')" @input="setArrayField('main_products', ($event.target as HTMLInputElement).value)" /></label>
          <label>客户类型<input :value="profile.customer_type?.join(',')" @input="setArrayField('customer_type', ($event.target as HTMLInputElement).value)" /></label>
          <label>业务模式
            <select v-model="profile.business_model">
              <option>B2B</option>
              <option>B2G</option>
              <option>SaaS</option>
              <option>platform</option>
              <option>manufacturing</option>
              <option>service</option>
            </select>
          </label>
          <label>上年营收<input v-model.number="profile.revenue_last_year" type="number" /></label>
          <label>研发投入占比<input v-model.number="profile.rd_expense_ratio" type="number" /></label>
          <label>项目方向<input v-model="profile.project_direction" /></label>
          <label>项目预算<input v-model.number="profile.project_budget" type="number" /></label>
          <label>高新技术企业
            <select v-model="profile.is_high_tech_enterprise">
              <option :value="true">是</option>
              <option :value="false">否</option>
            </select>
          </label>
          <label>科技型中小企业
            <select v-model="profile.is_tech_sme">
              <option :value="true">是</option>
              <option :value="false">否</option>
            </select>
          </label>
          <label>专精特新
            <select v-model="profile.has_specialized_new_sme">
              <option :value="true">是</option>
              <option :value="false">否</option>
            </select>
          </label>
        </div>

        <div class="actions">
          <button v-if="lookup" @click="importProfile"><Save :size="16" />确认并保存自动画像</button>
          <button v-if="profile" @click="saveManualProfile"><Save :size="16" />保存当前画像</button>
        </div>
      </section>

      <section id="match" class="band">
        <div class="section-title">
          <h2>历史画像与匹配</h2>
          <button :disabled="!isAuthed" @click="loadProfiles"><Search :size="16" />刷新</button>
        </div>

        <div class="profile-list">
          <button v-for="item in profiles" :key="item.id" @click="runMatch(item.id)">
            <strong>{{ item.company_name }}</strong>
            <small>{{ item.credit_code }}</small>
            <PlayCircle :size="18" />
          </button>
        </div>

        <div v-if="sortedResults.length" class="results-table">
          <div class="result-head">
            <span>政策</span>
            <span>基线</span>
            <span>AI</span>
            <span>最终</span>
          </div>
          <div v-for="item in sortedResults" :key="item.id" class="result-row">
            <div>
              <strong>{{ item.policy.title }}</strong>
              <small>{{ item.policy.category }}</small>
            </div>
            <span>{{ item.baseline_score }} / {{ item.baseline_level }}</span>
            <span>{{ item.ai_adjustment }} · {{ item.ai_mode }}</span>
            <span>{{ item.final_score }} / {{ item.final_level }}</span>
            <p>{{ item.ai_explanation }}</p>
          </div>
        </div>
      </section>

      <section id="report" class="band">
        <div class="section-title">
          <h2>综合报告</h2>
          <button :disabled="!matchRun" @click="generateReport"><FileText :size="16" />生成报告</button>
        </div>
        <pre v-if="report">{{ report.content_text }}</pre>
      </section>
    </section>
  </main>
</template>
