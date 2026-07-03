<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { PlayCircle, Save, Search } from 'lucide-vue-next';
import {
  appState,
  extractProfile,
  importProfile,
  loadProfiles,
  runMatch,
  saveManualProfile,
  searchCompany,
  setArrayField,
  useDemoProfile
} from '../state/app-state';

const router = useRouter();
const queryName = ref('龙华智造');
const errorText = ref('');
const profile = computed(() => appState.draftProfile);

function formatConfidence(value?: number): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

async function doSearch() {
  errorText.value = '';
  try {
    await searchCompany(queryName.value);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '查询失败';
  }
}

async function doExtract(lookupId: string) {
  errorText.value = '';
  try {
    await extractProfile(lookupId);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '画像解耦失败';
  }
}

async function doImport() {
  await importProfile();
}

async function doSaveManual() {
  await saveManualProfile();
}

async function doMatch(profileId: string) {
  await runMatch(profileId);
  await router.push('/results');
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>企业画像输入</h1>
        <p>先用企业名称生成草稿，也可以手动填写演示画像后保存。</p>
      </div>
      <button @click="useDemoProfile"><Save :size="16" />填入演示画像</button>
    </div>

    <section class="panel">
      <h2>企业名称自动补全</h2>
      <div class="lookup-bar">
        <input v-model="queryName" placeholder="企业名称" />
        <button @click="doSearch"><Search :size="16" />查询企业</button>
      </div>
      <p class="hint">AI 解耦状态：{{ appState.aiStatus?.configured ? 'DeepSeek API' : 'mock 开发模式' }}</p>
      <p v-if="errorText" class="error-text">{{ errorText }}</p>

      <div v-if="appState.lookupPlan" class="lookup-plan">
        <div>
          <strong>查询计划</strong>
          <span>{{ appState.lookupPlan.ai_mode === 'deepseek' ? 'DeepSeek' : 'Mock' }}</span>
        </div>
        <p>{{ appState.lookupPlan.explanation }}</p>
        <small>关键词：{{ appState.lookupPlan.search_keywords.join(' / ') }}</small>
      </div>

      <p v-if="appState.lookupPlan && !appState.candidates.length" class="empty-text">
        当前数据源没有命中候选企业。真实上线时应接入官方开放数据或商业企业库，DeepSeek 只负责查询规划和字段解耦。
      </p>

      <div v-if="appState.candidates.length" class="candidate-list">
        <button v-for="item in appState.candidates" :key="item.lookup_id" @click="doExtract(item.lookup_id)">
          <span>{{ item.company_name }}</span>
          <small>{{ item.source_name }} · {{ item.source_type }} · {{ formatConfidence(item.confidence) }}</small>
          <small>{{ item.credit_code }} · {{ item.registration_status }} · {{ item.business_address }}</small>
        </button>
      </div>
    </section>

    <section v-if="profile" class="panel">
      <div class="section-title">
        <h2>画像草稿</h2>
        <div class="button-row">
          <button v-if="appState.lookup" @click="doImport"><Save :size="16" />确认自动画像</button>
          <button @click="doSaveManual"><Save :size="16" />保存当前画像</button>
        </div>
      </div>

      <div class="profile-grid">
        <label>企业名称<input v-model="profile.company_name" /></label>
        <label>信用代码<input v-model="profile.credit_code" /></label>
        <label>行业<input v-model="profile.industry" /></label>
        <label>成立年份<input v-model.number="profile.registered_year" type="number" /></label>
        <label>员工人数<input v-model.number="profile.employee_count" type="number" /></label>
        <label>主营业务<textarea v-model="profile.main_business" /></label>
        <label>产品标签<input :value="profile.main_products.join(',')" @input="setArrayField('main_products', ($event.target as HTMLInputElement).value)" /></label>
        <label>客户类型<input :value="profile.customer_type.join(',')" @input="setArrayField('customer_type', ($event.target as HTMLInputElement).value)" /></label>
        <label>业务模式
          <select v-model="profile.business_model">
            <option>B2B</option>
            <option>B2G</option>
            <option>B2C</option>
            <option>SaaS</option>
            <option>platform</option>
            <option>manufacturing</option>
            <option>service</option>
            <option>other</option>
          </select>
        </label>
        <label>上年营收<input v-model.number="profile.revenue_last_year" type="number" /></label>
        <label>上年纳税<input v-model.number="profile.tax_paid_last_year" type="number" /></label>
        <label>研发投入占比<input v-model.number="profile.rd_expense_ratio" type="number" /></label>
        <label>项目方向<input v-model="profile.project_direction" /></label>
        <label>项目预算<input v-model.number="profile.project_budget" type="number" /></label>
        <label>高新技术企业<select v-model="profile.is_high_tech_enterprise"><option :value="true">是</option><option :value="false">否</option></select></label>
        <label>科技型中小企业<select v-model="profile.is_tech_sme"><option :value="true">是</option><option :value="false">否</option></select></label>
        <label>专精特新<select v-model="profile.has_specialized_new_sme"><option :value="true">是</option><option :value="false">否</option></select></label>
      </div>
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>已保存画像</h2>
        <button @click="loadProfiles"><Search :size="16" />刷新</button>
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
