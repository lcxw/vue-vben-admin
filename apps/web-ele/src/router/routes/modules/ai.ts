import type { RouteRecordRaw } from 'vue-router';

/**
 * AI 应用内置路由（mixed 模式）。
 * 后端菜单种子：backend/.../system-server/src/main/resources/sql/V29__ai_application_menu.sql
 * 菜单 name 必须与这里的 name 一致，component 形如 '/ai/xxx/index.vue'。
 */
const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:sparkles',
      order: 47,
      title: 'AI 应用',
    },
    name: 'AI',
    path: '/ai',
    children: [
      {
        meta: { icon: 'lucide:message-circle', title: 'AI 聊天' },
        name: 'AiChat',
        path: 'chat',
        component: () => import('#/views/ai/chat/index.vue'),
      },
      {
        meta: { icon: 'lucide:brain', title: '模型配置' },
        name: 'AiModel',
        path: 'model',
        component: () => import('#/views/ai/model/index.vue'),
      },
      {
        meta: { icon: 'lucide:plug', title: 'MCP 配置' },
        name: 'AiMcp',
        path: 'mcp',
        component: () => import('#/views/ai/mcp/index.vue'),
      },
      {
        meta: { icon: 'lucide:book-open', title: '技能配置' },
        name: 'AiSkill',
        path: 'skill',
        component: () => import('#/views/ai/skill/index.vue'),
      },
      {
        meta: { icon: 'lucide:file-text', title: '提示词管理' },
        name: 'AiPrompt',
        path: 'prompt',
        component: () => import('#/views/ai/prompt/index.vue'),
      },
      {
        meta: { icon: 'lucide:user-cog', title: '专家配置' },
        name: 'AiExpert',
        path: 'expert',
        component: () => import('#/views/ai/expert/index.vue'),
      },
    ],
  },
];

export default routes;
