import { redirect } from 'next/navigation';

/** /demo had no page of its own; since 15.4 deleted the Demos section, it goes home. */
export default function DemoLandingPage() {
  redirect('/');
}
