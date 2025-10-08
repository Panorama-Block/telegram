'use client'

import { useEffect, useState } from 'react'
import AnimatedLine from '@/components/ui/AnimatedLine'
import { useAgentsStore } from '@/shared/store/agents'

interface AgentLine {
  className: string
  agentClassName?: string
  startLineLength?: number
  endLineLength?: number
  agentId?: string
  flip?: boolean
  verticalOffset?: number
}

const Lines = () => {
  const commonEndY = 1544
  const { activeAgent } = useAgentsStore()
  const [loading, setLoading] = useState(true)

  const agentLines: AgentLine[] = [
    { className: 'absolute top-[-240px] left-[0rem]', endLineLength: 95, startLineLength: 100 },
    { className: 'absolute top-[-215px] left-[2rem] 3xl:top-[-210px] 3xl:left-[2.5rem]', endLineLength: 70, startLineLength: 100 },
    { className: 'absolute top-[-185px] left-[4rem] 3xl:top-[-180px] 3xl:left-[5rem]', endLineLength: 40, startLineLength: 50 },
    { className: 'absolute top-[-155px] left-[6rem] 3xl:top-[-150px] 3xl:left-[7.5rem]', endLineLength: 10, startLineLength: 0 },
    { className: 'absolute top-[-125px] left-[8rem] 3xl:top-[-120px] 3xl:left-[10rem]', agentClassName: 'z-[10] left-[4rem] 3xl:left-[8rem]', startLineLength: -50, endLineLength: -500, agentId: '1', verticalOffset: 170 },
    { className: 'absolute top-[-95px] left-[10rem] 3xl:top-[-90px] 3xl:left-[12.5rem]', endLineLength: -50, startLineLength: 0 },
    { className: 'absolute top-[-65px] left-[12rem] 3xl:top-[-60px] 3xl:left-[15rem]', agentClassName: 'z-[10] left-[8rem] 3xl:left-[14rem]', startLineLength: 0, endLineLength: -250, agentId: '2', verticalOffset: 110 },
    { className: 'absolute top-[-35px] left-[14rem] 3xl:top-[-30px] 3xl:left-[17.5rem]', endLineLength: -110, startLineLength: 0 },
    { className: 'absolute top-[0px] left-[16rem] 3xl:top-[0px] 3xl:left-[20rem]', agentClassName: 'z-[10] left-[12.25rem] 3xl:left-[20rem]', startLineLength: 0, endLineLength: -500, agentId: '3', verticalOffset: 45 },
    { className: 'absolute top-[25px] left-[18rem] 3xl:top-[30px] 3xl:left-[22.5rem]', endLineLength: -170, startLineLength: 0 },
    { className: 'absolute top-[55px] left-[20rem] 3xl:top-[60px] 3xl:left-[25rem]', agentClassName: 'z-[10] left-[16rem] 3xl:left-[26rem]', startLineLength: -220, endLineLength: -360, agentId: '4', verticalOffset: 45 },
    { className: 'absolute top-[85px] left-[22rem] hidden xl:block 3xl:top-[90px] 3xl:left-[27.5rem]', endLineLength: -230, startLineLength: -60 },
    { className: 'absolute top-[115px] left-[24rem] hidden xl:block 3xl:top-[120px] 3xl:left-[30rem]', endLineLength: -260, startLineLength: -75 },
    { className: 'absolute top-[150px] left-[26rem] hidden xl:block 3xl:top-[150px] 3xl:left-[32.5rem]', endLineLength: -295, startLineLength: -95 },
    // Inverted
    { className: 'absolute top-[-235px] 3xl:top-[-240px] right-[0rem]', flip: true, startLineLength: 100 },
    { className: 'absolute top-[-205px] right-[2rem] 3xl:top-[-210px] 3xl:right-[2.5rem]', flip: true, endLineLength: 70, startLineLength: 100 },
    { className: 'absolute top-[-175px] right-[4rem] 3xl:top-[-180px] 3xl:right-[5rem]', flip: true, endLineLength: 40, startLineLength: 50 },
    { className: 'absolute top-[-150px] right-[6rem] 3xl:top-[-150px] 3xl:right-[7.5rem]', flip: true, endLineLength: 10, startLineLength: 0 },
    { className: 'absolute top-[-115px] right-[8rem] 3xl:top-[-120px] 3xl:right-[10rem]', agentClassName: 'z-[10] right-[4rem] 3xl:right-[8rem]', flip: true, startLineLength: -50, endLineLength: -230, agentId: '8', verticalOffset: 165 },
    { className: 'absolute top-[-85px] right-[10rem] 3xl:top-[-90px] 3xl:right-[12.5rem]', flip: true, endLineLength: -50, startLineLength: 0 },
    { className: 'absolute top-[-55px] right-[12rem] 3xl:top-[-60px] 3xl:right-[15rem]', agentClassName: 'z-[10] right-[8.25rem] 3xl:right-[14rem]', flip: true, startLineLength: 0, endLineLength: -550, agentId: '7', verticalOffset: 105 },
    { className: 'absolute top-[-25px] right-[14rem] 3xl:top-[-30px] 3xl:right-[17.5rem]', flip: true, endLineLength: -110, startLineLength: 0 },
    { className: 'absolute top-[0px] right-[16rem] 3xl:top-[0px] 3xl:right-[20rem]', agentClassName: 'z-[10] right-[12rem] 3xl:right-[20rem]', flip: true, startLineLength: 0, endLineLength: -480, agentId: '6', verticalOffset: 45 },
    { className: 'absolute top-[30px] right-[18rem] 3xl:top-[30px] 3xl:right-[22.5rem]', flip: true, endLineLength: -170, startLineLength: 0 },
    { className: 'absolute top-[60px] right-[20rem] 3xl:top-[60px] 3xl:right-[25rem]', agentClassName: 'z-[10] right-[16rem] 3xl:right-[26rem]', flip: true, startLineLength: -220, endLineLength: -350, agentId: '5', verticalOffset: 45 },
    { className: 'absolute top-[90px] hidden xl:block right-[22rem] 3xl:top-[90px] 3xl:right-[27.5rem]', flip: true, endLineLength: -230, startLineLength: -60 },
    { className: 'absolute top-[120px] hidden xl:block right-[24rem] 3xl:top-[120px] 3xl:right-[30rem]', flip: true, endLineLength: -260, startLineLength: -75 },
    { className: 'absolute top-[150px] hidden xl:block right-[26rem] 3xl:top-[150px] 3xl:right-[32.5rem]', flip: true, endLineLength: -290, startLineLength: -95 },
  ]

  const getAgentEndPosition = (line: AgentLine, finalEndY: number) => {
    const horizontalClass = line.agentClassName || line.className || ''
    const leftMatch = horizontalClass.match(/left-\[?(\d+(?:\.\d+)?(?:rem)?)\]?/)
    const rightMatch = horizontalClass.match(/right-\[?(\d+(?:\.\d+)?(?:rem)?)\]?/)
    const verticalOffset = line.verticalOffset !== undefined ? line.verticalOffset : 110
    return {
      position: 'absolute',
      top: `${finalEndY - verticalOffset}px`,
      ...(leftMatch ? { left: leftMatch[1] } : {}),
      ...(rightMatch ? { right: rightMatch[1] } : {}),
    } as React.CSSProperties
  }

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(t)
  }, [activeAgent])

  return (
    <div className="absolute hidden lg:block top-[-850px] w-full h-full pointer-events-none z-0">
      {agentLines.map((line, index) => {
        const finalEndY = line.endLineLength ? commonEndY + line.endLineLength : commonEndY + 500
        return (
          <div key={index}>
            <AnimatedLine
              className={line.className}
              animate={activeAgent === line.agentId}
              useGradient={activeAgent !== line.agentId}
              flip={line.flip}
              absoluteEndY={!line.endLineLength ? commonEndY + 150 : undefined}
              startLineLength={line.startLineLength}
              endLineLength={line.endLineLength}
            />
            {/* hide agent cards connected to lines for clean background */}
            {false && line.agentId && (
              <div className={line.agentClassName} style={getAgentEndPosition(line, finalEndY)}>
                <img
                  src={`/landing/agents/${line.agentId}${activeAgent === line.agentId && !loading ? '-active' : ''}.svg`}
                  alt={`Agent ${line.agentId}`}
                  width={120}
                  height={120}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default Lines
