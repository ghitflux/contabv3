import { heroui } from '@heroui/theme';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors can be added here
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: '#262624',
            default: {
              DEFAULT: '#262624',
            },
            primary: {
              50: '#fef9e7',
              100: '#fef3cf',
              200: '#fde79f',
              300: '#fcdb6f',
              400: '#fbcf3f',
              500: '#E9B63B',
              600: '#d4a335',
              700: '#bf902f',
              800: '#aa7d29',
              900: '#956a23',
              DEFAULT: '#E9B63B',
              foreground: '#1a1a1a',
            },
            focus: '#E9B63B',
          },
        },
        light: {
          colors: {
            primary: {
              50: '#fef9e7',
              100: '#fef3cf',
              200: '#fde79f',
              300: '#fcdb6f',
              400: '#fbcf3f',
              500: '#E9B63B',
              600: '#d4a335',
              700: '#bf902f',
              800: '#aa7d29',
              900: '#956a23',
              DEFAULT: '#E9B63B',
              foreground: '#1a1a1a',
            },
            focus: '#E9B63B',
          },
        },
      },
    }),
  ],
};

export default config;
