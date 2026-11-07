import {
  appCopyrightPreferences,
  defineOverridesPreferences,
} from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    name: import.meta.env.VITE_APP_TITLE,
    // mixed：合并内置路由与后端菜单（getAllMenusApi → /menu/all）。
    // 后端菜单为空时仍可使用内置页面，避免登录后 404
    accessMode: 'mixed',
    // OAuth2 access_token 过期时用 refresh_token 续期（/oauth2/token）
    enableRefreshToken: true,
  },
  copyright: appCopyrightPreferences,
});
