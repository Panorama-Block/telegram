'use client'

import Verticals from '@/modules/landing/verticals'
import Partners from '@/modules/landing/partners'
import Roadmap from '@/modules/landing/roadmap'
import Header from '@/modules/landing/header'
import Banner from '@/modules/landing/banner'
import Footer from '@/modules/landing/footer'
import Lines from '@/modules/landing/lines'
import About from '@/modules/landing/about'
import Hero from '@/modules/landing/hero'

export default function LandingPage() {
  return (
    <div className="bg-landing min-h-screen">
      <div className="relative overflow-hidden">
        <Header />
        <Hero />
        <div className="relative min-h-[600px]">
          {/* Gradient overlay - smooth fade in from black to cyan glow */}
          <div className="absolute left-0 top-0 bottom-0 w-1/4 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(180_100%_50%/0.02)_0%,hsl(180_100%_50%/0.01)_50%,hsl(0_0%_2%)_100%)]"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,hsl(0_0%_2%)_0%,transparent_50%,transparent_100%)]"></div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/4 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_left,hsl(180_100%_50%/0.02)_0%,hsl(180_100%_50%/0.01)_50%,hsl(0_0%_2%)_100%)]"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,hsl(0_0%_2%)_0%,transparent_50%,transparent_100%)]"></div>
          </div>
          <Lines />
          <Banner />
        </div>
      </div>
      <About />
      <Verticals />
      <Roadmap />
      <Partners />
      <Footer />
    </div>
  )
}
