'use client';

import React from 'react';
import { MessageContent } from '@/shared/ui';

/**
 * Test component to verify markdown rendering with the AI response example
 * To use: import this component in your chat page temporarily
 */
export function TestMarkdownRendering() {
  const exampleContent = `Bridging tokens between chains safely involves several considerations. Here are some key points and practices to follow:

1. **Use Reputable Bridges:** Stick to well-established and audited bridges. Examples include official bridges provided by the blockchain projects themselves (e.g., Avalanche Bridge, Polygon Bridge) or widely recognized third-party bridges like Synapse, Stargate, or Multichain (though always check for recent security audits and community sentiment).

2. **Understand the Bridge Mechanism:** Different bridges use different mechanisms (e.g., lock and mint, liquidity pools, validator networks). Understanding how a particular bridge works can help you identify potential risks.

3. **Check for Audits and Security:** Before using a bridge, check if it has undergone security audits by reputable firms. Look for recent audits and any reported vulnerabilities.

4. **Verify the Contract Addresses:** Always double-check that you are interacting with the correct smart contract addresses for the bridge and the tokens involved. Scammers often create fake websites or contracts to trick users.

5. **Start with Small Amounts:** If you're using a bridge for the first time or are unsure, start by bridging a small, non-significant amount of tokens to test the process.

6. **Be Wary of Phishing Scams:** Always ensure you are on the official website of the bridge. Phishing websites can look identical to legitimate ones but are designed to steal your funds. Bookmark official sites.

7. **Keep Your Wallet Secure:** Ensure your wallet is secure. Use a hardware wallet for significant amounts, enable two-factor authentication where available, and never share your seed phrase.

8. **Monitor Transaction Status:** After initiating a bridge transaction, monitor its status on both the source and destination chain explorers. This helps you confirm that the transaction is progressing as expected.

9. **Understand Fees:** Be aware of the fees involved in bridging, which can include gas fees on both chains and bridge service fees.

10. **Stay Informed:** The crypto space is dynamic. Follow official announcements from bridge projects and reputable crypto news sources to stay informed about any security alerts or updates.

11. **Avoid Congested Networks:** During periods of high network congestion, transactions can be delayed or fail, leading to frustration and potentially higher gas fees if you need to resubmit.

## Example Code Block

Here's a simple example of how you might interact with a bridge contract:

\`\`\`javascript
// Example: Bridge tokens using ethers.js
const { ethers } = require('ethers');

async function bridgeTokens(amount, destinationChain) {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();

  const bridgeContract = new ethers.Contract(
    BRIDGE_ADDRESS,
    BRIDGE_ABI,
    signer
  );

  try {
    const tx = await bridgeContract.bridge(
      amount,
      destinationChain,
      { value: ethers.utils.parseEther('0.01') }
    );

    console.log('Transaction sent:', tx.hash);
    await tx.wait();
    console.log('Transaction confirmed!');
  } catch (error) {
    console.error('Bridge failed:', error);
  }
}
\`\`\`

\`\`\`python
# Example: Python script to monitor bridge status
import requests

def check_bridge_status(tx_hash):
    api_url = f"https://api.bridge.com/status/{tx_hash}"
    response = requests.get(api_url)

    if response.status_code == 200:
        data = response.json()
        return data['status']
    else:
        return 'Error checking status'

# Usage
status = check_bridge_status('0x123...')
print(f'Bridge status: {status}')
\`\`\`

## Table Example

| Bridge Name | Supported Chains | Avg. Fee | Security Rating |
|------------|------------------|----------|-----------------|
| Avalanche Bridge | Avalanche, Ethereum | 0.1% | ⭐⭐⭐⭐⭐ |
| Polygon Bridge | Polygon, Ethereum | 0.05% | ⭐⭐⭐⭐⭐ |
| Synapse | Multi-chain | 0.2% | ⭐⭐⭐⭐ |

> **Important Note:** Always do your own research (DYOR) before using any bridge. The security landscape changes rapidly in crypto.

By following these guidelines, you can significantly reduce the risks associated with bridging tokens between different blockchain networks.`;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="border-b border-cyan-500/20 pb-4">
          <h1 className="text-2xl font-bold text-cyan-400">
            Markdown Rendering Test
          </h1>
          <p className="text-gray-400 mt-2">
            Testing the AI response with full markdown support
          </p>
        </div>

        {/* User Message */}
        <div className="border border-gray-800 rounded-lg p-6 bg-gray-900/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="font-semibold text-cyan-400">You</span>
          </div>
          <MessageContent
            content="How do I bridge tokens between chains safely?"
            role="user"
          />
        </div>

        {/* Assistant Message */}
        <div className="border border-gray-800 rounded-lg p-6 bg-gray-900/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-300">Zico</span>
          </div>
          <MessageContent content={exampleContent} role="assistant" />
        </div>

        {/* Streaming Test */}
        <div className="border border-gray-800 rounded-lg p-6 bg-gray-900/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-300">Zico (Streaming Test)</span>
          </div>
          <MessageContent
            content="Here's a **partial** message that would arrive via *streaming*. Even incomplete markdown like `inline code` or a list:\n\n1. First item\n2. Second it"
            role="assistant"
          />
        </div>
      </div>
    </div>
  );
}
