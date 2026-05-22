import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FF6200',
          'orange-glow': '#FF8C42',
          'orange-dark': '#CC4E00',
          blue: '#0A1628',
          'blue-mid': '#0D1F3C',
          'blue-light': '#1A3A5C',
          'blue-accent': '#1E90FF',
          red: '#FF1744',
          'red-glow': '#FF5252',
          green: '#00E676',
          'green-glow': '#69F0AE',
          gold: '#FFD600',
        },
        surface: {
          DEFAULT: '#0D1F3C',
          elevated: '#132847',
          overlay: '#1A3A5C',
        },
      },
      fontFamily: {
        display: ['Rajdhani', 'Impact', 'sans-serif'],
        body: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-red': 'pulseRed 1.5s ease-in-out infinite',
        'pulse-orange': 'pulseOrange 2s ease-in-out infinite',
        'siren': 'sirenFlash 0.5s alternate infinite',
        'float': 'floatY 3s ease-in-out infinite',
        'float-slow': 'floatY 5s ease-in-out infinite',
        'road-scroll': 'roadScroll 8s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        'counter-up': 'counterUp 1s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        'typing': 'typingDots 1.4s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s linear infinite',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 23, 68, 0.7)' },
          '50%': { boxShadow: '0 0 0 20px rgba(255, 23, 68, 0)' },
        },
        pulseOrange: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 98, 0, 0.6)' },
          '50%': { boxShadow: '0 0 0 15px rgba(255, 98, 0, 0)' },
        },
        sirenFlash: {
          '0%': { backgroundColor: 'rgba(255, 23, 68, 0.15)' },
          '100%': { backgroundColor: 'rgba(30, 144, 255, 0.15)' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        roadScroll: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 200px' },
        },
        counterUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(30px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-30px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.15)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.1)' },
          '70%': { transform: 'scale(1)' },
        },
        typingDots: {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.3' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { filter: 'drop-shadow(0 0 8px rgba(255, 98, 0, 0.8))' },
          '50%': { filter: 'drop-shadow(0 0 20px rgba(255, 98, 0, 1))' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(200%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-orange': '0 0 30px rgba(255, 98, 0, 0.5)',
        'glow-red': '0 0 30px rgba(255, 23, 68, 0.6)',
        'glow-blue': '0 0 30px rgba(30, 144, 255, 0.5)',
        'inner-glow': 'inset 0 0 30px rgba(255, 98, 0, 0.1)',
        'card': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
export default config
