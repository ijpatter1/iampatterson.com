export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-content px-6 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display font-semibold text-black">Patterson Consulting</p>
            <a
              href="mailto:ian@iampatterson.com"
              className="text-sm text-neutral-500 transition-colors hover:text-black"
            >
              ian@iampatterson.com
            </a>
          </div>
          <p className="text-sm text-neutral-400">
            Built with the same stack I sell.{' '}
            <span className="text-neutral-600">Look under the hood to see how.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
