'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { useAgentsStore } from '@/shared/store/agents'
import blurLeft from '../../../../public/landing/blur-left.svg'
import blurRight from '../../../../public/landing/blur-right.svg'
import blurMobile from '../../../../public/landing/blur-mobile.svg'
import inputHorse from '../../../../public/icons/zico_white.svg'

interface Agent {
  [key: string]: {
    title: string
    prompts: string[]
  }
}

const data: Agent[] = [
  { chainWatcherAgent: { title: 'Chain Watcher Agent', prompts: [
    'Identify newly minted tokens on Solana with daily volume above $10K',
    'Compare the borrow APY of USDC between Aave and Morpho on Ethereum',
  ]}},
  { stakeAgent: { title: '(Re)Stake Agent', prompts: [
    'Stake all idle SOL on Marinade every friday at 2pm UTC',
    'Convert 50% of LST portfolio (stETH, ETHx, rsETH) into ezETH and restake on Renzo',
  ]}},
  { swapAgent: { title: 'Swap Agent', prompts: [
    'Swap half my USDC holdings on Base to BERA tokens on BeraChain',
    'Execute a cross-chain swap of 200 USDC from Ethereum to SONIC',
  ]}},
  { dcaAgent: { title: 'DCA Agent', prompts: [
    'DCA $1000 into SOL and ETH, split 70/30, every two weeks',
    'Double DCA allocation during market dips greater than 7% in a 24h',
  ]}},
  { crossTraderAgent: { title: 'Cross Trader Agent', prompts: [
    'Mirror the trades of wallet 0xABCD across Solana and Base, but cap each trade at $500',
    'Set limit orders to buy ETH on Base at $2500 and sell at $2800 with a stop loss at $2400',
  ]}},
  { portfolioScannerAgent: { title: 'Portfolio Scanner Agent', prompts: [
    'Calculate my total staking yield in the last 30 days across LIDO and JITO',
    'Summarize LP fees on Uniswap across chains, minus estimated IL per pool',
  ]}},
  { reportAgent: { title: 'Report Agent', prompts: [
    'Chart weekly LP APY changes on WBTC/USDC pool on Uniswap-Ethereum',
    'Compile daily wallet inflows from cross-chain bridges between Ethereum and Solana',
  ]}},
]

const useTypewriter = () => {
  const [text, setText] = useState('')
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0)
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isWaitingForNextAgent, setIsWaitingForNextAgent] = useState(false)
  const [isPausingBeforeDelete, setIsPausingBeforeDelete] = useState(false)
  const { setActiveAgent } = useAgentsStore()

  const getCurrentPrompt = useCallback(() => {
    const agent = Object.values(data[currentAgentIndex])[0]
    return agent.prompts[currentPromptIndex]
  }, [currentAgentIndex, currentPromptIndex])

  useEffect(() => {
    let timeout: NodeJS.Timeout
    const batchSize = 1
    const typeSpeed = 250
    const deleteSpeed = 200
    const pauseBeforeDelete = 2000
    const agentChangeDelay = 1000

    const animate = () => {
      if (isWaitingForNextAgent) {
        timeout = setTimeout(() => {
          setCurrentAgentIndex((currentAgentIndex + 1) % data.length)
          setCurrentPromptIndex(0)
          setIsWaitingForNextAgent(false)
        }, agentChangeDelay)
        return
      }
      const currentText = getCurrentPrompt()
      if (!isDeleting) {
        if (text.length < currentText.length) {
          const charsToAdd = Math.min(batchSize, currentText.length - text.length)
          setText(currentText.slice(0, text.length + charsToAdd))
          setIsPausingBeforeDelete(false)
          timeout = setTimeout(animate, typeSpeed)
        } else {
          setIsPausingBeforeDelete(true)
          timeout = setTimeout(() => {
            setIsPausingBeforeDelete(false)
            setIsDeleting(true)
            animate()
          }, pauseBeforeDelete)
        }
      } else {
        if (text.length > 0) {
          const charsToRemove = Math.min(batchSize, text.length)
          const newText = text.slice(0, text.length - charsToRemove)
          setText(newText)
          setIsPausingBeforeDelete(false)
          timeout = setTimeout(animate, deleteSpeed)
        } else {
          setIsDeleting(false)
          const agent = Object.values(data[currentAgentIndex])[0]
          if (currentPromptIndex < agent.prompts.length - 1) {
            timeout = setTimeout(() => setCurrentPromptIndex(currentPromptIndex + 1), 0)
          } else {
            if (currentAgentIndex === 5) setActiveAgent((currentAgentIndex + 3).toString())
            else if (currentAgentIndex === data.length - 1) setActiveAgent('1')
            else setActiveAgent((currentAgentIndex + 2).toString())
            setIsWaitingForNextAgent(true)
          }
        }
      }
    }
    timeout = setTimeout(animate, 20)
    return () => clearTimeout(timeout)
  }, [text, isDeleting, isWaitingForNextAgent, currentAgentIndex, currentPromptIndex, getCurrentPrompt, setActiveAgent])

  return { text, isPausingBeforeDelete }
}

const Banner = () => {
  const { text, isPausingBeforeDelete } = useTypewriter()
  return (
    <div className="flex flex-col items-center justify-center max-h-[1500px] h-full mt-8 pb-4">
      <div className={`xl:mt-12 relative w-[95%] md:w-[90%] xl:w-[80%] max-w-[1200px] mx-auto ${!isPausingBeforeDelete ? 'typewriter' : ''}`}>
        <div className="flex items-center rounded-[25px] w-full text-white cursor-default pl-4 pr-4 md:px-4 py-3 md:py-2 duration-75 shadow-[0px_16px_40px_0px_rgba(0,0,0,0.6)] z-20 min-h-[60px] bg-[#0b0b0b] border border-white/8">
          <Image src={inputHorse} alt="" className="w-[40px] h-[40px] md:w-[48px] md:h-[48px] flex-shrink-0" width={48} height={48} />
          <div className="flex-1 pl-2 md:pl-4 pr-4 text-sm md:text-base xl:text-lg whitespace-normal break-words">
            {text}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Banner
