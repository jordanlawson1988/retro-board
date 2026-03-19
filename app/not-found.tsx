'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-[var(--color-gray-8)]">404</h1>
        <p className="mt-2 text-lg text-[var(--color-gray-5)]">Page not found</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-[var(--radius-md)] bg-[var(--color-navy)] px-4 py-2 text-white"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
