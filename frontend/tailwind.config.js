/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        soil: { 50: "#f6f4ef", 800: "#3d4a32", 900: "#243024" },
        leaf: { 600: "#3f6b45", 700: "#2f5536" },
      },
    },
  },
  plugins: [],
};
