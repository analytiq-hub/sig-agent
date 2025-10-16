export const isColorLight = (color: string): boolean => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Using relative luminance formula (0.299R + 0.587G + 0.114B)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
}; 