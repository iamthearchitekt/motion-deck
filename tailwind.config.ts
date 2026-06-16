/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // Replace the ENTIRE Tailwind color palette — nothing purple/blue can bleed in
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: '#000000',
      white: '#ffffff',
      'surface-0': '#000000',
      'surface-1': '#080808',
      'surface-2': '#101010',
      'surface-3': '#181818',
      'surface-4': '#222222',
      'border-subtle': '#1e1e1e',
      'border-default': '#2e2e2e',
      'text-primary': '#ffffff',
      'text-secondary': '#888888',
      'text-muted': '#444444',
      'accent': '#c9a251',
      'accent-hover': '#d8b468',
      'accent-dim': 'rgba(201,162,81,0.12)',
    },
    extend: {
      fontFamily: {
        sans: ['AirbnbCereal', 'Inter', 'system-ui', 'sans-serif'],
        display: ['AirbnbCereal', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'fade-up': 'fadeUp 0.5s ease forwards',
        'slide-in-right': 'slideInRight 0.3s ease forwards',
        'slide-in-left': 'slideInLeft 0.3s ease forwards',
        'scale-in': 'scaleIn 0.2s ease forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(201,162,81,0.2)',
        'card': '0 1px 3px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.5)',
        'modal': '0 8px 40px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)',
        'panel': '2px 0 12px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
