/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope"', '"Segoe UI"', 'sans-serif'],
        display: ['"Space Grotesk"', '"Manrope"', 'sans-serif'],
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-slide-in": "fadeSlideIn 300ms ease both",
      },
    },
  },
  plugins: [],
};
