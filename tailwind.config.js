/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'gf-electric': '#4cfa3e',
        'gf-lime': '#77bf43',
        'gf-dark-green': '#4d7820',
        'gf-grey': '#817f7f',
      },
    },
  },
  plugins: [],
};
