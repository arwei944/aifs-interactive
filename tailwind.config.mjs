/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        bg: '#f5f5f7',
        surface: '#ffffff',
        ink: '#1d1d1f',
        'ink-2': '#86868b',
        'ink-3': '#aeaeb2',
        blue: '#0071e3',
        'blue-hover': '#0077ED',
        green: '#34c759',
        amber: '#ff9f0a',
        red: '#ff3b30',
        purple: '#af52de',
        border: '#e5e5ea',
        'border-2': '#d2d2d7',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        'display': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '700' }],
        'title': ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        'body': ['0.9375rem', { lineHeight: '1.65' }],
        'caption': ['0.8125rem', { lineHeight: '1.5' }],
        'micro': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        'card': '12px',
        'chip': '20px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.04)',
        'md': '0 4px 12px rgba(0,0,0,0.06)',
        'lg': '0 8px 30px rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
