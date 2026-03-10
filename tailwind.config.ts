import type { Config } from "tailwindcss"

const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/layouts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        brand: {
          // Verde vibrante do logo (cor principal)
          primary: '#22c55e', // green-500
          'primary-dark': '#16a34a', // green-600
          'primary-light': '#4ade80', // green-400
          'primary-lighter': '#86efac', // green-300
          // Preto para textos importantes (HIPER)
          dark: '#000000',
          // Verde claro para textos secundários (SUPERMERCADOS, Select)
          light: '#4ade80', // green-400
        },
      },
    },
  },
  plugins: [],
} satisfies Config

export default config

