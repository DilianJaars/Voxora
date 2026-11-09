import type { Config } from 'tailwindcss';
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        panel: '#14141c',
        panel2: '#1c1c28',
        line: '#2a2a3a',
        brand: { DEFAULT: '#8b5cf6', soft: '#a78bfa', glow: '#c4b5fd' },
        accent: '#22d3ee',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        dyslexic: ['"OpenDyslexic"', '"Comic Sans MS"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
