/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        bg: '#F8F9FB',
        surface: '#FFFFFF',
        border: '#E5E7EB',
        text: '#111827',
        muted: '#6B7280',
        subtle: '#9CA3AF',
        spanisch: '#E8472A',
        informatik: '#2563EB',
        sport: '#16A34A',
        klasse: '#9333EA',
      },
    },
  },
  plugins: [],
};
