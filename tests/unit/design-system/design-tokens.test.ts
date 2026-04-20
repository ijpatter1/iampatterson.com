import resolveConfig from 'tailwindcss/resolveConfig';

import tailwindConfig from '../../../tailwind.config';

const fullConfig = resolveConfig(tailwindConfig);
const { theme } = fullConfig;

// Tailwind's DefaultColors type doesn't include our custom tokens,
// but they exist at runtime after resolveConfig merges the config.
const colors = theme.colors as unknown as Record<string, Record<string, string>>;

describe('Design System Tokens', () => {
  describe('Brand colors', () => {
    it('defines a primary brand color scale', () => {
      const primary = colors.brand;
      expect(primary).toBeDefined();
      expect(primary['50']).toBeDefined();
      expect(primary['500']).toBeDefined();
      expect(primary['900']).toBeDefined();
    });

    it('defines surface tokens mapped to new palette', () => {
      const surface = colors.surface;
      expect(surface.DEFAULT).toBeDefined();
      expect(surface.alt).toBeDefined();
      expect(surface.dark).toBeDefined();
      expect(surface.hover).toBeDefined();
    });

    it('defines content tokens', () => {
      const content = colors.content;
      expect(content.DEFAULT).toBeDefined();
      expect(content.secondary).toBeDefined();
      expect(content.muted).toBeDefined();
      expect(content.inverse).toBeDefined();
    });

    it('defines accent tokens for status states', () => {
      const accent = colors.accent;
      expect(accent.success).toBeDefined();
      expect(accent['success-border']).toBeDefined();
      expect(accent['success-text']).toBeDefined();
    });

    it('defines editorial persimmon + phosphor accent tokens', () => {
      // Paper state — marketing surface
      expect(colors.persimmon).toBe('#EA5F2A');
      // Underside state — Session overlay (post-UAT F1 rename)
      expect(colors.phosphor).toBe('#FFA400');
    });

    it('defines a dynamic accent-current token bound to --accent', () => {
      // Components consume the live accent via `text-accent-current`,
      // `bg-accent-current`, etc. The value is a CSS variable so the
      // OverlayProvider can swap it at runtime.
      expect(colors['accent-current']).toBe('var(--accent)');
    });

    it('defines paper / ink / rule scales for the editorial surface', () => {
      const paper = colors.paper as unknown as Record<string, string>;
      const ink = colors.ink as unknown as Record<string, string>;
      const rule = colors.rule as unknown as Record<string, string>;
      expect(paper.DEFAULT).toBe('#FFFFFF');
      expect(paper.alt).toBe('#F5F5F5');
      expect(ink.DEFAULT).toBe('#111111');
      expect(ink['3']).toBe('#5C5C5C');
      expect(rule.soft).toBeDefined();
    });
  });

  describe('Demo accent palettes', () => {
    it('defines ecommerce palette (warm amber)', () => {
      const ecommerce = colors.demo as unknown as Record<string, Record<string, string>>;
      expect(ecommerce.ecommerce).toBeDefined();
      expect(ecommerce.ecommerce.DEFAULT).toBeDefined();
      expect(ecommerce.ecommerce.light).toBeDefined();
      expect(ecommerce.ecommerce.dark).toBeDefined();
    });

    it('defines subscription palette (deep premium)', () => {
      const demo = colors.demo as unknown as Record<string, Record<string, string>>;
      expect(demo.subscription).toBeDefined();
      expect(demo.subscription.DEFAULT).toBeDefined();
      expect(demo.subscription.light).toBeDefined();
      expect(demo.subscription.dark).toBeDefined();
    });

    it('defines leadgen palette (cool editorial)', () => {
      const demo = colors.demo as unknown as Record<string, Record<string, string>>;
      expect(demo.leadgen).toBeDefined();
      expect(demo.leadgen.DEFAULT).toBeDefined();
      expect(demo.leadgen.light).toBeDefined();
      expect(demo.leadgen.dark).toBeDefined();
    });
  });

  describe('Typography', () => {
    it('defines display font family', () => {
      const fonts = theme.fontFamily as Record<string, string[]>;
      expect(fonts.display).toBeDefined();
      expect(fonts.display.length).toBeGreaterThan(0);
    });

    it('defines sans (body) font family', () => {
      const fonts = theme.fontFamily as Record<string, string[]>;
      expect(fonts.sans).toBeDefined();
      expect(fonts.sans.length).toBeGreaterThan(0);
    });

    it('defines mono font family', () => {
      const fonts = theme.fontFamily as Record<string, string[]>;
      expect(fonts.mono).toBeDefined();
    });
  });

  describe('Spacing and layout', () => {
    it('defines section spacing token', () => {
      const spacing = theme.spacing as Record<string, string>;
      expect(spacing.section).toBeDefined();
    });

    it('defines content max-width token', () => {
      const maxWidth = theme.maxWidth as Record<string, string>;
      expect(maxWidth.content).toBeDefined();
    });
  });

  describe('Shadows', () => {
    it('defines card shadow', () => {
      const shadows = theme.boxShadow as Record<string, string>;
      expect(shadows.card).toBeDefined();
    });

    it('defines elevated shadow', () => {
      const shadows = theme.boxShadow as Record<string, string>;
      expect(shadows.elevated).toBeDefined();
    });
  });

  describe('Border radius', () => {
    it('defines card border radius', () => {
      const radius = theme.borderRadius as Record<string, string>;
      expect(radius.card).toBeDefined();
    });
  });
});
