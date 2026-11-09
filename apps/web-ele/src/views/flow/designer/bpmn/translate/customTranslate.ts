/**
 * bpmn-js 自定义翻译工厂（源自橙单 WebAdmin，去掉其 @/types/generic 别名依赖
 * 与隐式 any，以适配 web-ele 的严格 TypeScript 检查）。
 */
type Translations = Record<string, string>;
type Replacements = Record<string, string>;

export function createCustomTranslate(translations: Translations) {
  return function customTranslate(
    template: string,
    replacements: Replacements = {},
  ): string {
    const translated = translations[template] ?? template;
    return translated.replace(
      /\{([^}]+)\}/g,
      (match: string, key: string): string => {
        const raw = replacements[key] ?? '';
        const value = translations[raw] ?? raw;
        return value || match;
      },
    );
  };
}

export default createCustomTranslate;
