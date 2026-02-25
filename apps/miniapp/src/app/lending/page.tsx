import { redirect } from 'next/navigation';

export default function LendingPage() {
  redirect('/chat?open=lending');
}
