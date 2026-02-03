// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Check this line!
    "./public/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}