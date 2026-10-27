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
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.06)',
        'glass-hover': '0 14px 40px -4px rgba(0, 0, 0, 0.1)',
        'glow-brand': '0 0 25px -4px rgba(12, 147, 231, 0.35)',
        'glow-teal': '0 0 25px -4px rgba(13, 148, 136, 0.35)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
