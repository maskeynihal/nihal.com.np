// svgo config for hand-written and generated SVG (D-01 poster, marks, favicon).
// Run via `pnpm exec svgo -c svgo.config.mjs <file>`; keeps viewBox, drops width/height.
export default {
  multipass: true,
  floatPrecision: 2,
  plugins: [
    {
      name: 'preset-default',
      params: { overrides: { removeViewBox: false } },
    },
    'removeDimensions',
  ],
};
