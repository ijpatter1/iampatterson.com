/**
 * @jest-environment jsdom
 */
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('Demo Landing Page', () => {
  // 15.4 deleted the homepage's Demos section, so #demos points at nothing.
  it('redirects to the homepage, not the deleted #demos section', async () => {
    const { default: DemoLandingPage } = await import('@/app/demo/page');
    DemoLandingPage();
    expect(redirect).toHaveBeenCalledWith('/');
  });
});
