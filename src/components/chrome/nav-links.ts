export interface NavLink {
  href: string;
  label: string;
  num: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home', num: '01' },
  { href: '/services', label: 'Services', num: '02' },
  { href: '/contact', label: 'Contact', num: '03' },
];
