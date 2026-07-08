export const cssHexColorPattern = /^#[0-9a-f]{6}$/i;

export const isCssHexColor = (value: string): boolean =>
  cssHexColorPattern.test(value);

export const normalizeCssHexColor = (value: string): string =>
  value.toLowerCase();
