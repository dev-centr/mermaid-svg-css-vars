import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { prepareMermaidSvgForWeb } from './prepare.js';
import {
  prepareThemedMermaidSvg,
  prepareThemedMermaidSvgDualOutput,
} from './themed.js';
import type {
  OutputMode,
  Palette,
  ThemedSvgManifest,
  TransformOptions,
} from './themed.js';
import type { ThemeVariables } from './types.js';

function printHelp(): void {
  process.stdout.write(`Usage: mermaid-svg-css-vars [options] <input.svg>

Post-process Mermaid SVG through a Themed SVG manifest, or use the legacy
themeVariables compatibility path.

Options:
  -o, --output <file>         Write result to file (default: stdout)
  --manifest <file>           Themed SVG version 1 explicit-binding manifest
  --mode <mode>               host (default), standalone-adaptive, fixed,
                              or paired-fixed
  --dual-output               Write adaptive and host outputs together
  --preset <name>             Manifest preset for fixed/host fallback
  --palette <file>            Shared runtime JSON palette
  --light-palette <file>      Runtime light-mode JSON palette
  --dark-palette <file>       Runtime dark-mode JSON palette
  --host-output <file>        dual host output path
  --light-output <file>       paired-fixed light output path
  --dark-output <file>        paired-fixed dark output path
  --check                     Verify dual outputs without rewriting them

Legacy compatibility options:
  --theme-vars <file>         Mermaid themeVariables JSON
  --prefix <prefix>           CSS var prefix (default: --mermaid-)
  --no-css-variables          Skip CSS variable rewrite
  --no-web-compatibility      Skip responsive SVG normalization
  --strip-background          Force background strip
  --no-strip-background       Keep backgrounds
  -h, --help                  Show help

Examples:
  mermaid-svg-css-vars --manifest diagram.theme.json diagram.svg -o diagram.themed.svg
  mermaid-svg-css-vars --manifest diagram.theme.json --dual-output diagram.raw.svg
  mermaid-svg-css-vars --manifest diagram.theme.json --dual-output --check diagram.raw.svg
  mermaid-svg-css-vars --manifest diagram.theme.json --mode paired-fixed diagram.svg
  mermaid-svg-css-vars --theme-vars theme.json --prefix --mermaid- diagram.svg
`);
}

function parseArgs(argv: string[]) {
  const args = {
    input: '' as string,
    output: '' as string,
    manifestPath: '' as string,
    mode: 'host' as string,
    preset: '' as string,
    palettePath: '' as string,
    lightPalettePath: '' as string,
    darkPalettePath: '' as string,
    dualOutput: false,
    hostOutput: '' as string,
    lightOutput: '' as string,
    darkOutput: '' as string,
    check: false,
    themeVarsPath: '' as string,
    prefix: '--mermaid-',
    cssVariables: undefined as boolean | undefined,
    webCompatibility: true,
    stripBackground: undefined as boolean | undefined,
    help: false,
    genericFlags: [] as string[],
    legacyFlags: [] as string[],
  };

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = (): string => {
      const next = argv[++i];
      if (!next || (next.startsWith('-') && a !== '--prefix')) {
        throw new Error(`${a} requires a value`);
      }
      return next;
    };
    switch (a) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-o':
      case '--output':
        args.output = value();
        break;
      case '--manifest':
        args.manifestPath = value();
        break;
      case '--mode':
        args.mode = value();
        args.genericFlags.push(a);
        break;
      case '--dual-output':
        args.dualOutput = true;
        args.genericFlags.push(a);
        break;
      case '--preset':
        args.preset = value();
        args.genericFlags.push(a);
        break;
      case '--palette':
        args.palettePath = value();
        args.genericFlags.push(a);
        break;
      case '--light-palette':
        args.lightPalettePath = value();
        args.genericFlags.push(a);
        break;
      case '--dark-palette':
        args.darkPalettePath = value();
        args.genericFlags.push(a);
        break;
      case '--host-output':
        args.hostOutput = value();
        args.genericFlags.push(a);
        break;
      case '--light-output':
        args.lightOutput = value();
        args.genericFlags.push(a);
        break;
      case '--dark-output':
        args.darkOutput = value();
        args.genericFlags.push(a);
        break;
      case '--check':
        args.check = true;
        args.genericFlags.push(a);
        break;
      case '--theme-vars':
        args.themeVarsPath = value();
        break;
      case '--prefix':
        args.prefix = value();
        args.legacyFlags.push(a);
        break;
      case '--no-css-variables':
        args.cssVariables = false;
        args.legacyFlags.push(a);
        break;
      case '--no-web-compatibility':
        args.webCompatibility = false;
        args.legacyFlags.push(a);
        break;
      case '--strip-background':
        args.stripBackground = true;
        args.legacyFlags.push(a);
        break;
      case '--no-strip-background':
        args.stripBackground = false;
        args.legacyFlags.push(a);
        break;
      default:
        if (a.startsWith('-')) {
          throw new Error(`Unknown option: ${a}`);
        }
        positional.push(a);
    }
  }

  if (!args.help && positional.length !== 1) {
    throw new Error('Exactly one input SVG must be supplied.');
  }
  args.input = positional[0] ?? '';
  return args;
}

function readPalette(path: string): Palette | undefined {
  return path
    ? (JSON.parse(readFileSync(path, 'utf8')) as Palette)
    : undefined;
}

function pairedName(input: string, variant: 'light' | 'dark'): string {
  const extension = extname(input);
  return join(
    dirname(input),
    `${basename(input, extension)}.${variant}${extension || '.svg'}`
  );
}

function deliveryName(input: string, host: boolean): string {
  const extension = extname(input);
  const stem = basename(input, extension).replace(/\.raw$/i, '');
  return join(dirname(input), `${stem}${host ? '.host' : ''}${extension || '.svg'}`);
}

function runManifestRoute(args: ReturnType<typeof parseArgs>): number {
  // Keep the 0.1.1 --mode dual spelling as a compatibility alias.
  if (args.mode === 'dual') args.dualOutput = true;
  const modes: Array<OutputMode | 'dual'> = [
    'fixed',
    'standalone-adaptive',
    'host',
    'paired-fixed',
    'dual',
  ];
  if (!modes.includes(args.mode as OutputMode)) {
    throw new Error(`Unknown mode: ${args.mode}`);
  }
  if (
    (args.mode !== 'paired-fixed' || args.dualOutput) &&
    (args.lightOutput || args.darkOutput)
  ) {
    throw new Error(
      '--light-output and --dark-output require --mode paired-fixed'
    );
  }
  if (!args.dualOutput && args.hostOutput) {
    throw new Error('--host-output requires --dual-output');
  }
  if (!args.dualOutput && args.check) {
    throw new Error('--check requires --dual-output');
  }
  if (args.dualOutput && args.mode !== 'host' && args.mode !== 'dual') {
    throw new Error('--dual-output cannot be combined with --mode');
  }

  const svg = readFileSync(args.input, 'utf8');
  const manifest = JSON.parse(
    readFileSync(args.manifestPath, 'utf8')
  ) as ThemedSvgManifest;
  const options: TransformOptions = {
    mode: args.mode === 'dual' ? 'host' : args.mode as OutputMode,
  };
  if (args.preset) options.preset = args.preset;
  const palette = readPalette(args.palettePath);
  const lightPalette = readPalette(args.lightPalettePath);
  const darkPalette = readPalette(args.darkPalettePath);
  if (palette) options.palette = palette;
  if (lightPalette) options.lightPalette = lightPalette;
  if (darkPalette) options.darkPalette = darkPalette;

  if (args.dualOutput) {
    const { mode: _mode, ...dualOptions } = options;
    const result = prepareThemedMermaidSvgDualOutput(
      svg,
      manifest,
      dualOptions
    );
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(
        `${diagnostic.output}: ${diagnostic.severity}: ${diagnostic.code}: ${diagnostic.message}\n`
      );
    }
    if (
      result.diagnostics.some(({ severity }) => severity === 'error') ||
      result.standaloneSvg === undefined ||
      result.hostSvg === undefined
    ) {
      return 2;
    }
    const adaptiveOutput = args.output || deliveryName(args.input, false);
    const hostOutput = args.hostOutput || deliveryName(args.input, true);
    if (resolve(adaptiveOutput) === resolve(hostOutput)) {
      throw new Error('dual output paths must be different');
    }
    if (args.check) {
      const stale = [
        [adaptiveOutput, result.standaloneSvg],
        [hostOutput, result.hostSvg],
      ].filter(([path, expected]) =>
        !existsSync(path!) || readFileSync(path!, 'utf8') !== expected
      );
      if (stale.length > 0) {
        for (const [path] of stale) process.stderr.write(`stale: ${path}\n`);
        return 3;
      }
    } else {
      writeFileSync(adaptiveOutput, result.standaloneSvg, 'utf8');
      writeFileSync(hostOutput, result.hostSvg, 'utf8');
    }
    return 0;
  }

  const result = prepareThemedMermaidSvg(svg, manifest, options);
  for (const diagnostic of result.diagnostics) {
    process.stderr.write(
      `${diagnostic.severity}: ${diagnostic.code}: ${diagnostic.message}\n`
    );
  }
  if (result.diagnostics.some(({ severity }) => severity === 'error')) {
    return 2;
  }

  if (args.mode === 'paired-fixed') {
    if (result.lightSvg === undefined || result.darkSvg === undefined) {
      throw new Error('paired-fixed transformation produced no paired output');
    }
    writeFileSync(
      args.lightOutput || pairedName(args.input, 'light'),
      result.lightSvg,
      'utf8'
    );
    writeFileSync(
      args.darkOutput || pairedName(args.input, 'dark'),
      result.darkSvg,
      'utf8'
    );
  } else {
    if (result.svg === undefined) {
      throw new Error('Themed SVG transformation produced no output');
    }
    if (args.output) {
      writeFileSync(args.output, result.svg, 'utf8');
    } else {
      process.stdout.write(result.svg);
    }
  }
  return 0;
}

export function runCli(argv = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.themeVarsPath && args.manifestPath) {
    throw new Error('--theme-vars and --manifest are mutually exclusive');
  }
  if (args.genericFlags.length > 0 && !args.manifestPath) {
    throw new Error(`${args.genericFlags[0]} requires --manifest`);
  }
  if (args.manifestPath && args.legacyFlags.length > 0) {
    throw new Error(`${args.legacyFlags[0]} cannot be used with --manifest`);
  }
  if (args.manifestPath) {
    return runManifestRoute(args);
  }

  const svg = readFileSync(args.input, 'utf8');
  let themeVariables: ThemeVariables | undefined;
  if (args.themeVarsPath) {
    themeVariables = JSON.parse(readFileSync(args.themeVarsPath, 'utf8')) as ThemeVariables;
  }

  const cssVariables =
    args.cssVariables === false ? false : themeVariables !== undefined;

  if (args.cssVariables !== false && !themeVariables) {
    process.stderr.write(
      'warning: no --theme-vars provided; skipping CSS variable rewrite (webCompatibility only)\n'
    );
  }

  const webCompatibility =
    args.webCompatibility === false
      ? false
      : {
          ...(args.stripBackground !== undefined
            ? { stripBackground: args.stripBackground }
            : {}),
        };

  const out = prepareMermaidSvgForWeb(svg, {
    themeVariables,
    cssVariables,
    webCompatibility,
    prefix: args.prefix,
  });

  if (args.output) {
    writeFileSync(args.output, out, 'utf8');
  } else {
    process.stdout.write(out);
  }
  return 0;
}
