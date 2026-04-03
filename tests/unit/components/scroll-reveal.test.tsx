/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { ScrollReveal } from '@/components/scroll-reveal';

// Mock framer-motion to render children directly
jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
      ...rest
    }: {
      children: React.ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => (
      <div className={className} data-testid="motion-div" {...filterMotionProps(rest)}>
        {children}
      </div>
    ),
  },
  useInView: () => true,
  useReducedMotion: () => false,
}));

// Filter out framer-motion specific props that aren't valid DOM attributes
function filterMotionProps(props: Record<string, unknown>): Record<string, unknown> {
  const motionKeys = [
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'whileInView',
    'viewport',
    'style',
    'onAnimationComplete',
  ];
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!motionKeys.includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

describe('ScrollReveal', () => {
  it('renders children', () => {
    render(
      <ScrollReveal>
        <p>Hello world</p>
      </ScrollReveal>,
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <ScrollReveal className="my-class">
        <p>Content</p>
      </ScrollReveal>,
    );
    expect(screen.getByTestId('motion-div')).toHaveClass('my-class');
  });

  it('renders as a motion.div wrapper', () => {
    render(
      <ScrollReveal>
        <p>Animated content</p>
      </ScrollReveal>,
    );
    expect(screen.getByTestId('motion-div')).toBeInTheDocument();
  });
});
