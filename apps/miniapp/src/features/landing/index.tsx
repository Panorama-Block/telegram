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
