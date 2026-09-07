export type {
  CssVarRewriteOptions,
  PrepareMermaidSvgOptions,
  ThemeVariables,
  WebCompatibilityOptions,
} from './types.js';

export {
  buildColorBindings,
  colorKey,
  isColorishValue,
  normalizeHex,
  rewriteMermaidSvgCssVars,
} from './rewrite.js';
export type { ColorBinding } from './rewrite.js';

export { normalizeMermaidSvgForWeb } from './normalize.js';
export { prepareMermaidSvgForWeb } from './prepare.js';
export { prepareThemedMermaidSvg } from './themed.js';
export type {
  Diagnostic,
  OutputMode,
  Palette,
  SvgBinding,
  ThemedSvgManifest,
  TransformOptions,
  TransformResult,
} from './themed.js';
