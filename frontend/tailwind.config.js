/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'green-dark': '#2D6A4F',
        'orange-dark': '#D4660A',
        'cream-dark': '#E8D5B7',
      },
    },
  },
  plugins: [],
};
