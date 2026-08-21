/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn/ui standard colors
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
        },
        border: {
          DEFAULT: 'var(--border)',
          light: 'var(--color-border-light)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
          hover: 'var(--color-secondary-hover)',
          muted: 'var(--color-secondary-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          hover: 'var(--color-accent-hover)',
          muted: 'var(--color-accent-muted)',
        },
        // Custom project colors
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          card: 'var(--color-bg-card)',
          'card-hover': 'var(--color-bg-card-hover)',
          input: 'var(--color-bg-input)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          muted: 'var(--color-success-muted)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          muted: 'var(--color-warning-muted)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          muted: 'var(--color-danger-muted)',
        },
        gold: {
          DEFAULT: 'var(--color-gold)',
          muted: 'var(--color-gold-muted)',
        },
      },
    },
  },
  plugins: [],
}
