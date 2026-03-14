/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#f0f5fa', 100: '#dce8f2', 200: '#b8d1e6', 300: '#8ab4d4', 400: '#5c96c2', 500: '#3a7ab5', 600: '#2a6299', 700: '#1B3A5C', 800: '#152e49', 900: '#0f2236' },
        accent: { 500: '#006B7B', 600: '#005A67', 700: '#004952' },
        success: { 500: '#22c55e', 600: '#16a34a' },
        warning: { 500: '#eab308', 600: '#ca8a04' },
        danger: { 500: '#ef4444', 600: '#dc2626' },
      },
    },
  },
  plugins: [],
};
