/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8f7f4',
          100: '#efece3',
          200: '#ddd8c8',
          300: '#c5bda5',
          400: '#a89d7d',
          500: '#8a7d5e',
          600: '#6e6348',
          700: '#524a36',
          800: '#363124',
          900: '#1a1812',
        },
        gold: {
          50: '#fbf8f1',
          100: '#f5edd8',
          200: '#ebdbb0',
          300: '#dfc57e',
          400: '#c9a96e',
          500: '#b08d4e',
          600: '#8a6d3b',
          700: '#6e5730',
          800: '#4a3a20',
          900: '#251d10',
        },
        navy: {
          50: '#f4f6f7',
          100: '#e3e7eb',
          200: '#c8d0d8',
          300: '#a5b3c0',
          400: '#7d91a4',
          500: '#5e7389',
          600: '#485a6e',
          700: '#364452',
          800: '#242e38',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
