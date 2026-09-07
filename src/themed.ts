import {
  transformSvg,
  type ThemedSvgManifest,
  type TransformOptions,
  type TransformResult,
} from '@dev-centr/themed-svg';

/**
 * Apply the generator-neutral Themed SVG contract to Mermaid-rendered SVG.
 *
 * Bindings in the manifest are explicit and structural. The legacy
 * rewriteMermaidSvgCssVars API remains available for color-equality migration
 * workflows.
 */
export function prepareThemedMermaidSvg(
  svg: string,
  manifest: ThemedSvgManifest,
  options: TransformOptions = {}
): TransformResult {
  return transformSvg(svg, manifest, options);
}

export type {
  Diagnostic,
  OutputMode,
  Palette,
  SvgBinding,
  ThemedSvgManifest,
  TransformOptions,
  TransformResult,
} from '@dev-centr/themed-svg';
