/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f8faf6',
          100: '#eef2ea',
          200: '#dce5d5',
          300: '#c2d1b8',
          400: '#a1b894',
          500: '#4a5d4e',
          600: '#3d4f40',
          700: '#2f3f32',
          800: '#263128',
          900: '#1f2820',
        },
        cream: {
          DEFAULT: '#fafaf8',
          50: '#fefefe',
          100: '#fafaf8',
          200: '#f5f5f2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
}
