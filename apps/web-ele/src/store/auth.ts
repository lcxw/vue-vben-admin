import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { ElNotification } from 'element-plus';
import { defineStore } from 'pinia';

import { getAccessCodesApi, getUserInfoApi, logoutApi } from '#/api';
import { exchangeCodeForToken, takeRedirectPath } from '#/api/core/oauth';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * OAuth2 授权码回调：code 换 token，再拉取用户信息与权限码。
   *
   * @param code 授权码
   * @param state 授权服务器原样带回的 state，用于防 CSRF
   */
  async function authByOAuth2Code(code: string, state: string) {
    let userInfo = null;
    try {
      loginLoading.value = true;
      const token = await exchangeCodeForToken(code, state);

      accessStore.setAccessToken(token.access_token);
      if (token.refresh_token) {
        accessStore.setRefreshToken(token.refresh_token);
      }

      const [fetchUserInfoResult, accessCodes] = await Promise.all([
        fetchUserInfo(),
        getAccessCodesApi(),
      ]);

      userInfo = fetchUserInfoResult;
      userStore.setUserInfo(userInfo);
      accessStore.setAccessCodes(accessCodes);
      accessStore.setLoginExpired(false);

      const redirectPath =
        takeRedirectPath() ||
        userInfo.homePath ||
        preferences.app.defaultHomePath;
      await router.replace(redirectPath);

      if (userInfo?.realName) {
        ElNotification({
          message: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
          title: $t('authentication.loginSuccess'),
          type: 'success',
        });
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    }
    resetAllStores();
    accessStore.setLoginExpired(false);

    // 已经在登录页时不能再带 redirect：此时 currentRoute.fullPath 就是登录页本身，
    // 再编码一层会得到「登录页?redirect=编码后的登录页」，下一次又在这个基础上再包一层，
    // 反复登出会让 URL 逐跳变长，且没有上限。
    // On the login page the current route is the login page itself, so carrying it as
    // `redirect` would nest one more encoded layer on every repeat.
    const currentRoute = router.currentRoute.value;
    const alreadyOnLogin = currentRoute.path === LOGIN_PATH;

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query:
        redirect && !alreadyOnLogin
          ? { redirect: encodeURIComponent(currentRoute.fullPath) }
          : {},
    });
  }

  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authByOAuth2Code,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
