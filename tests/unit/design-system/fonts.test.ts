import { lora, plusJakarta, jetbrainsMono } from '@/lib/fonts';

describe('Font configuration', () => {
  it('exports lora display font', () => {
    expect(lora).toBeDefined();
    expect(lora.variable).toBeDefined();
    expect(typeof lora.variable).toBe('string');
  });

  it('exports plusJakarta body font', () => {
    expect(plusJakarta).toBeDefined();
    expect(plusJakarta.variable).toBeDefined();
    expect(typeof plusJakarta.variable).toBe('string');
  });

  it('exports jetbrainsMono mono font', () => {
    expect(jetbrainsMono).toBeDefined();
    expect(jetbrainsMono.variable).toBeDefined();
    expect(typeof jetbrainsMono.variable).toBe('string');
  });

  it('all fonts have className for application', () => {
    expect(typeof lora.className).toBe('string');
    expect(typeof plusJakarta.className).toBe('string');
    expect(typeof jetbrainsMono.className).toBe('string');
  });
});
