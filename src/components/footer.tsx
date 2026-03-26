export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-neutral-900">Patterson Consulting — Atlanta, GA</p>
            <a
              href="mailto:ian@iampatterson.com"
              className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
            >
              ian@iampatterson.com
            </a>
          </div>
          <p className="text-sm text-neutral-500">Built with the same stack I sell.</p>
        </div>
      </div>
    </footer>
  );
}
