import { createRouter, createWebHistory } from 'vue-router';
import { appState, loadCurrentUser, logout } from './state/app-state';
import LoginPage from './pages/LoginPage.vue';
import ProfilePage from './pages/ProfilePage.vue';
import ResultsPage from './pages/ResultsPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: () => (appState.token ? '/profile' : '/login') },
    { path: '/login', component: LoginPage },
    { path: '/profile', component: ProfilePage },
    { path: '/results', component: ResultsPage }
  ]
});

router.beforeEach(async (to) => {
  if (to.path !== '/login' && appState.token && !appState.user) {
    try {
      await loadCurrentUser();
    } catch {
      logout();
      return '/login';
    }
  }
  if (to.path !== '/login' && !appState.token) return '/login';
  if (to.path === '/login' && appState.token) return '/profile';
  return true;
});
