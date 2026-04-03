export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-dark">
      <div className="mx-auto max-w-content px-6 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display font-semibold text-content-inverse">
              Patterson Consulting — Atlanta, GA
            </p>
            <a
              href="mailto:ian@iampatterson.com"
              className="text-sm text-content-on-dark transition-colors hover:text-content-inverse"
            >
              ian@iampatterson.com
            </a>
          </div>
          <p className="text-sm text-content-on-dark">
            Built with the same stack I sell.{' '}
            <span className="text-content-muted">Look under the hood to see how.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
