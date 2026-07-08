/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c7ff',
          400: '#85a3ff',
          500: '#5275ff',
          600: '#3b52f2',
          700: '#2e3ed9',
          800: '#2732b3',
          900: '#242e8f',
          950: '#161a54',
        }
      }
    },
  },
  plugins: [],
}