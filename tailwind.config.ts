import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#ea580c",
        "brand-dark": "#c2410c",
      },
    },
  },
  plugins: [],
};
export default config;
