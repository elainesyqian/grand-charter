import { type MantineColorsTuple, createTheme } from '@mantine/core';

// Primary accent: deep navy. Shade 7 is the "filled" navy used for buttons.
const navy: MantineColorsTuple = [
  '#eef2f8',
  '#dbe3ef',
  '#b5c4dc',
  '#8ca3c8',
  '#6a86b6',
  '#4f6ea6',
  '#3a5a92',
  '#25436f',
  '#1c3557',
  '#132640',
];

// Secondary accent: army / olive green, for positive states (accepted, open cases).
const army: MantineColorsTuple = [
  '#f3f5ec',
  '#e5e9d6',
  '#cad3ac',
  '#adbb80',
  '#94a65b',
  '#829747',
  '#6c7f3a',
  '#566530',
  '#434f26',
  '#30391b',
];

// Warm neutral grays so the page doesn't feel clinical.
const stone: MantineColorsTuple = [
  '#f8f7f4',
  '#efede8',
  '#e2dfd8',
  '#cfcbc2',
  '#aaa59a',
  '#857f73',
  '#655f55',
  '#4a453e',
  '#2f2c27',
  '#1b1916',
];

export const SERIF = "'Source Serif 4 Variable', Georgia, 'Times New Roman', serif";
export const SANS = "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const theme = createTheme({
  colors: { navy, army, stone },
  primaryColor: 'navy',
  primaryShade: 7,
  black: '#1b1916',
  fontFamily: SANS,
  headings: {
    fontFamily: SERIF,
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '2rem', lineHeight: '1.25' },
      h2: { fontSize: '1.5rem', lineHeight: '1.3' },
      h3: { fontSize: '1.2rem', lineHeight: '1.35' },
      h4: { fontSize: '1.05rem', lineHeight: '1.4' },
    },
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { fw: 500 } },
    Paper: { defaultProps: { withBorder: true, radius: 'md' } },
    Card: { defaultProps: { withBorder: true, radius: 'md' } },
    Badge: {
      defaultProps: { radius: 'sm', variant: 'light' },
      styles: { root: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 } },
    },
    Modal: {
      defaultProps: {
        centered: true,
        radius: 'md',
        overlayProps: { backgroundOpacity: 0.35, blur: 2 },
      },
    },
    Tooltip: { defaultProps: { withArrow: true, openDelay: 200 } },
    TextInput: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md', checkIconPosition: 'right' } },
  },
});
