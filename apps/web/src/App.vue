<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { FileText, LogOut, ShieldCheck, UserRoundPen } from 'lucide-vue-next';
import { appState, loadAiStatus, logout } from './state/app-state';

const router = useRouter();
const aiLabel = computed(() =>
  appState.aiStatus?.configured ? `DeepSeek ${appState.aiStatus.model}` : 'DeepSeek key 未配置'
);

onMounted(async () => {
  await loadAiStatus();
  if (window.location.hash === '#match' || window.location.hash === '#report') {
    await router.replace('/results');
  }
  if (window.location.hash === '#lookup') {
    await router.replace('/profile');
  }
  if (window.location.hash === '#auth') {
    await router.replace('/login');
  }
});

function handleLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <main class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/profile">
        <ShieldCheck :size="28" />
        <div>
          <strong>龙华政策匹配</strong>
          <span>{{ aiLabel }}</span>
        </div>
      </RouterLink>

      <nav>
        <RouterLink to="/login">登录</RouterLink>
        <RouterLink to="/profile"><UserRoundPen :size="16" />企业画像</RouterLink>
        <RouterLink to="/results"><FileText :size="16" />匹配和报告</RouterLink>
      </nav>

      <button v-if="appState.token" class="ghost-button" @click="handleLogout">
        <LogOut :size="16" />退出
      </button>

      <p class="status">{{ appState.statusText || '等待操作' }}</p>
    </aside>

    <section class="workspace">
      <RouterView />
    </section>
  </main>
</template>
