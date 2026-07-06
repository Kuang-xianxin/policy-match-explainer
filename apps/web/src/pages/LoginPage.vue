<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Eye, EyeOff, LogIn, Save, ShieldCheck } from 'lucide-vue-next';
import { appState, login, register } from '../state/app-state';
import { passwordInputType, passwordToggleLabel } from '../utils/password-visibility';

const router = useRouter();
const email = ref('demo@example.com');
const password = ref('secret123');
const displayName = ref('演示用户');
const errorText = ref('');
const isPasswordVisible = ref(false);
const passwordType = computed(() => passwordInputType(isPasswordVisible.value));
const passwordVisibilityLabel = computed(() => passwordToggleLabel(isPasswordVisible.value));

function togglePasswordVisibility() {
  isPasswordVisible.value = !isPasswordVisible.value;
}

async function submitLogin() {
  errorText.value = '';
  try {
    await login(email.value, password.value);
    await router.push('/profile');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '登录失败';
  }
}

async function submitRegister() {
  errorText.value = '';
  try {
    await register(email.value, password.value, displayName.value);
    await router.push('/profile');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '注册失败';
  }
}
</script>

<template>
  <section class="page login-page">
    <div class="page-heading">
      <ShieldCheck :size="30" />
      <div>
        <h1>登录</h1>
        <p>每个用户只能查看自己的企业画像、匹配结果和报告。</p>
      </div>
    </div>

    <div class="auth-panel">
      <label>邮箱<input v-model="email" autocomplete="email" /></label>
      <label>密码
        <div class="password-input-wrap">
          <input v-model="password" :type="passwordType" autocomplete="current-password" />
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
      <label>显示名<input v-model="displayName" /></label>

      <div class="button-row">
        <button @click="submitLogin"><LogIn :size="16" />登录</button>
        <button @click="submitRegister"><Save :size="16" />注册</button>
      </div>
      <p v-if="errorText" class="error-text">{{ errorText }}</p>
    </div>

    <div class="note-panel">
      <strong>DeepSeek 状态</strong>
      <span>{{ appState.aiStatus?.configured ? '已配置 API Key' : '未配置 API Key，当前使用 mock 开发模式' }}</span>
      <small>真实 key 请填入本地 `.env` 的 `DEEPSEEK_API_KEY=`，不要提交到仓库。</small>
    </div>
  </section>
</template>
