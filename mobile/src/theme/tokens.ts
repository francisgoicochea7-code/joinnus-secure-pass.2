export type ThemeMode = 'dark' | 'light';

export type AppTheme = {
  mode: ThemeMode;
  bg: string;
  bg2: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textSoft: string;
  muted: string;
  brand: string;
  brand2: string;
  accent: string;
  paper: string;
  danger: string;
  ok: string;
  warn: string;
  info: string;
  shadow: string;
  gradient: [string, string, string];
  brandGradient: [string, string];
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  bg: '#08090d',
  bg2: '#0c0e13',
  surface: '#111318',
  surfaceRaised: '#171a23',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.20)',
  text: '#f4f2f8',
  textSoft: '#b7b3c3',
  muted: '#8b8798',
  brand: '#c6b2ff',
  brand2: '#a9f0cf',
  accent: '#3af2d2',
  paper: '#f4ede2',
  danger: '#f4697e',
  ok: '#4ecf94',
  warn: '#e8b34b',
  info: '#7fb1ff',
  shadow: '#000000',
  gradient: ['#08090d', '#11101a', '#08090d'],
  brandGradient: ['#c6b2ff', '#8e6fe0'],
};

export const lightTheme: AppTheme = {
  mode: 'light',
  bg: '#f4ede2',
  bg2: '#fff9f0',
  surface: '#fffdf9',
  surfaceRaised: '#ffffff',
  border: 'rgba(23,19,31,0.12)',
  borderStrong: 'rgba(23,19,31,0.24)',
  text: '#17131f',
  textSoft: '#514a5e',
  muted: '#776f84',
  brand: '#6d4bd6',
  brand2: '#0f8f78',
  accent: '#0b8f7a',
  paper: '#17131f',
  danger: '#d63d57',
  ok: '#148a5b',
  warn: '#a96c08',
  info: '#2563b8',
  shadow: '#392d48',
  gradient: ['#f4ede2', '#fff9f0', '#f4ede2'],
  brandGradient: ['#6d4bd6', '#0f8f78'],
};

export const themes = { dark: darkTheme, light: lightTheme };
export const fontFamily = 'Jakarta';
