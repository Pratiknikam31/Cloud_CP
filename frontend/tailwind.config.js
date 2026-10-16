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
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fc',
          400: '#36aff7',
          500: '#0c93e7',
          600: '#0275c5',
          700: '#035da1',
          800: '#074f85',
          900: '#0c426e',
          950: '#082a49',
        },
        medical: {
          teal: '#0d9488',
          cyan: '#0891b2',
          emerald: '#059669',
          rose: '#e11d48',
          amber: '#d97706',
          indigo: '#4f46e5',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
