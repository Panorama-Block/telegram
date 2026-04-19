import { redirect } from 'next/navigation';

export default function MetronomePage() {
  redirect('/chat?open=metronome');
}
