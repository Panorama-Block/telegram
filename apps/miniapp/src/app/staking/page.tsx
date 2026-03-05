import { redirect } from 'next/navigation';

export default function StakingPage() {
  redirect('/chat?open=staking');
}
