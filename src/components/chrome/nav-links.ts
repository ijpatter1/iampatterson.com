export interface NavLink {
  href: string;
  label: string;
  num: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home', num: '01' },
  { href: '/services', label: 'Services', num: '02' },
  { href: '/#demos', label: 'Demos', num: '03' },
  { href: '/about', label: 'About', num: '04' },
  { href: '/contact', label: 'Contact', num: '05' },
];

export interface DemoLink {
  href: string;
  title: string;
}

export const DEMO_LINKS: DemoLink[] = [
  { href: '/demo/ecommerce', title: 'The Tuna Shop' },
  { href: '/demo/subscription', title: 'Tuna Subscription' },
  { href: '/demo/leadgen', title: 'Tuna Partnerships' },
];
