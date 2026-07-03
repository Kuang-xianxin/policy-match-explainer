<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FileText, RefreshCcw } from 'lucide-vue-next';
import { appState, generateReport, loadLatestMatchRun } from '../state/app-state';

const sortedResults = computed(() =>
  [...appState.matchResults].sort((a, b) => Number(b.final_score) - Number(a.final_score))
);

const reviewMode = computed(() => sortedResults.value[0]?.ai_mode ?? appState.aiStatus?.mode ?? 'mock');
const isLoading = ref(false);
const isGeneratingReport = ref(false);
const errorText = ref('');

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

    <section v-if="isLoading" class="panel empty-panel">
      <RefreshCcw :size="24" />
      <p>正在加载最近一次匹配结果...</p>
    </section>

    <section v-else-if="!sortedResults.length" class="panel empty-panel">
      <RefreshCcw :size="24" />
      <p>还没有匹配结果。请先到企业画像页保存画像并发起匹配。</p>
    </section>

    <section v-else class="panel">
      <div class="result-head">
        <span>政策</span>
        <span>规则基线</span>
        <span>DeepSeek 复核</span>
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
        <p><strong>复核摘要：</strong>{{ item.ai_review_summary }}</p>
        <p><strong>解释：</strong>{{ item.ai_explanation }}</p>
        <p><strong>建议动作：</strong>{{ item.ai_suggested_actions.join('；') }}</p>
      </div>
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
