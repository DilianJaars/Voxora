import type { Config } from 'tailwindcss';
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: c('ink'), panel: c('panel'), panel2: c('panel2'), line: c('line'), fg: c('fg'), mute: c('mute'), mark: c('mark'), onmark: c('onmark'), danger: c('danger'), ok: c('ok') },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        read: ['Newsreader', 'Georgia', 'serif'],
        hyper: ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
        dyslexic: ['"OpenDyslexic"', '"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
