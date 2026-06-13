import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        blackwolf: "var(--black)",
        surface: "var(--surface)",
        card: "var(--card)",
        gold: "var(--gold)",
        text: "var(--text)",
        muted: "var(--muted)",
        green: "var(--green)",
        blue: "var(--blue)",
        amber: "var(--amber)",
        red: "var(--red)",
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};
export default config;
