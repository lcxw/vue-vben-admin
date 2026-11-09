import { defineConfig, viteCssLayerPlugin } from '@vben/vite-config';

import ElementPlus from 'unplugin-element-plus/vite';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      plugins: [
        // element-plus 的 css 包进 @layer el，使 Tailwind 工具类可覆盖组件样式
        viteCssLayerPlugin({ layerName: 'el', packageName: 'element-plus' }),
        ElementPlus({ format: 'esm' }),
      ],
      server: {
        // 顺序敏感：'/api/flow' 必须写在 '/api' 之前，否则会被通用规则吞掉，
        // 流程接口会被错误转发到 20005(system-server) 而返回 404。
        proxy: {
          '/api/flow': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // lunar-cloud workflow-server（流程配置 + Flowable 引擎）
            target: 'http://localhost:20007',
            ws: true,
          },
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // lunar-cloud system-server (OIDC) 直连
            target: 'http://localhost:20005',
            ws: true,
          },
        },
      },
    },
  };
});
