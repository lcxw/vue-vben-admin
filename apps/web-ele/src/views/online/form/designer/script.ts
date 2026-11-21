import type { FormWidgetEvent } from '#/api/online/types';

export interface ScriptScope {
  /** 当前查询条件值对象（可直接读写） */
  form: Record<string, any>;
  /** 当前控件/树节点的值 */
  value?: any;
  /** 表格行、查询结果等上下文 */
  row?: any;
  params?: Record<string, any>;
  rows?: any[];
  total?: number;
  /** 修改某个条件值 */
  setValue: (field: string, value: any) => void;
  /** 立即重新查询 */
  reload: () => void;
  /** 切换表单级/控件级状态 */
  setState?: (patch: Record<string, any>) => void;
  /** 轻提示 */
  message: (
    text: string,
    type?: 'error' | 'info' | 'success' | 'warning',
  ) => void;
  /** 打开同页面表单 */
  openForm?: (role: string, id?: any) => void;
  console: Pick<Console, 'error' | 'info' | 'log' | 'warn'>;
  [key: string]: any;
}

/** 在受限作用域执行事件脚本；错误不会中断页面，统一打到控制台。 */
export function runScript(script: string | undefined, scope: ScriptScope): any {
  if (!script || !script.trim()) return undefined;
  try {
     
    const fn = new Function('ctx', `with (ctx) {\n${script}\n}`);
    return fn(scope);
  } catch (error) {
    console.warn('[online-form] 事件脚本执行失败:', error, script);
    return undefined;
  }
}

/** 执行 visible / disabled 这类返回布尔值的事件；无事件时返回缺省值。 */
export function evalEventFlag(
  events: FormWidgetEvent[] | undefined,
  eventType: string,
  scope: ScriptScope,
  fallback = true,
): boolean {
  const event = events?.find(
    (item) => item.eventType === eventType && item.enabled !== false,
  );
  if (!event?.script) return fallback;
  const result = runScript(event.script, scope);
  if (result === undefined) return fallback;
  return Boolean(result);
}

/** 找到并执行 change 类事件（多个同名只执行第一个）。 */
export function fireEvent(
  events: FormWidgetEvent[] | undefined,
  eventType: string,
  scope: ScriptScope,
): any {
  const event = events?.find(
    (item) => item.eventType === eventType && item.enabled !== false,
  );
  if (!event?.script) return undefined;
  return runScript(event.script, scope);
}

/** 样式配置 -> Vue style 对象 */
export function styleToObject(
  style: Record<string, any> | undefined,
): Record<string, any> {
  if (!style) return {};
  const out: Record<string, any> = {};
  const px = (v: any) => (typeof v === 'number' ? `${v}px` : v);
  if (style.width) out.width = px(style.width);
  if (style.margin) out.margin = style.margin;
  if (style.padding) out.padding = style.padding;
  if (style.background) out.background = style.background;
  if (style.borderRadius) out.borderRadius = px(style.borderRadius);
  if (style.border) out.border = style.border;
  if (style.color) out.color = style.color;
  if (style.fontSize) out.fontSize = px(style.fontSize);
  if (style.textAlign) out.textAlign = style.textAlign;
  if (typeof style.customStyle === 'string' && style.customStyle.trim()) {
    style.customStyle
      .split(';')
      .map((part: string) => part.trim())
      .filter(Boolean)
      .forEach((part: string) => {
        const idx = part.indexOf(':');
        if (idx > 0) {
          const name = part.slice(0, idx).trim();
          const value = part.slice(idx + 1).trim();
          const camel = name.replaceAll(/-([a-z])/g, (_, c) => c.toUpperCase());
          if (name && value) out[camel] = value;
        }
      });
  }
  return out;
}
