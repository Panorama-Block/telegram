'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// Import images
import pblokNav from '../../public/logos/pblok_nav.svg';
import zicoBlue from '../../public/icons/zico_blue.svg';
import zicoWhite from '../../public/icons/zico_white.svg';
import bgHome from '../../public/images/bg_home.svg';

const PROMPTS = [
  "What's the best DeFi strategy for yield farming?",
  "How do I bridge tokens between chains safely?",
  "Explain liquidity pools and impermanent loss",
  "What are the best web3 wallets for multi-chain?",
  "How to analyze smart contract risks?",
  "What's the difference between Layer 1 and Layer 2?",
];

export default function LandingPage() {
  const router = useRouter();
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const currentText = PROMPTS[promptIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && charIndex < currentText.length) {
      timeout = setTimeout(() => {
        setCurrentPrompt(currentText.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 80); // Slower typing for better performance
    } else if (!isDeleting && charIndex === currentText.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 3000); // Longer pause
    } else if (isDeleting && charIndex > 0) {
      timeout = setTimeout(() => {
        setCurrentPrompt(currentText.slice(0, charIndex - 1));
        setCharIndex(charIndex - 1);
      }, 50); // Faster deleting
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setPromptIndex((promptIndex + 1) % PROMPTS.length);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [charIndex, isDeleting, promptIndex]);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 md:top-20">
        <Image
          src={bgHome}
          alt="Background"
          fill
          className="object-contain object-center"
          priority
          quality={100}
        />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Mobile Menu Button - Left */}
          <button
            className="md:hidden text-gray-300 hover:text-cyan-400 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Logo - Left on Desktop, Right on Mobile */}
          <div className="flex items-center md:mr-auto">
            <Image
              src={pblokNav}
              alt="Panorama Block"
              width={140}
              height={40}
              className="h-8 sm:h-10 w-auto"
            />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8 text-sm lg:text-base">
            <a href="#vision" className="text-gray-300 hover:text-cyan-400 transition-colors">Vision</a>
            <a href="#about" className="text-gray-300 hover:text-cyan-400 transition-colors">About</a>
            <a href="#roadmap" className="text-gray-300 hover:text-cyan-400 transition-colors">Roadmap</a>
            <a href="#resources" className="text-gray-300 hover:text-cyan-400 transition-colors">Resources</a>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-3">
            <a
              href="#vision"
              className="block text-gray-300 hover:text-cyan-400 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Vision
            </a>
            <a
              href="#about"
              className="block text-gray-300 hover:text-cyan-400 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </a>
            <a
              href="#roadmap"
              className="block text-gray-300 hover:text-cyan-400 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Roadmap
            </a>
            <a
              href="#resources"
              className="block text-gray-300 hover:text-cyan-400 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Resources
            </a>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10 px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6">
              A Panoramic View of
              <br />
              <span className="text-cyan-400">AI Agents</span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
              Fusing multi-chain data pipelines with AI reasoning frameworks to empower
              decentralized, composable financial automation.
            </p>
            <button
              onClick={() => router.push('/auth')}
              className="bg-white text-slate-900 px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-medium hover:bg-gray-100 transition-all transform hover:scale-105"
            >
              Launch App
            </button>
          </div>

          {/* Chat Bar */}
          <div className="max-w-3xl mx-auto mb-12 sm:mb-16 lg:mb-20">
            <div className="bg-[#1a1a1a] rounded-lg px-4 py-2.5 flex items-center gap-3">
              <Image
                src={zicoWhite}
                alt="Zico"
                width={20}
                height={20}
                className="h-5 w-5"
              />
              <div className="flex-1 text-gray-400 text-sm">
                {currentPrompt}
                <span className="animate-pulse">|</span>
              </div>
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Central Logo */}
          <div className="flex justify-center mb-12 sm:mb-16 lg:mb-20">
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-cyan-400/20 blur-3xl rounded-full" />
              <Image
                src={zicoBlue}
                alt="Zico Blue"
                width={200}
                height={200}
                className="relative h-32 w-32 sm:h-40 sm:w-40 lg:h-48 lg:w-48"
              />
            </div>
          </div>

          {/* Vision Section */}
          <div className="max-w-2xl mx-auto">
            <div className="p-6 sm:p-8 lg:p-10 text-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-white">Vision</h2>
              <p className="text-gray-300 text-sm sm:text-base lg:text-lg leading-relaxed">
                Laying the foundation for intelligent
                <br />
                automation across blockchain ecosystems.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Spacer */}
      <div className="h-20" />
    </div>
  );
}