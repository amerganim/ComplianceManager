/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // status palette — single source of truth mirrors src/lib/status.js
        valid: '#16a34a',
        expiring: '#d97706',
        expired: '#dc2626',
      },
      fontFamily: {
        // Bengali-friendly stack so Bangla labels render cleanly
        sans: ['system-ui', 'Segoe UI', 'Noto Sans Bengali', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
