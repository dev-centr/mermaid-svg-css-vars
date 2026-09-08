# mermaid-svg-css-vars

See **README.adoc** for the full documentation.

Mermaid adapter for responsive SVG normalization and the generator-neutral [Themed SVG](https://github.com/dev-centr/themed-svg) light/dark standard.

```bash
pnpm add @dev-centr/mermaid-svg-css-vars
```

The recommended CLI flow emits the portable adaptive image and runtime host
sibling together:

```bash
mermaid-svg-css-vars --manifest diagram.theme.json --mode dual diagram.raw.svg
mermaid-svg-css-vars --manifest diagram.theme.json --mode dual --check diagram.raw.svg
```

The first command writes `diagram.svg` (`standalone-adaptive`) and
`diagram.host.svg`; the check command exits nonzero when either committed
artifact is stale. Use `--mode paired-fixed` for concrete light/dark files. The
legacy `--theme-vars`, prefix, CSS-variable, and web-normalization flags remain
available as a separate compatibility route. See **README.adoc** for manifests,
palettes, output modes, and embedding-boundary details.
