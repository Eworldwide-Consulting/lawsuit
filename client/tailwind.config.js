/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8edf8',
          100: '#c3d0ef',
          200: '#9db2e5',
          300: '#7794db',
          400: '#5177d1',
          500: '#1a3476',
          600: '#152c65',
          700: '#102454',
          800: '#0b1c43',
          900: '#0f2057',
          950: '#060e2d',
        },
        brand: {
          green: '#22c55e',
          'green-dark': '#16a34a',
          'green-light': '#86efac',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        form: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
