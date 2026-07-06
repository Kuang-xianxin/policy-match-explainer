<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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
import {
  lookupProgressSteps,
  matchProgressPercent,
  matchProgressSteps,
  operationEstimate,
  progressPercent,
  type LookupProgressPhase,
  type MatchProgressPhase,
  type OperationProgressKind
} from '../utils/match-progress';
import { profileFieldLabelsFor } from '../utils/profile-field-labels';

const router = useRouter();
const errorText = ref('');
const queryName = ref('');
const isSearching = ref(false);
const isGenerating = ref(false);
const generatingLookupId = ref<string | null>(null);
const isSaving = ref(false);
const isMatching = ref(false);
const isSmartMatching = ref(false);
const saveAndMatchStatusText = ref('');
const matchProgressPhase = ref<MatchProgressPhase>('saving_profile');
const matchProgressStartedAt = ref(0);
const matchProgressElapsedSeconds = ref(0);
const lookupProgressPhase = ref<LookupProgressPhase>('planning_query');
const lookupProgressKind = ref<OperationProgressKind>('candidate_search');
const lookupProgressMessage = ref('');
const lookupProgressStartedAt = ref(0);
const lookupProgressElapsedSeconds = ref(0);
const isLookupProgressVisible = ref(false);
let matchProgressTimer: number | undefined;
let lookupProgressTimer: number | undefined;
const profile = computed(() => appState.draftProfile);
const generatedProfileIsInferred = computed(() =>
  appState.generatedProfileMeta?.field_sources.some((item) => item.source_type === 'inferred') ?? false
);
const generatedMissingFieldLabels = computed(() =>
  profileFieldLabelsFor(appState.generatedProfileMeta?.missing_fields ?? [])
);
const showMatchProgress = computed(() => isMatching.value || (isSmartMatching.value && !isLookupProgressVisible.value));
const visibleMatchProgressSteps = computed(() => matchProgressSteps(matchProgressPhase.value));
const visibleLookupProgressSteps = computed(() => lookupProgressSteps(lookupProgressPhase.value));
const activeLookupEstimate = computed(() => operationEstimate(lookupProgressKind.value));
const activeMatchEstimate = computed(() => operationEstimate('policy_match'));
const lookupProgressPercentValue = computed(() =>
  progressPercent(lookupProgressElapsedSeconds.value, activeLookupEstimate.value.estimatedSeconds)
);
const matchProgressPercentValue = computed(() =>
  matchProgressPercent(matchProgressPhase.value, matchProgressElapsedSeconds.value)
);

function modeLabel(mode?: string): string {
  if (mode === 'deepseek') return 'DeepSeek';
  if (mode === 'doubao') return '豆包联网搜索';
  return 'mock';
}

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

onBeforeUnmount(() => {
  stopMatchProgressTimer();
  stopLookupProgressTimer();
});

function startMatchProgress(phase: MatchProgressPhase) {
  matchProgressPhase.value = phase;
  matchProgressStartedAt.value = Date.now();
  matchProgressElapsedSeconds.value = 0;
  stopMatchProgressTimer();
  matchProgressTimer = window.setInterval(() => {
    matchProgressElapsedSeconds.value = Math.max(0, Math.floor((Date.now() - matchProgressStartedAt.value) / 1000));
  }, 1000);
}

function startLookupProgress(kind: OperationProgressKind, message: string) {
  lookupProgressKind.value = kind;
  lookupProgressPhase.value = kind === 'profile_generation' ? 'candidate_filtering' : 'planning_query';
  lookupProgressMessage.value = message;
  lookupProgressStartedAt.value = Date.now();
  lookupProgressElapsedSeconds.value = 0;
  isLookupProgressVisible.value = true;
  stopLookupProgressTimer(false);
  lookupProgressTimer = window.setInterval(() => {
    const elapsed = Math.max(0, Math.floor((Date.now() - lookupProgressStartedAt.value) / 1000));
    lookupProgressElapsedSeconds.value = elapsed;
    if (lookupProgressKind.value === 'profile_generation') {
      lookupProgressPhase.value = 'candidate_filtering';
      return;
    }
    if (elapsed >= 18) {
      lookupProgressPhase.value = 'candidate_filtering';
    } else if (elapsed >= 3) {
      lookupProgressPhase.value = 'web_research';
    }
  }, 1000);
}

function updateLookupProgress(phase: LookupProgressPhase, message: string) {
  lookupProgressPhase.value = phase;
  lookupProgressMessage.value = message;
  appState.statusText = message;
}

function updateMatchProgress(phase: MatchProgressPhase, message: string) {
  matchProgressPhase.value = phase;
  saveAndMatchStatusText.value = message;
  appState.statusText = message;
}

function stopMatchProgressTimer() {
  if (matchProgressTimer === undefined) return;
  window.clearInterval(matchProgressTimer);
  matchProgressTimer = undefined;
}

function stopLookupProgressTimer(hide = true) {
  if (lookupProgressTimer !== undefined) {
    window.clearInterval(lookupProgressTimer);
    lookupProgressTimer = undefined;
  }
  if (hide) {
    isLookupProgressVisible.value = false;
  }
}

async function doSearch() {
  errorText.value = '';
  if (queryName.value.trim().length < 2) {
    errorText.value = '请输入至少 2 个字的企业名称或简称';
    return;
  }
  isSearching.value = true;
  startLookupProgress('candidate_search', '正在联网检索企业公开证据...');
  try {
    await searchCompany(queryName.value);
    updateLookupProgress('candidate_filtering', '候选企业核验完成。');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '企业候选查询失败';
  } finally {
    stopLookupProgressTimer();
    isSearching.value = false;
  }
}

async function doSmartMatch() {
  errorText.value = '';
  if (queryName.value.trim().length < 2) {
    errorText.value = '请输入至少 2 个字的企业名称或简称';
    return;
  }
  if (isSmartMatching.value) return;
  isSmartMatching.value = true;
  startLookupProgress('smart_match', '正在联网检索并核验候选企业...');
  saveAndMatchStatusText.value = '';
  try {
    await searchCompany(queryName.value);
    if (appState.scopeWarning) {
      throw new Error(appState.scopeWarning.message);
    }
    if (appState.candidates.length !== 1) {
      throw new Error('找到多个候选企业，请先选择正确企业后再生成画像。');
    }
    const [candidate] = appState.candidates;
    if (!candidate) {
      throw new Error('未找到可生成画像的候选企业。');
    }
    updateLookupProgress('candidate_filtering', '候选企业已核验，正在生成画像...');
    await generateProfileFromCandidate(candidate.lookup_id);
    stopLookupProgressTimer();
    startMatchProgress('saving_profile');
    updateMatchProgress('saving_profile', '画像已生成，正在保存并准备匹配...');
    const saved = await saveManualProfile();
    if (!saved) {
      throw new Error('画像保存失败，无法发起匹配。');
    }
    updateMatchProgress('ai_review', '正在匹配政策并进行 DeepSeek 复核...');
    await runMatch(saved.id);
    updateMatchProgress('opening_results', '匹配完成，正在打开结果页...');
    await router.push('/results');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '智能生成并匹配失败';
    saveAndMatchStatusText.value = '';
  } finally {
    stopLookupProgressTimer();
    stopMatchProgressTimer();
    isSmartMatching.value = false;
  }
}

async function doGenerate(lookupId: string) {
  errorText.value = '';
  if (isGenerating.value) return;
  isGenerating.value = true;
  generatingLookupId.value = lookupId;
  startLookupProgress('profile_generation', '正在生成企业画像，预计需要 20-40 秒...');
  try {
    updateLookupProgress('candidate_filtering', '正在根据候选企业证据生成企业画像...');
    await generateProfileFromCandidate(lookupId);
    updateLookupProgress('candidate_filtering', '企业画像已生成，请继续确认字段。');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '生成画像失败';
  } finally {
    stopLookupProgressTimer();
    generatingLookupId.value = null;
    isGenerating.value = false;
  }
}

async function doSaveManual() {
  errorText.value = '';
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await saveManualProfile();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '保存画像失败';
  } finally {
    isSaving.value = false;
  }
}

async function doSaveAndMatch() {
  errorText.value = '';
  saveAndMatchStatusText.value = '';
  if (isMatching.value) return;
  isMatching.value = true;
  startMatchProgress('saving_profile');
  try {
    updateMatchProgress('saving_profile', '正在保存企业画像...');
    const saved = await saveManualProfile();
    if (!saved) {
      saveAndMatchStatusText.value = '没有可保存的画像，请先生成或填写企业画像。';
      return;
    }
    updateMatchProgress('ai_review', '画像已保存，正在匹配政策并进行 DeepSeek 复核...');
    await runMatch(saved.id);
    updateMatchProgress('opening_results', '匹配完成，正在打开结果页...');
    await router.push('/results');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '保存并匹配失败';
    saveAndMatchStatusText.value = '';
  } finally {
    stopMatchProgressTimer();
    isMatching.value = false;
  }
}

async function doMatch(profileId: string) {
  errorText.value = '';
  if (isMatching.value) return;
  isMatching.value = true;
  startMatchProgress('ai_review');
  try {
    updateMatchProgress('ai_review', '正在匹配政策并进行 DeepSeek 复核...');
    await runMatch(profileId);
    updateMatchProgress('opening_results', '匹配完成，正在打开结果页...');
    await router.push('/results');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '匹配失败';
  } finally {
    stopMatchProgressTimer();
    isMatching.value = false;
  }
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>企业画像生成</h1>
        <p>输入企业名称或简称后，系统用豆包联网搜索公开证据生成候选和画像；无法核验的内部经营数据保留为未知，由用户确认后再匹配。</p>
      </div>
      <button class="outline-button" @click="startManualProfile"><PlusCircle :size="16" />空白手动编辑</button>
    </div>

    <section class="panel">
      <div class="section-title">
        <div>
          <h2>1. 搜索候选企业</h2>
          <p class="hint">优先使用豆包联网搜索获取官网、政府页面、公告和年报证据；只有核验为深圳市龙华区企业时才生成候选。</p>
        </div>
      </div>

      <div class="search-row">
        <label>企业名称或简称
          <input v-model="queryName" placeholder="例如：华傲数据、乐牙科技、汇川技术" @keyup.enter="doSearch" />
        </label>
        <div class="search-actions">
          <button :disabled="isSearching || isSmartMatching || isGenerating" @click="doSearch">
            <Search :size="16" />{{ isSearching ? `查询中 · ${operationEstimate('candidate_search').label}` : '查询候选' }}
          </button>
          <button :disabled="isSearching || isSmartMatching || isGenerating" @click="doSmartMatch">
            <PlayCircle :size="16" />{{ isSmartMatching ? `处理中 · ${operationEstimate('smart_match').label}` : '智能生成并匹配' }}
          </button>
        </div>
      </div>

      <div v-if="isLookupProgressVisible" class="inline-progress-panel" role="status" aria-live="polite">
        <div class="progress-summary">
          <strong>{{ lookupProgressMessage || '正在查询候选企业...' }}</strong>
          <span>{{ activeLookupEstimate.label }} · 已等待 {{ lookupProgressElapsedSeconds }} 秒</span>
        </div>
        <div class="operation-progress-bar" aria-hidden="true">
          <span :style="{ width: `${lookupProgressPercentValue}%` }"></span>
        </div>
        <ol class="match-progress-steps lookup-progress-steps">
          <li
            v-for="step in visibleLookupProgressSteps"
            :key="step.key"
            :class="`step-${step.status}`"
          >
            <span>{{ step.label }}</span>
            <small>{{ step.description }}</small>
          </li>
        </ol>
      </div>

      <p v-if="errorText" class="error-text">{{ errorText }}</p>
      <div v-if="appState.scopeWarning" class="warning-panel scope-warning-panel">
        <strong>未能生成可匹配企业画像</strong>
        <p>{{ appState.scopeWarning.message }}</p>
        <ul class="scope-warning-list">
          <li
            v-for="item in appState.scopeWarning.rejected_companies"
            :key="`${item.company_name}-${item.district ?? ''}-${item.business_address ?? ''}`"
          >
            <span>{{ item.company_name }}</span>
            <small v-if="item.district || item.business_address">
              {{ [item.district, item.business_address].filter(Boolean).join(' · ') }}
            </small>
            <small>{{ item.reason }}</small>
          </li>
        </ul>
      </div>
      <div v-if="showMatchProgress" class="match-progress-panel" role="status" aria-live="polite">
        <div class="progress-spinner" aria-hidden="true"></div>
        <div class="match-progress-content">
          <div class="match-progress-heading">
            <strong>{{ saveAndMatchStatusText || '正在匹配政策...' }}</strong>
            <span>{{ activeMatchEstimate.label }} · 已等待 {{ matchProgressElapsedSeconds }} 秒</span>
          </div>
          <div class="operation-progress-bar" aria-hidden="true">
            <span :style="{ width: `${matchProgressPercentValue}%` }"></span>
          </div>
          <ol class="match-progress-steps">
            <li
              v-for="step in visibleMatchProgressSteps"
              :key="step.key"
              :class="`step-${step.status}`"
            >
              <span>{{ step.label }}</span>
              <small>{{ step.description }}</small>
            </li>
          </ol>
        </div>
      </div>

      <div v-if="appState.lookupPlan" class="lookup-plan">
        <strong>AI 查询计划</strong>
        <span>模式：{{ modeLabel(appState.lookupPlan.ai_mode) }}</span>
        <span>标准查询：{{ appState.lookupPlan.normalized_query }}</span>
        <span>关键词：{{ appState.lookupPlan.search_keywords.join('、') }}</span>
        <span class="plan-explanation">说明：{{ appState.lookupPlan.explanation }}</span>
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
            <small v-if="item.source_type === 'inferred'" class="warning-text">未验证草稿，正式申报前必须核对企业主体信息</small>
            <small v-if="generatingLookupId === item.lookup_id" class="warning-text">
              正在生成画像 · {{ operationEstimate('profile_generation').label }}
            </small>
          </span>
          <WandSparkles :size="18" />
        </button>
      </div>

      <p v-else-if="appState.lookupPlan && !appState.scopeWarning" class="hint">没有找到可核验的龙华区候选企业。</p>
    </section>

    <section v-if="profile" class="panel">
      <div class="section-title">
        <div>
          <h2>2. 确认画像并补关键区间</h2>
          <p class="hint">公开字段自动带入；营收、研发、纳税、项目预算等非公开字段只选区间，也可以选未知。</p>
        </div>
        <div class="button-row">
          <button class="outline-button" :disabled="isSaving || isMatching" @click="doSaveManual">
            <Save :size="16" />{{ isSaving ? '保存中' : '保存画像' }}
          </button>
          <button :disabled="isSaving || isMatching" @click="doSaveAndMatch">
            <PlayCircle :size="16" />{{ isMatching ? `匹配中 · ${activeMatchEstimate.label}` : '保存并匹配' }}
          </button>
        </div>
      </div>

      <div v-if="appState.generatedProfileMeta" class="lookup-plan">
        <span>画像生成：{{ modeLabel(appState.generatedProfileMeta.ai_mode) }}</span>
        <span>置信度：{{ Math.round(appState.generatedProfileMeta.ai_confidence * 100) }}%</span>
        <span>待补字段：{{ generatedMissingFieldLabels.length ? generatedMissingFieldLabels.join('、') : '暂无' }}</span>
      </div>
      <p v-if="saveAndMatchStatusText && !showMatchProgress" class="hint">{{ saveAndMatchStatusText }}</p>
      <div v-if="generatedProfileIsInferred" class="warning-panel">
        当前画像来自未验证 AI 草稿。企业名称、统一社会信用代码、经营地址、成立年份和资质状态都需要人工确认后才能用于正式申报。
      </div>

      <div class="profile-form-section">
        <div class="form-section-header">
          <h3>必填字段</h3>
          <p>这些字段直接参与政策范围、行业方向和项目阶段判断。</p>
        </div>
        <div class="profile-grid">
          <label>企业名称<input v-model="profile.company_name" /></label>
          <label>统一社会信用代码<input v-model="profile.credit_code" /></label>
          <label>城市<input v-model="profile.city" readonly /></label>
          <label>区县<input v-model="profile.district" readonly /></label>
          <label>成立年份<input v-model.number="profile.registered_year" type="number" /></label>
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
              <option value="other">其他/未知</option>
            </select>
          </label>
          <label>主要收入来源<input v-model="profile.main_revenue_source" /></label>
          <label>申报项目名称<input v-model="profile.apply_project_name" /></label>
          <label>项目方向
            <select v-model="profile.project_direction">
              <option value="待确认">待确认</option>
              <option value="AI">AI</option>
              <option value="数据治理">数据治理</option>
              <option value="智能制造">智能制造</option>
              <option value="数字化转型">数字化转型</option>
              <option value="产业链协同">产业链协同</option>
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
        </div>
      </div>

      <div class="profile-form-section">
        <div class="form-section-header">
          <h3>关键区间和资质</h3>
          <p>非公开经营数据用区间表达，无法确认时保留未知。</p>
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
          <label>上市状态
            <select v-model="profile.listed_status">
              <option value="unknown">未知</option>
              <option value="unlisted">未上市</option>
              <option value="listed">已上市</option>
              <option value="new_third_board">新三板</option>
              <option value="pre_listing">拟上市</option>
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
          <label>规上企业
            <select v-model="profile.is_above_scale_enterprise">
              <option :value="true">是</option>
              <option :value="false">否/未知</option>
            </select>
          </label>
        </div>
      </div>

      <div class="profile-form-section">
        <div class="form-section-header">
          <h3>选填字段</h3>
          <p>用于提高解释质量和报告可读性，不确定时可以留空。</p>
        </div>
        <div class="profile-grid">
          <label>法定代表人<input v-model="profile.legal_representative" /></label>
          <label>成立日期<input v-model="profile.establishment_date" placeholder="YYYY-MM-DD" /></label>
          <label>登记状态<input v-model="profile.registration_status" /></label>
          <label>注册资本（元）<input v-model.number="profile.registered_capital" type="number" /></label>
          <label>经营地址<input v-model="profile.business_address" /></label>
          <label>总部企业
            <select v-model="profile.is_headquarters">
              <option :value="true">是</option>
              <option :value="false">否/未知</option>
            </select>
          </label>
          <label>数字化转型状态<input v-model="profile.digital_transformation_status" /></label>
          <label>奖项荣誉<input :value="(profile.award_titles ?? []).join(',')" @input="setArrayField('award_titles', ($event.target as HTMLInputElement).value)" /></label>
          <label>在研/建设项目<input :value="(profile.known_projects ?? []).join(',')" @input="setArrayField('known_projects', ($event.target as HTMLInputElement).value)" /></label>
          <label>已投产/落地项目<input :value="(profile.production_projects ?? []).join(',')" @input="setArrayField('production_projects', ($event.target as HTMLInputElement).value)" /></label>
          <label>员工人数<input v-model.number="profile.employee_count" type="number" /></label>
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
          <label>项目预算（元）<input v-model.number="profile.project_budget" type="number" /></label>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>已保存画像</h2>
        <button class="outline-button" :disabled="appState.isLoadingProfiles" @click="loadProfiles">
          <Search :size="16" />{{ appState.isLoadingProfiles ? '刷新中' : '刷新' }}
        </button>
      </div>

      <div class="profile-list">
        <button v-for="item in appState.profiles" :key="item.id" :disabled="isMatching" @click="doMatch(item.id)">
          <span>
            <strong>{{ item.company_name }}</strong>
            <small>{{ item.credit_code }}</small>
            <small v-if="item.verification_status === 'inferred'" class="warning-text">未验证草稿</small>
          </span>
          <PlayCircle :size="18" />
        </button>
      </div>
      <p v-if="!appState.isLoadingProfiles && appState.profiles.length === 0" class="hint">暂无已保存画像。</p>
    </section>
  </section>
</template>
