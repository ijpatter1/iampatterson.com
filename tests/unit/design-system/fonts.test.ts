import { inter, spaceGrotesk } from '@/lib/fonts';

describe('Font configuration', () => {
  it('exports inter font object with variable property', () => {
    expect(inter).toBeDefined();
    expect(inter.variable).toBeDefined();
    expect(typeof inter.variable).toBe('string');
  });

  it('exports spaceGrotesk font object with variable property', () => {
    expect(spaceGrotesk).toBeDefined();
    expect(spaceGrotesk.variable).toBeDefined();
    expect(typeof spaceGrotesk.variable).toBe('string');
  });

  it('inter has className for application', () => {
    expect(inter.className).toBeDefined();
    expect(typeof inter.className).toBe('string');
  });

  it('spaceGrotesk has className for application', () => {
    expect(spaceGrotesk.className).toBeDefined();
    expect(typeof spaceGrotesk.className).toBe('string');
  });
});
