import { BridgeForm } from '@/modules/bridge/BridgeForm';
import Link from 'next/link';

export default function BridgePage() {
    return (
        <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center">
            <div className="w-full max-w-lg">
                <h1 className="text-3xl font-bold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Panorama Bridge
                </h1>
                <div className="mb-4 flex justify-center">
                    <Link
                        href="/chat"
                        className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
                    >
                        ← Back to Chat
                    </Link>
                </div>
                <BridgeForm />
            </div>
        </div>
    );
}
