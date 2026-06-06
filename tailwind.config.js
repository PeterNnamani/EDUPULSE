/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          bg: '#FFFFFF',
          text: '#111827',
        },
        secondary: {
          bg: '#F5F5F5',
          text: '#6B7280',
        },
        dark: {
          bg: '#111318',
          card: '#1a1f28',
          elevated: '#232a35',
          border: '#2d3548',
          text: '#e8ecf1',
          muted: '#9aa3b2',
          subtle: '#6b7585',
          icon: '#a8b0be',
        },
        'darker-bg': '#0d1017',
        border: '#E5E7EB',
        card: '#FFFFFF',
        functional: {
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#DC2626',
          info: '#2563EB',
        },
        risk: {
          high: '#EF4444',
          medium: '#F59E0B',
          low: '#22C55E',
        },
        behaviour: {
          positive: '#16A34A',
          negative: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'dark-card': '0 1px 3px rgba(0, 0, 0, 0.35), 0 4px 16px rgba(0, 0, 0, 0.2)',
        'dark-elevated': '0 8px 24px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
}
