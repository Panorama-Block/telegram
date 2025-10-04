'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();

  const handleLaunchApp = () => {
    router.push('/auth');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            #1a4d4d 0px,
            #1a4d4d 1px,
            transparent 1px,
            transparent 60px
          ),
          repeating-linear-gradient(
            0deg,
            #1a4d4d 0px,
            #1a4d4d 1px,
            transparent 1px,
            transparent 60px
          )`
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="text-cyan-400 text-2xl font-bold">PANORAMA BLOCK</div>
        </div>
        <nav className="hidden md:flex gap-8 text-gray-400">
          <a href="#vision" className="hover:text-white transition">Vision</a>
          <a href="#about" className="hover:text-white transition">About</a>
          <a href="#roadmap" className="hover:text-white transition">Roadmap</a>
          <a href="#resources" className="hover:text-white transition">Resources</a>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-12">
        <h1 className="text-5xl md:text-7xl font-bold text-center mb-4">
          A Panoramic View of
        </h1>
        <h2 className="text-5xl md:text-7xl font-bold text-center mb-6 text-cyan-400">
          AI Agents
        </h2>
        <p className="text-gray-400 text-center max-w-2xl mb-8">
          Fusing multi-chain data pipelines with AI reasoning frameworks to empower
          decentralized composable financial automation.
        </p>
        <button
          onClick={handleLaunchApp}
          className="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
        >
          Launch App
        </button>

        {/* Search Bar */}
        <div className="mt-12 w-full max-w-2xl bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 flex items-center px-4 py-3">
          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Lorem Ipsum is simply dummy text of the printing and typesetting industry"
            className="flex-1 bg-transparent outline-none text-gray-300 placeholder-gray-600"
          />
          <svg className="w-5 h-5 text-gray-400 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Knight Chess Icon */}
        <div className="mt-20 mb-12">
          <div className="w-32 h-32 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full text-cyan-400 fill-current">
              <path d="M50,10 L60,30 L70,20 L65,40 L80,50 L65,60 L70,80 L50,90 L30,80 L35,60 L20,50 L35,40 L30,20 L40,30 Z" />
            </svg>
          </div>
        </div>

        {/* Vision Section */}
        <div id="vision" className="mt-12 max-w-md bg-gray-900/30 backdrop-blur-sm rounded-2xl border border-gray-800 p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Vision</h3>
          <p className="text-gray-400 text-sm">
            Laying the foundation for intelligent automation across blockchain ecosystems.
          </p>
        </div>

        {/* Feature Icons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-4xl w-full">
          <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
        </div>

        {/* Bottom Feature Icons */}
        <div className="grid grid-cols-3 gap-4 mt-4 max-w-md w-full">
          <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </main>
    </div>
  );
}
