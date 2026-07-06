<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FileText, RefreshCcw } from 'lucide-vue-next';
import { appState, generateReport, loadLatestMatchRun } from '../state/app-state';
import { profileFieldLabel, replaceProfileFieldKeys } from '../utils/profile-field-labels';

const sortedResults = computed(() =>
  [...appState.matchResults].sort((a, b) => Number(b.final_score) - Number(a.final_score))
);

const reviewMode = computed(() => sortedResults.value[0]?.ai_mode ?? appState.aiStatus?.mode ?? 'mock');
const isInferredRun = computed(() =>
  appState.matchRun?.profile_verification_status === 'inferred' || appState.matchRun?.profile_source_type === 'inferred'
);
const isLoading = ref(false);
const isGeneratingReport = ref(false);
const errorText = ref('');

function levelLabel(level: string): string {
  const labels: Record<string, string> = {
    recommended: '优先推荐',
    potential: '可重点关注',
    need_more_info: '需补充信息',
    not_recommended: '暂不推荐'
  };
  return labels[level] ?? level;
}

function levelClass(level: string): string {
  return `level-${level.replaceAll('_', '-')}`;
}

function signedAdjustment(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function expectedValueLabel(value: unknown): string {
  if (Array.isArray(value)) return value.join('、');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '待确认');
}

onMounted(async () => {
  if (sortedResults.value.length > 0) return;
  isLoading.value = true;
  errorText.value = '';
  try {
    await loadLatestMatchRun();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载匹配结果失败';
  } finally {
    isLoading.value = false;
  }
});

async function doGenerateReport() {
  if (!appState.matchRun || isGeneratingReport.value) return;
  isGeneratingReport.value = true;
  errorText.value = '';
  try {
    await generateReport();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '生成报告失败';
  } finally {
    isGeneratingReport.value = false;
  }
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>匹配结果和报告</h1>
        <p>匹配先生成规则基线，再通过 {{ reviewMode === 'deepseek' ? 'DeepSeek API' : 'mock 开发模式' }} 做语义复核和说明增强。</p>
      </div>
      <button :disabled="!appState.matchRun || isGeneratingReport" @click="doGenerateReport">
        <FileText :size="16" />{{ isGeneratingReport ? '生成中' : '生成报告' }}
      </button>
    </div>

    <p v-if="errorText" class="error-text">{{ errorText }}</p>
    <div v-if="isInferredRun" class="warning-panel">
      本次匹配基于未验证 AI 画像草稿，最终等级已按试算处理。正式申报前请先核对企业名称、统一社会信用代码、经营地址和资质状态。
    </div>

    <section v-if="isLoading" class="panel empty-panel">
      <RefreshCcw :size="24" />
      <p>正在加载最近一次匹配结果...</p>
    </section>

    <section v-else-if="!sortedResults.length" class="panel empty-panel">
      <RefreshCcw :size="24" />
      <p>还没有匹配结果。请先到企业画像页保存画像并发起匹配。</p>
    </section>

    <section v-else class="result-list">
      <article v-for="item in sortedResults" :key="item.id" class="result-card">
        <div class="result-card-header">
          <div>
            <h2>{{ item.policy.title }}</h2>
            <p>{{ item.policy.category }}</p>
          </div>
          <div class="final-score">
            <span class="mode-pill" :class="levelClass(item.final_level)">{{ levelLabel(item.final_level) }}</span>
            <strong>{{ item.final_score }} 分</strong>
          </div>
        </div>

        <div class="result-stage-grid">
          <section class="result-stage">
            <div class="stage-title">
              <span>规则基线</span>
              <strong>{{ item.baseline_score }} 分</strong>
            </div>
            <p>系统按政策硬性条件和权重规则计算，初步判断为“{{ levelLabel(item.baseline_level) }}”。</p>
            <div class="condition-list">
              <strong>已满足</strong>
              <ul v-if="item.matched_conditions.length">
                <li v-for="condition in item.matched_conditions.slice(0, 4)" :key="`${item.id}-matched-${condition.field_key}`">
                  {{ condition.evidence_text }}（{{ condition.score }} 分）
                </li>
              </ul>
              <p v-else class="hint">暂无明确命中条件。</p>
            </div>
            <div class="condition-list">
              <strong>待补或不满足</strong>
              <ul v-if="item.missing_conditions.length">
                <li v-for="condition in item.missing_conditions.slice(0, 4)" :key="`${item.id}-missing-${condition.field_key}`">
                  {{ condition.evidence_text }}：需要 {{ expectedValueLabel(condition.expected_value) }}
                </li>
              </ul>
              <p v-else class="hint">没有关键缺口。</p>
            </div>
          </section>

          <section class="result-stage">
            <div class="stage-title">
              <span>DeepSeek 复核</span>
              <strong>{{ signedAdjustment(item.ai_adjustment) }} 分</strong>
            </div>
            <p>{{ item.ai_review_summary }}</p>
            <p>{{ item.ai_explanation }}</p>
            <div class="condition-list">
              <strong>建议补充的企业信息</strong>
              <ul v-if="item.ai_missing_fields.length">
                <li v-for="field in item.ai_missing_fields" :key="`${item.id}-ai-missing-${field}`">
                  {{ profileFieldLabel(field) }}
                </li>
              </ul>
              <p v-else class="hint">暂无建议补充的企业信息。</p>
            </div>
          </section>

          <section class="result-stage final-stage">
            <div class="stage-title">
              <span>最终</span>
              <strong>{{ levelLabel(item.final_level) }}</strong>
            </div>
            <p>综合规则基线和 DeepSeek 复核后，最终得分为 {{ item.final_score }} 分。</p>
            <div class="condition-list">
              <strong>建议动作</strong>
              <ul v-if="item.ai_suggested_actions.length">
                <li v-for="action in item.ai_suggested_actions" :key="`${item.id}-action-${action}`">{{ action }}</li>
              </ul>
              <p v-else class="hint">暂无额外建议。</p>
            </div>
            <div v-if="item.risk_notes.length || item.hard_failures.length" class="risk-box">
              <strong>风险提示</strong>
              <ul>
                <li v-for="risk in [...item.hard_failures, ...item.risk_notes]" :key="`${item.id}-risk-${risk}`">
                  {{ replaceProfileFieldKeys(risk) }}
                </li>
              </ul>
            </div>
          </section>
        </div>

        <a class="source-link" :href="item.policy.source_url" target="_blank" rel="noreferrer">查看政策原文</a>
      </article>
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>综合报告</h2>
        <span class="mode-pill">{{ appState.report?.model_name || (appState.aiStatus?.configured ? appState.aiStatus.model : 'mock') }}</span>
      </div>
      <pre v-if="appState.report">{{ appState.report.content_text }}</pre>
      <p v-else class="hint">生成报告后会显示在这里。</p>
    </section>
  </section>
</template>
