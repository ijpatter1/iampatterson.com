import * as navLinks from '@/components/chrome/nav-links';

// 15.4: the Demos entry goes (the homepage's Demos section is deleted) and
// /services stays until 16.1 deletes the page. The numbers are shown as an
// ordered list, so they run without a gap.
describe('NAV_LINKS (15.4)', () => {
  const { NAV_LINKS } = navLinks;

  it('has no Demos entry and nothing pointing at a demo or #demos', () => {
    expect(NAV_LINKS.map((l) => l.label)).not.toContain('Demos');
    for (const l of NAV_LINKS) expect(l.href).not.toMatch(/demo/);
  });

  it('keeps Home, Services and Contact, numbered 01 to 03 without a gap', () => {
    expect(NAV_LINKS.map((l) => [l.num, l.label, l.href])).toEqual([
      ['01', 'Home', '/'],
      ['02', 'Services', '/services'],
      ['03', 'Contact', '/contact'],
    ]);
  });

  it('no longer exports the demo list the footer used to render', () => {
    expect(Object.keys(navLinks)).toEqual(['NAV_LINKS']);
  });
});
