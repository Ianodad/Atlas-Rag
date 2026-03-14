import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          bg: '#0a0e17',
          surface: '#111827',
          elevated: '#1e293b',
          border: '#2d3748',
          text: '#f1f5f9',
          muted: '#94a3b8',
          disabled: '#64748b',
          accent: '#facc15',
          'accent-hover': '#fde047',
          'accent-dark': '#ca8a04',
          success: '#eab308',
          warn: '#ea580c',
          error: '#ef4444',
          purple: '#a78bfa',
          'purple-hover': '#c4b5fd',
          highlight: 'rgba(250,204,21,0.15)',
          'highlight-purple': 'rgba(167,139,250,0.12)',
          'highlight-success': 'rgba(234,179,8,0.1)',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
