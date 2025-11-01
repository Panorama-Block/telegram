'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Animated Gradient Mesh Background
 * Uses Panorama Block brand colors (#00FFC3, #042f31)
 * Smooth, fluid gradient animation with multiple orbs
 * Interactive: responds to mouse movement
 */
export function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position to -1 to 1 range
      mouseX.current = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY.current = (e.clientY / window.innerHeight) * 2 - 1;
    };

    // Smooth animation loop
    let animationFrameId: number;
    const animate = () => {
      // Smooth lerp (linear interpolation) for fluid movement
      // 0.03 for very soft, subtle response
      currentX.current += (mouseX.current - currentX.current) * 0.03;
      currentY.current += (mouseY.current - currentY.current) * 0.03;

      if (containerRef.current) {
        // Apply very subtle parallax effect - 35px movement (soft and smooth)
        containerRef.current.style.transform = `translate(${currentX.current * 35}px, ${currentY.current * 35}px)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      {/* Animated gradient orbs - Only visible on desktop (lg breakpoint and above: 1024px+) */}
      <div ref={containerRef} className="absolute inset-0 transition-transform duration-100 ease-out hidden lg:block">
        {/* Main emerald orb - top left */}
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(0, 255, 195, 0.35) 0%, rgba(0, 255, 195, 0) 70%)',
            top: '-15%',
            left: '-10%',
            filter: 'blur(120px)',
            animationDuration: '20s',
            animationDelay: '0s',
            willChange: 'transform'
          }}
        />

        {/* Secondary teal orb - top right */}
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(4, 47, 49, 0.5) 0%, rgba(4, 47, 49, 0) 70%)',
            top: '-5%',
            right: '-5%',
            filter: 'blur(100px)',
            animationDuration: '25s',
            animationDelay: '-5s',
            willChange: 'transform'
          }}
        />

        {/* Accent emerald orb - center */}
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(0, 230, 176, 0.25) 0%, rgba(0, 230, 176, 0) 70%)',
            top: '50%',
            left: '50%',
            filter: 'blur(90px)',
            transform: 'translate(-50%, -50%)',
            animationDuration: '30s',
            animationDelay: '-10s',
            willChange: 'transform'
          }}
        />

        {/* Bottom left accent */}
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(13, 95, 74, 0.4) 0%, rgba(13, 95, 74, 0) 70%)',
            bottom: '-10%',
            left: '10%',
            filter: 'blur(80px)',
            animationDuration: '22s',
            animationDelay: '-15s',
            willChange: 'transform'
          }}
        />

        {/* Bottom right emerald */}
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: '550px',
            height: '550px',
            background: 'radial-gradient(circle, rgba(0, 255, 195, 0.3) 0%, rgba(0, 255, 195, 0) 70%)',
            bottom: '-15%',
            right: '-10%',
            filter: 'blur(110px)',
            animationDuration: '28s',
            animationDelay: '-20s',
            willChange: 'transform'
          }}
        />

        {/* Small accent orb - right side */}
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: '350px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(0, 255, 195, 0.4) 0%, rgba(0, 255, 195, 0) 70%)',
            top: '30%',
            right: '15%',
            filter: 'blur(70px)',
            animationDuration: '18s',
            animationDelay: '-8s',
            willChange: 'transform'
          }}
        />
      </div>

      {/* Subtle gradient overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.5) 100%)'
        }}
      />
    </div>
  );
}
