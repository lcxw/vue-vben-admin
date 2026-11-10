// bpmn-js 的画布样式与图标字体以 CSS 形式随包发布（dist/assets/**），
// 无 exports 映射，直接按子路径引入；这里补类型声明，避免 vue-tsc 报 TS2307。
declare module 'bpmn-js/dist/assets/*.css' {
  const sideEffect: undefined;
  export default sideEffect;
}

declare module 'bpmn-js/dist/assets/bpmn-font/css/*.css' {
  const sideEffect: undefined;
  export default sideEffect;
}
