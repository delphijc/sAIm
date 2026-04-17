/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'slate': {
          '950': '#030712',
        },
        'green': {
          '400': '#4ade80',
          '500': '#22c55e',
        },
        'cyan': {
          '400': '#22d3ee',
          '500': '#06b6d4',
        },
        'purple': {
          '500': '#a855f7',
          '600': '#9333ea',
        },
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(74, 222, 128, 0.3)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
      }
    },
  },
  plugins: [],
}
