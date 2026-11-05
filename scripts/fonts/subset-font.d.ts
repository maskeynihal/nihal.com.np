declare module 'subset-font' {
  interface Options {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    preserveNameIds?: number[];
    variationAxes?: Record<
      string,
      number | { min: number; max: number; default?: number }
    >;
    noLayoutClosure?: boolean;
    keepAllGlyphs?: boolean;
  }
  export default function subsetFont(
    font: Uint8Array,
    text: string | undefined,
    options?: Options,
  ): Promise<Buffer>;
}
