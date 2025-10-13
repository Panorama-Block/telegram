'use client';

import React from 'react';
import { AppLayoutWithSidebar } from '@/components/layout';
import { Container } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorBoundary, ErrorFallback } from '@/components/error-boundary';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/shared/lib/utils';

const quickStats = [
  {
    id: 'portfolio',
    title: 'Portfolio Value',
    value: '$12,450.82',
    change: '+5.2%',
    changeType: 'positive' as const,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    id: 'trades',
    title: 'Trades Today',
    value: '23',
    change: '+12',
    changeType: 'positive' as const,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    id: 'pnl',
    title: '24H P&L',
    value: '$+284.12',
    change: '+2.8%',
    changeType: 'positive' as const,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
  },
  {
    id: 'gas',
    title: 'Gas Saved',
    value: '$45.23',
    change: '↓15%',
    changeType: 'positive' as const,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

const recentActivity = [
  {
    id: '1',
    type: 'swap',
    from: 'ETH',
    to: 'USDC',
    amount: '0.5 ETH',
    value: '$1,234.56',
    time: '2 minutes ago',
    status: 'completed',
  },
  {
    id: '2',
    type: 'swap',
    from: 'USDC',
    to: 'WBTC',
    amount: '1,000 USDC',
    value: '$1,000.00',
    time: '1 hour ago',
    status: 'completed',
  },
  {
    id: '3',
    type: 'chat',
    from: 'AI',
    to: 'Analysis',
    amount: 'Market Analysis',
    value: 'BTC Prediction',
    time: '3 hours ago',
    status: 'completed',
  },
];

const topTokens = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    price: '$2,468.92',
    change: '+3.4%',
    changeType: 'positive' as const,
    icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: '$43,256.78',
    change: '+1.2%',
    changeType: 'positive' as const,
    icon: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    price: '$1.00',
    change: '0.0%',
    changeType: 'neutral' as const,
    icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  },
];

export default function Dashboard() {
  return (
    <ErrorBoundary fallback={<ErrorFallback resetError={() => window.location.reload()} />}>
      <AppLayoutWithSidebar>
        <div className="min-h-screen bg-pano-bg-primary">
          <Container className="py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-pano-text-primary">Dashboard</h1>
                <p className="text-pano-text-muted">Welcome to PanoramaBlock</p>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </Button>
                <Button size="sm">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Trade
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quickStats.map((stat) => (
                <Card key={stat.id} variant="glass" className="border-pano-accent/30">
                  <CardContent className="pano-space-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 rounded-lg bg-pano-primary/10 flex items-center justify-center text-pano-primary">
                        {stat.icon}
                      </div>
                      <div className={cn(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        stat.changeType === 'positive' && 'bg-pano-success/10 text-pano-success',
                        stat.changeType === 'negative' && 'bg-pano-error/10 text-pano-error'
                      )}>
                        {stat.change}
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-pano-text-primary mb-1">{stat.value}</h3>
                    <p className="text-sm text-pano-text-muted">{stat.title}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Recent Activity */}
              <div className="lg:col-span-2">
                <Card variant="glass" className="border-pano-accent/30">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Recent Activity</span>
                      <Button variant="ghost" size="sm">
                        View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pano-space-6">
                    <div className="space-y-4">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between p-4 rounded-lg bg-pano-surface-elevated/50">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center text-white',
                              activity.type === 'swap' && 'bg-pano-primary',
                              activity.type === 'chat' && 'bg-pano-secondary'
                            )}>
                              {activity.type === 'swap' ? (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-pano-text-primary">
                                {activity.type === 'swap' ? `${activity.from} → ${activity.to}` : activity.amount}
                              </p>
                              <p className="text-xs text-pano-text-muted">{activity.time}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-pano-text-primary">{activity.amount}</p>
                            <p className="text-xs text-pano-text-muted">{activity.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Tokens */}
              <div>
                <Card variant="glass" className="border-pano-accent/30">
                  <CardHeader>
                    <CardTitle>Top Tokens</CardTitle>
                  </CardHeader>
                  <CardContent className="pano-space-6">
                    <div className="space-y-4">
                      {topTokens.map((token) => (
                        <div key={token.symbol} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <LazyImage
                              src={token.icon}
                              alt={token.symbol}
                              className="w-8 h-8 rounded-full"
                              fallbackSrc="/icons/default-token.svg"
                            />
                            <div>
                              <p className="text-sm font-medium text-pano-text-primary">{token.symbol}</p>
                              <p className="text-xs text-pano-text-muted">{token.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-pano-text-primary">{token.price}</p>
                            <p className={cn(
                              'text-xs font-medium',
                              token.changeType === 'positive' && 'text-pano-success',
                              token.changeType === 'negative' && 'text-pano-error',
                              token.changeType === 'neutral' && 'text-pano-text-muted'
                            )}>
                              {token.change}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Quick Actions */}
            <Card variant="glass" className="border-pano-accent/30">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="pano-space-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto py-6 flex flex-col items-center gap-3 hover:border-pano-primary hover:bg-pano-primary/5"
                  >
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <div className="text-center">
                      <p className="font-medium">Quick Swap</p>
                      <p className="text-xs text-pano-text-muted">Trade tokens instantly</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto py-6 flex flex-col items-center gap-3 hover:border-pano-secondary hover:bg-pano-secondary/5"
                  >
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <div className="text-center">
                      <p className="font-medium">Ask AI</p>
                      <p className="text-xs text-pano-text-muted">Get trading insights</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto py-6 flex flex-col items-center gap-3 hover:border-pano-accent hover:bg-pano-accent/5"
                  >
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <div className="text-center">
                      <p className="font-medium">View Portfolio</p>
                      <p className="text-xs text-pano-text-muted">Check your holdings</p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Container>
        </div>
      </AppLayoutWithSidebar>
    </ErrorBoundary>
  );
}