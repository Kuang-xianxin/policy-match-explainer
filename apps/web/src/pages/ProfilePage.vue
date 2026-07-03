<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { PlayCircle, PlusCircle, Save, Search } from 'lucide-vue-next';
import {
  appState,
  loadProfiles,
  runMatch,
  saveManualProfile,
  setArrayField,
  startManualProfile
} from '../state/app-state';

const router = useRouter();
const errorText = ref('');
const profile = computed(() => appState.draftProfile);

const customerTypeOptions = [
  { value: 'government', label: '政府客户' },
  { value: 'enterprise', label: '企业客户' },
  { value: 'individual', label: '个人客户' },
  { value: 'overseas', label: '海外客户' },
  { value: 'other', label: '其他' }
] as const;

onMounted(() => {
  if (!appState.draftProfile) startManualProfile();
});

async function doSaveManual() {
  errorText.value = '';
  try {
    await saveManualProfile();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '保存画像失败';
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
        <h1>企业画像输入</h1>
        <p>企业名称、信用代码和画像字段均由用户手动填写；DeepSeek 只用于后续政策匹配复核和报告生成。</p>
      </div>
      <button @click="startManualProfile"><PlusCircle :size="16" />新建空白画像</button>
    </div>

    <section v-if="profile" class="panel">
      <div class="section-title">
        <div>
          <h2>手动画像</h2>
          <p class="hint">当前版本不再使用企业名称自动补全或 AI 画像解耦，保存前请自行核对字段真实性。</p>
        </div>
        <button @click="doSaveManual"><Save :size="16" />保存当前画像</button>
      </div>

      <p v-if="errorText" class="error-text">{{ errorText }}</p>

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
            <option :value="false">无</option>
            <option :value="true">有</option>
          </select>
        </label>
        <label>社保是否正常
          <select v-model="profile.social_security_normal">
            <option :value="true">正常</option>
            <option :value="false">异常</option>
          </select>
        </label>

        <label>申报项目名称<input v-model="profile.apply_project_name" /></label>
        <label>项目方向<input v-model="profile.project_direction" /></label>
        <label>项目阶段
          <select v-model="profile.project_stage">
            <option value="planning">规划中</option>
            <option value="researching">调研中</option>
            <option value="developing">研发中</option>
            <option value="launched">已落地</option>
            <option value="scaling">规模化推广</option>
          </select>
        </label>
        <label>项目预算（元）<input v-model.number="profile.project_budget" type="number" /></label>
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
