/**
 * @jest-environment jsdom
 */
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('Demo Landing Page', () => {
  it('redirects to /#demos', async () => {
    const { default: DemoLandingPage } = await import('@/app/demo/page');
    DemoLandingPage();
    expect(redirect).toHaveBeenCalledWith('/#demos');
  });
});
