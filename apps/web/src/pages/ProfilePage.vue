<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { PlayCircle, PlusCircle, Save, Search, WandSparkles } from 'lucide-vue-next';
import type { AmountRange, EmployeeRange, ProfitRange } from '@policy-match/shared';
import {
  appState,
  applyAmountRange,
  applyCompanyEmployeeRange,
  applyEmployeeRange,
  applyProfitRange,
  generateProfileFromCandidate,
  loadProfiles,
  runMatch,
  saveManualProfile,
  searchCompany,
  setArrayField,
  startManualProfile
} from '../state/app-state';

const router = useRouter();
const errorText = ref('');
const queryName = ref('');
const isSearching = ref(false);
const isGenerating = ref(false);
const profile = computed(() => appState.draftProfile);

const amountRangeOptions: Array<{ value: AmountRange; label: string }> = [
  { value: 'unknown', label: '未知' },
  { value: 'none', label: '无或接近 0' },
  { value: 'lt_1m', label: '100 万以下' },
  { value: '1m_5m', label: '100 万-500 万' },
  { value: '5m_20m', label: '500 万-2000 万' },
  { value: '20m_100m', label: '2000 万-1 亿' },
  { value: 'gte_100m', label: '1 亿以上' }
];

const profitRangeOptions: Array<{ value: ProfitRange; label: string }> = [
  { value: 'unknown', label: '未知' },
  { value: 'loss', label: '亏损' },
  { value: 'break_even', label: '基本持平' },
  { value: 'lt_500k', label: '50 万以下' },
  { value: '500k_2m', label: '50 万-200 万' },
  { value: '2m_10m', label: '200 万-1000 万' },
  { value: 'gte_10m', label: '1000 万以上' }
];

const employeeRangeOptions: Array<{ value: EmployeeRange; label: string }> = [
  { value: 'unknown', label: '未知' },
  { value: 'lt_10', label: '10 人以下' },
  { value: '10_50', label: '10-50 人' },
  { value: '50_100', label: '50-100 人' },
  { value: '100_300', label: '100-300 人' },
  { value: 'gte_300', label: '300 人以上' }
];

const customerTypeOptions = [
  { value: 'government', label: '政府客户' },
  { value: 'enterprise', label: '企业客户' },
  { value: 'individual', label: '个人客户' },
  { value: 'overseas', label: '海外客户' },
  { value: 'other', label: '其他' }
] as const;

onMounted(() => {
  void loadProfiles();
});

async function doSearch() {
  errorText.value = '';
  if (queryName.value.trim().length < 2) {
    errorText.value = '请输入至少 2 个字的企业名称或简称';
    return;
  }
  isSearching.value = true;
  try {
    await searchCompany(queryName.value);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '企业候选查询失败';
  } finally {
    isSearching.value = false;
  }
}

async function doGenerate(lookupId: string) {
  errorText.value = '';
  isGenerating.value = true;
  try {
    await generateProfileFromCandidate(lookupId);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '生成画像失败';
  } finally {
    isGenerating.value = false;
  }
}

async function doSaveManual() {
  errorText.value = '';
  try {
    await saveManualProfile();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '保存画像失败';
  }
}

async function doSaveAndMatch() {
  errorText.value = '';
  try {
    const saved = await saveManualProfile();
    if (!saved) return;
    await runMatch(saved.id);
    await router.push('/results');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '保存并匹配失败';
  }
}

async function doMatch(profileId: string) {
  errorText.value = '';
  try {
    await runMatch(profileId);
    await router.push('/results');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '匹配失败';
  }
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>企业画像生成</h1>
        <p>先输入企业名称或简称，由 AI 规划查询词并从本地龙华企业索引中找候选；选择企业后生成待确认画像，再补少量关键区间。</p>
      </div>
      <button class="outline-button" @click="startManualProfile"><PlusCircle :size="16" />空白手动编辑</button>
    </div>

    <section class="panel">
      <div class="section-title">
        <div>
          <h2>1. 搜索候选企业</h2>
          <p class="hint">当前不接入付费企查查/天眼查 API，MVP 使用本地龙华企业示例索引；后续可替换为授权公开数据源。</p>
        </div>
      </div>

      <div class="search-row">
        <label>企业名称或简称
          <input v-model="queryName" placeholder="例如：龙华智造、专精特新装备" @keyup.enter="doSearch" />
        </label>
        <button :disabled="isSearching" @click="doSearch"><Search :size="16" />{{ isSearching ? '查询中' : '查询候选' }}</button>
      </div>

      <p v-if="errorText" class="error-text">{{ errorText }}</p>

      <div v-if="appState.lookupPlan" class="lookup-plan">
        <strong>AI 查询计划</strong>
        <span>模式：{{ appState.lookupPlan.ai_mode === 'deepseek' ? 'DeepSeek' : 'mock' }}</span>
        <span>标准查询：{{ appState.lookupPlan.normalized_query }}</span>
        <span>关键词：{{ appState.lookupPlan.search_keywords.join('、') }}</span>
      </div>

      <div v-if="appState.candidates.length > 0" class="candidate-list">
        <button
          v-for="item in appState.candidates"
          :key="item.lookup_id"
          class="candidate-card"
          :disabled="isGenerating"
          @click="doGenerate(item.lookup_id)"
        >
          <span>
            <strong>{{ item.company_name }}</strong>
            <small>{{ item.credit_code }} · {{ item.business_address }}</small>
            <small>{{ item.source_name }} · 置信度 {{ Math.round((item.confidence ?? 0) * 100) }}%</small>
          </span>
          <WandSparkles :size="18" />
        </button>
      </div>

      <p v-else-if="appState.lookupPlan" class="hint">没有找到候选企业。可以换一个简称，或点击“空白手动编辑”。</p>
    </section>

    <section v-if="profile" class="panel">
      <div class="section-title">
        <div>
          <h2>2. 确认画像并补关键区间</h2>
          <p class="hint">公开字段自动带入；营收、研发、纳税、项目预算等非公开字段只选区间，也可以选未知。</p>
        </div>
        <div class="button-row">
          <button class="outline-button" @click="doSaveManual"><Save :size="16" />保存画像</button>
          <button @click="doSaveAndMatch"><PlayCircle :size="16" />保存并匹配</button>
        </div>
      </div>

      <div v-if="appState.generatedProfileMeta" class="lookup-plan">
        <span>画像生成：{{ appState.generatedProfileMeta.ai_mode === 'deepseek' ? 'DeepSeek' : 'mock' }}</span>
        <span>置信度：{{ Math.round(appState.generatedProfileMeta.ai_confidence * 100) }}%</span>
        <span>待补字段：{{ appState.generatedProfileMeta.missing_fields.join('、') }}</span>
      </div>

      <div class="profile-summary">
        <div>
          <small>企业名称</small>
          <strong>{{ profile.company_name || '待填写' }}</strong>
        </div>
        <div>
          <small>统一社会信用代码</small>
          <strong>{{ profile.credit_code || '待填写' }}</strong>
        </div>
        <div>
          <small>行业</small>
          <strong>{{ profile.industry || '待填写' }}</strong>
        </div>
        <div>
          <small>经营地址</small>
          <strong>{{ profile.business_address || '待填写' }}</strong>
        </div>
      </div>

      <div class="supplement-grid">
        <label>企业人数
          <select :value="profile.employee_range ?? 'unknown'" @change="applyCompanyEmployeeRange(($event.target as HTMLSelectElement).value as EmployeeRange)">
            <option v-for="item in employeeRangeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label>上年营收
          <select :value="profile.revenue_range ?? 'unknown'" @change="applyAmountRange('revenue_last_year', ($event.target as HTMLSelectElement).value as AmountRange)">
            <option v-for="item in amountRangeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label>上年利润
          <select :value="profile.profit_range ?? 'unknown'" @change="applyProfitRange(($event.target as HTMLSelectElement).value as ProfitRange)">
            <option v-for="item in profitRangeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label>上年纳税
          <select :value="profile.tax_paid_range ?? 'unknown'" @change="applyAmountRange('tax_paid_last_year', ($event.target as HTMLSelectElement).value as AmountRange)">
            <option v-for="item in amountRangeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label>研发投入
          <select :value="profile.rd_expense_range ?? 'unknown'" @change="applyAmountRange('rd_expense_last_year', ($event.target as HTMLSelectElement).value as AmountRange)">
            <option v-for="item in amountRangeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label>研发人员
          <select :value="profile.rd_employee_range ?? 'unknown'" @change="applyEmployeeRange(($event.target as HTMLSelectElement).value as EmployeeRange)">
            <option v-for="item in employeeRangeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label>项目预算
          <select :value="profile.project_budget_range ?? 'unknown'" @change="applyAmountRange('project_budget', ($event.target as HTMLSelectElement).value as AmountRange)">
            <option v-for="item in amountRangeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label>项目方向
          <select v-model="profile.project_direction">
            <option value="AI">AI</option>
            <option value="数据治理">数据治理</option>
            <option value="智能制造">智能制造</option>
            <option value="数字化转型">数字化转型</option>
          </select>
        </label>
        <label>项目阶段
          <select v-model="profile.project_stage">
            <option value="planning">规划中</option>
            <option value="researching">调研中</option>
            <option value="developing">研发中</option>
            <option value="launched">已落地</option>
            <option value="scaling">规模化推广</option>
          </select>
        </label>
        <label>高新技术企业
          <select v-model="profile.is_high_tech_enterprise">
            <option :value="true">是</option>
            <option :value="false">否/未知</option>
          </select>
        </label>
        <label>科技型中小企业
          <select v-model="profile.is_tech_sme">
            <option :value="true">是</option>
            <option :value="false">否/未知</option>
          </select>
        </label>
        <label>专精特新
          <select v-model="profile.has_specialized_new_sme">
            <option :value="true">是</option>
            <option :value="false">否/未知</option>
          </select>
        </label>
      </div>

      <details class="advanced-editor">
        <summary>高级编辑全部画像字段</summary>
        <div class="profile-grid">
          <label>企业名称<input v-model="profile.company_name" /></label>
          <label>统一社会信用代码<input v-model="profile.credit_code" /></label>
          <label>城市<input v-model="profile.city" readonly /></label>
          <label>区县<input v-model="profile.district" readonly /></label>
          <label>成立年份<input v-model.number="profile.registered_year" type="number" /></label>
          <label>上市状态
            <select v-model="profile.listed_status">
              <option value="unknown">未知</option>
              <option value="unlisted">未上市</option>
              <option value="listed">已上市</option>
              <option value="new_third_board">新三板</option>
              <option value="pre_listing">拟上市</option>
            </select>
          </label>
          <label>员工人数<input v-model.number="profile.employee_count" type="number" /></label>
          <label>注册资本（元）<input v-model.number="profile.registered_capital" type="number" /></label>
          <label>经营地址<input v-model="profile.business_address" /></label>
          <label>行业<input v-model="profile.industry" /></label>
          <label>主营业务<textarea v-model="profile.main_business" /></label>
          <label>产品标签<input :value="profile.main_products.join(',')" @input="setArrayField('main_products', ($event.target as HTMLInputElement).value)" /></label>

          <div class="field-block">
            <span>客户类型</span>
            <div class="checkbox-row">
              <label v-for="item in customerTypeOptions" :key="item.value">
                <input v-model="profile.customer_type" type="checkbox" :value="item.value" />
                {{ item.label }}
              </label>
            </div>
          </div>

          <label>业务模式
            <select v-model="profile.business_model">
              <option value="B2B">B2B</option>
              <option value="B2G">B2G</option>
              <option value="B2C">B2C</option>
              <option value="SaaS">SaaS</option>
              <option value="platform">平台</option>
              <option value="manufacturing">制造</option>
              <option value="service">服务</option>
              <option value="other">其他</option>
            </select>
          </label>

          <label>主要收入来源<input v-model="profile.main_revenue_source" /></label>
          <label>上年营收（元）<input v-model.number="profile.revenue_last_year" type="number" /></label>
          <label>上年利润（元）<input v-model.number="profile.profit_last_year" type="number" /></label>
          <label>上年纳税（元）<input v-model.number="profile.tax_paid_last_year" type="number" /></label>

          <label>研发投入（元）<input v-model.number="profile.rd_expense_last_year" type="number" /></label>
          <label>研发投入占比（%）<input v-model.number="profile.rd_expense_ratio" type="number" /></label>
          <label>研发人员数<input v-model.number="profile.rd_employee_count" type="number" /></label>
          <label>专利数量<input v-model.number="profile.patent_count" type="number" /></label>
          <label>软著数量<input v-model.number="profile.software_copyright_count" type="number" /></label>

          <label>税务信用等级
            <select v-model="profile.tax_credit_level">
              <option value="unknown">未知</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="M">M</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </label>
          <label>有无重大违法
            <select v-model="profile.has_major_violation">
              <option :value="false">无/未知</option>
              <option :value="true">有</option>
            </select>
          </label>
          <label>社保是否正常
            <select v-model="profile.social_security_normal">
              <option :value="true">正常/未知</option>
              <option :value="false">异常</option>
            </select>
          </label>

          <label>申报项目名称<input v-model="profile.apply_project_name" /></label>
          <label>项目方向<input v-model="profile.project_direction" /></label>
          <label>项目预算（元）<input v-model.number="profile.project_budget" type="number" /></label>
        </div>
      </details>
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>已保存画像</h2>
        <button class="outline-button" @click="loadProfiles"><Search :size="16" />刷新</button>
      </div>

      <div class="profile-list">
        <button v-for="item in appState.profiles" :key="item.id" @click="doMatch(item.id)">
          <span><strong>{{ item.company_name }}</strong><small>{{ item.credit_code }}</small></span>
          <PlayCircle :size="18" />
        </button>
      </div>
    </section>
  </section>
</template>
