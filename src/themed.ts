import {
  transformSvg,
  type Diagnostic,
  type ThemedSvgManifest,
  type TransformOptions,
  type TransformResult,
} from '@dev-centr/themed-svg';

export type DualOutputKind = 'standalone-adaptive' | 'host';

export interface DualOutputDiagnostic extends Diagnostic {
  output: DualOutputKind;
}

export type DualOutputOptions = Omit<TransformOptions, 'mode'>;

export interface DualOutputResult {
  standaloneSvg?: string;
  hostSvg?: string;
  diagnostics: DualOutputDiagnostic[];
}

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

/**
 * Produce the portable fallback and progressively enhanced host artifact
 * together. Outputs are withheld unless both transformations succeed.
 */
export function prepareThemedMermaidSvgDualOutput(
  svg: string,
  manifest: ThemedSvgManifest,
  options: DualOutputOptions = {}
): DualOutputResult {
  const standalone = transformSvg(svg, manifest, {
    ...options,
    mode: 'standalone-adaptive',
  });
  const host = transformSvg(svg, manifest, { ...options, mode: 'host' });
  const diagnostics = [
    ...standalone.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      output: 'standalone-adaptive' as const,
    })),
    ...host.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      output: 'host' as const,
    })),
  ];
  const failed =
    diagnostics.some(({ severity }) => severity === 'error') ||
    standalone.svg === undefined ||
    host.svg === undefined;

  return failed
    ? { diagnostics }
    : {
        standaloneSvg: standalone.svg,
        hostSvg: host.svg,
        diagnostics,
      };
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
