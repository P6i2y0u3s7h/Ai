/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lumora: {
          bg: '#000000',
          surface: '#0A0A0A',
          secondary: '#111111',
          card: '#141414',
          border: '#262626',
          borderSubtle: '#1F1F1F',
          text: '#FFFFFF',
          textSecondary: '#A1A1AA',
          muted: '#71717A',
          hover: '#1C1C1C',
          hoverLight: '#242424',
        },
        chat: {
          bg: '#000000',
          sidebar: '#0A0A0A',
          sidebarBorder: '#262626',
          composer: '#141414',
          composerHover: '#1C1C1C',
          hover: '#1C1C1C',
          hoverLight: '#222222',
          card: '#141414',
          bubble: '#181818',
          border: '#262626',
          borderSubtle: '#1F1F1F',
          text: '#FFFFFF',
          secondary: '#A1A1AA',
          muted: '#71717A',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      },
      maxWidth: {
        'conversation': '800px',
      }
    },
  },
  plugins: [],
}
