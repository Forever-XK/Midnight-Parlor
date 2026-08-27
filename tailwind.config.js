/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 午夜雅集主题色板（深色模式默认）
        ink: {
          900: '#0a0f1a',
          800: '#0d1b2a',
          700: '#13293d',
          600: '#1a3a5c',
        },
        felt: {
          900: '#063326',
          800: '#0a4d3a',
          700: '#0f6048',
          600: '#1a7a5a',
        },
        gold: {
          300: '#f0d97a',
          400: '#e6c54e',
          500: '#d4af37',
          600: '#b8941f',
        },
        vermilion: {
          400: '#e63946',
          500: '#c8102e',
          600: '#a00d24',
        },
        ivory: '#f8f4e8',
      },
      fontFamily: {
        display: ['"ZCOOL KuaiLe"', '"Noto Sans SC"', 'sans-serif'],
        body: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        jpq: ['"JPQ"', '"Noto Sans SC"', 'sans-serif'],
        main: ['"Main"', '"Noto Sans SC"', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.2)',
        'card-hover': '0 8px 20px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.3)',
        'card-light': '0 1px 3px rgba(0,0,0,0.13), 0 1px 2px rgba(0,0,0,0.08)',
        'card-light-hover': '0 6px 16px rgba(0,0,0,0.16), 0 2px 4px rgba(0,0,0,0.08)',
        'gold-glow': '0 0 20px rgba(212,175,55,0.4), 0 0 8px rgba(212,175,55,0.6)',
        'inner-felt': 'inset 0 4px 20px rgba(0,0,0,0.5)',
      },
      animation: {
        'breathe': 'breathe 2.4s ease-in-out infinite',
        'float-up': 'float-up 0.4s ease-out',
        'shimmer': 'shimmer 3s linear infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(212,175,55,0)' },
        },
        'float-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('light', '.light &');
    },
  ],
};
