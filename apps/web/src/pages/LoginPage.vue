<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Eye, EyeOff, LogIn, Save, ShieldCheck } from 'lucide-vue-next';
import { appState, login, register } from '../state/app-state';
import { authAiStatusCopy, authModeMeta, type AuthMode } from '../utils/auth-page-copy';
import { passwordInputType, passwordToggleLabel } from '../utils/password-visibility';

const router = useRouter();
const email = ref('demo@example.com');
const password = ref('secret123');
const displayName = ref('演示用户');
const errorText = ref('');
const authMode = ref<AuthMode>('login');
const isPasswordVisible = ref(false);
const passwordType = computed(() => passwordInputType(isPasswordVisible.value));
const passwordVisibilityLabel = computed(() => passwordToggleLabel(isPasswordVisible.value));
const currentMode = computed(() => authModeMeta(authMode.value));
const aiStatusCopy = computed(() => authAiStatusCopy(appState.aiStatus));

function togglePasswordVisibility() {
  isPasswordVisible.value = !isPasswordVisible.value;
}

function setAuthMode(mode: AuthMode) {
  authMode.value = mode;
  errorText.value = '';
}

async function submitAuth() {
  errorText.value = '';
  try {
    if (authMode.value === 'register') {
      await register(email.value, password.value, displayName.value);
    } else {
      await login(email.value, password.value);
    }
    await router.push('/profile');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : `${currentMode.value.submitText}失败`;
  }
}
</script>

<template>
  <section class="page login-page">
    <div class="auth-hero">
      <ShieldCheck :size="34" />
      <div>
        <h1>龙华区惠企政策匹配</h1>
        <p>登录后可以保存企业画像、查看匹配结果，并生成面向申报准备的评估报告。</p>
      </div>
    </div>

    <form class="auth-panel" @submit.prevent="submitAuth">
      <div class="auth-panel-heading">
        <div>
          <h2>{{ currentMode.title }}</h2>
          <p>{{ authMode === 'login' ? '继续查看你的企业画像和政策匹配记录。' : '创建账号后，每个用户只会看到自己的企业数据。' }}</p>
        </div>
        <div class="auth-mode-switch" aria-label="登录注册切换">
          <button
            class="auth-mode-button"
            :class="{ 'auth-mode-button-active': authMode === 'login' }"
            type="button"
            @click="setAuthMode('login')"
          >
            登录
          </button>
          <button
            class="auth-mode-button"
            :class="{ 'auth-mode-button-active': authMode === 'register' }"
            type="button"
            @click="setAuthMode('register')"
          >
            注册
          </button>
        </div>
      </div>
      <label>邮箱<input v-model="email" autocomplete="email" /></label>
      <label>密码
        <div class="password-input-wrap">
          <input v-model="password" :type="passwordType" :autocomplete="currentMode.passwordAutocomplete" />
          <button
            class="password-toggle-button"
            type="button"
            :aria-label="passwordVisibilityLabel"
            :title="passwordVisibilityLabel"
            @click="togglePasswordVisibility"
          >
            <EyeOff v-if="isPasswordVisible" :size="18" />
            <Eye v-else :size="18" />
          </button>
        </div>
      </label>
      <label v-if="currentMode.showDisplayName">显示名<input v-model="displayName" autocomplete="name" /></label>

      <div class="button-row">
        <button class="auth-submit-button" type="submit">
          <Save v-if="authMode === 'register'" :size="16" />
          <LogIn v-else :size="16" />
          {{ currentMode.submitText }}
        </button>
      </div>
      <p v-if="errorText" class="error-text">{{ errorText }}</p>
    </form>

    <div class="auth-status-panel">
      <span class="mode-pill">AI 服务</span>
      <strong>{{ aiStatusCopy.status }}</strong>
      <p>{{ aiStatusCopy.description }}</p>
    </div>
  </section>
</template>
