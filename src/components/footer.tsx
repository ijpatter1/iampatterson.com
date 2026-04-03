export function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-900">
      <div className="mx-auto max-w-content px-6 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display font-semibold text-neutral-100">Patterson Consulting</p>
            <a
              href="mailto:ian@iampatterson.com"
              className="text-sm text-sage-500 transition-colors hover:text-neutral-100"
            >
              ian@iampatterson.com
            </a>
          </div>
          <p className="text-sm text-neutral-400">
            Built with the same stack I sell.{' '}
            <span className="text-plum-400">Look under the hood to see how.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
