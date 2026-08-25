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
        // Agencia Quin — Manual de Marca 2026
        brand: {
          teal:         '#00A89D',  // Teal Corporativo — color principal
          'teal-light': '#4ECDC4',  // Teal claro — hovers, fondos
          'teal-dark':  '#007A72',  // Teal oscuro — activo profundo
          black:        '#0D0D0D',  // Negro Marca — textos y elementos
          ivory:        '#FAF9F6',  // Blanco marfil — fondo principal
          'gray-mid':   '#6B6B6B',  // Gris medio — textos secundarios
          'gray-light': '#F5F5F5',  // Gris claro — fondos neutros
          border:       '#E8E8E8',  // Borde estándar
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
