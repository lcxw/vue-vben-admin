/**
 * 权限管理 API 汇总。
 *
 * 所有路径都是后端 Controller 的原始路径（vite 只剥离 /api 前缀，
 * 不做二次重写）；分页统一转换过 vxe-grid 的 items/total 协议。
 */
export * from './client';
export * from './department';
export * from './dict';
export * from './menu';
export * from './monitor';
export * from './organization';
export * from './permission';
export * from './post';
export * from './role';
export * from './types';
export * from './user';
