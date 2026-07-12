/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lcd: {
          bg: '#8bac0f',      // LCD Screen Background
          darkest: '#0f380f',  // Active pixel color
          dark: '#306230',     // Dark text/pixels
          light: '#9bbc0f',    // Mild pixel shade
          border: '#0f380f'
        },
        bezel: {
          dark: '#2c3e50',     // Dark retro plastic casing
          red: '#c0392b',      // Accent color
          button: '#34495e',   // D-pad button color
          action: '#962d22'    // Red A/B action buttons
        }
      },
      fontFamily: {
        pressstart: ['"Press Start 2P"', 'monospace', 'Courier New']
      }
    },
  },
  plugins: [],
}
