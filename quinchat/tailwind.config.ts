import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Agencia Quin brand: negro, dorado, blanco
        brand: {
          black: '#0A0A0A',
          gold: '#C9A84C',
          'gold-light': '#E8C96A',
          'gold-dark': '#A88A3A',
          white: '#F5F5F5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
