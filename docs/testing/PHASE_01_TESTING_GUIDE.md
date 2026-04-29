# Zico MiniApp — Phase 01 Testing Guide

**Version:** 1.0  
**Date:** 2026-04-29  
**Scope:** End-to-end product testing — UI, flows, and user experience  
**Out of scope:** AI agent on-chain execution (covered in Phase 02)

---

## Before You Start

### Requirements

- [ ] MetaMask wallet installed and set up
- [ ] Small balances ready on each chain you will test (values under $1 at all times)
- [ ] TON wallet available (Telegram Wallet or Tonkeeper) if testing TON features
- [ ] Access to the app URL

> **Important:** Always use amounts below $1 USD when executing any transaction. The goal is to verify the flow and interface, not to move meaningful funds.

### How to Use This Guide

- Work through each section in order
- Check off each item as you complete it
- Use the **Notes** field at the end of each section to log what you observed
- After finishing each product, fill in the corresponding **Report**
- If something looks wrong or confusing, write it down — every observation matters

---

## Section 1 — Landing Page

> Goal: Read through the landing page carefully, confirm all content makes sense, and flag anything that is confusing, missing, or could be improved.

### Content Review

- [ ] Read the main headline — does it clearly explain what Zico is?
- [ ] Read every section on the page from top to bottom
- [ ] Check that all images and icons load correctly (no broken images)
- [ ] Check that all buttons are visible and the text on them is clear
- [ ] Verify the "Launch App" or main CTA button is easy to find
- [ ] Check the page on mobile screen size — does everything still look good?

### Text & Messaging

- [ ] Is the value proposition easy to understand for someone new to DeFi?
- [ ] Are there any spelling or grammar mistakes?
- [ ] Is there any text that seems technical or confusing without explanation?
- [ ] Does every section have a clear purpose?

### Navigation & Links

- [ ] All links in the navigation bar work
- [ ] No broken links on the page
- [ ] Social media or external links (if any) open correctly

**Notes / Suggestions:**

```
[Write your observations here]
```

---

## Section 2 — Authentication (Connect Wallet)

> Goal: Confirm the wallet connection flow works smoothly and the app recognizes the connected wallet correctly.

### EVM Wallet (MetaMask)

- [ ] Click "Launch App" from the landing page
- [ ] The connection screen appears and offers a wallet option
- [ ] Click to connect MetaMask — the MetaMask popup appears
- [ ] After approving, the app redirects to the main interface (chat or portfolio)
- [ ] Your connected wallet address is visible somewhere on the screen

### TON Wallet (if applicable)

- [ ] TON Connect option is visible on the connection screen
- [ ] Clicking it shows the TON wallet options (Telegram Wallet, Tonkeeper, etc.)
- [ ] After connecting, the app recognizes the TON wallet

**Notes:**

```
[Write your observations here]
```

---

## Section 3 — Portfolio Page

> Goal: Verify that the portfolio correctly displays asset balances and positions.

### Asset Overview

- [ ] Navigate to the Portfolio page
- [ ] The page loads without errors
- [ ] A list of assets is shown (tokens with their balances)
- [ ] Compare the token balances displayed in the app with your MetaMask wallet
  - Values do not need to match exactly, but they should be close in total USD value
  - Note any tokens that appear in MetaMask but are missing from the app
  - Note any tokens that appear in the app but are not in your MetaMask

### Net Worth & Summary

- [ ] A total portfolio value (Net Worth) is shown
- [ ] The value is a reasonable estimate compared to your actual holdings
- [ ] 24h PnL or change indicator is visible (if available)

### Positions / Active Strategies

- [ ] A "Positions" section is visible (for lending, staking, or DCA positions)
- [ ] If you have active positions, they appear here
- [ ] Each position shows the protocol name, token, and amount
- [ ] "Manage" or action buttons on positions are visible and clickable (no need to execute)

### General UX

- [ ] The page fully loads within a reasonable time (under 10 seconds)
- [ ] No error messages or blank sections
- [ ] All token icons load correctly
- [ ] Values update if you navigate away and come back

**Notes:**

```
[Write your observations here]
```

---

## Section 4 — Swap

> Goal: Test token swaps across different networks. Always use amounts below $1 USD.

### General Checklist (apply to every network tested)

Before each swap, verify:
- [ ] The correct network is selected
- [ ] The banner/label inside the swap card matches the selected network and protocol
  - Example: Base → should show **"Powered by Aerodrome on Base"**
  - Example: Ethereum → should show the correct DEX label for Ethereum
  - Example: Avalanche → should show the correct label for Avalanche
- [ ] Token icons load correctly for both "from" and "to" tokens
- [ ] The estimated output amount appears after entering the input
- [ ] Slippage or fee info is shown before confirming

---

### 4.1 — Base Network (Test All Tokens)

> Test every token pair available on Base. The swap engine on Base uses Aerodrome.

**Available Base tokens to test:** ETH, WETH, USDC, USDT, cbBTC, DAI, AERO, VIRTUAL, msETH, EURC

- [ ] Switch to Base network in the swap interface
- [ ] Confirm the card shows: **"Powered by Aerodrome on Base"**

**Swap pairs to test (use amounts under $1 each time):**

- [ ] ETH → USDC
- [ ] ETH → USDT
- [ ] ETH → DAI
- [ ] ETH → AERO
- [ ] USDC → ETH
- [ ] USDC → USDT
- [ ] USDC → cbBTC
- [ ] USDC → AERO
- [ ] USDC → VIRTUAL
- [ ] WETH → USDC
- [ ] ETH → VIRTUAL
- [ ] ETH → msETH
- [ ] ETH → EURC

For each pair, confirm:
- [ ] Quote loads (estimated output appears)
- [ ] Transaction submitted successfully (check that the tx hash appears)
- [ ] After confirming, the swap shows as pending or confirmed
- [ ] No unexpected error messages during the flow

**Notes — Base:**

```
[Write your observations here — include any pairs that failed or showed weird behavior]
```

---

### 4.2 — Avalanche Network (Test All Tokens)

> Test every token available on Avalanche. Always under $1.

**Available Avalanche tokens:** AVAX, WAVAX, UNI, USDC, USDT, AAVE, BTC.b, JOE, MIM

- [ ] Switch to Avalanche network
- [ ] Confirm the network label on the swap card shows Avalanche correctly

**Swap pairs to test:**

- [ ] AVAX → USDC
- [ ] AVAX → USDT
- [ ] USDC → AVAX
- [ ] USDC → WAVAX
- [ ] USDC → UNI
- [ ] AVAX → AAVE
- [ ] WAVAX → USDT

For each pair, confirm:
- [ ] Quote loads correctly
- [ ] Transaction executes (or shows a clear error if it fails)
- [ ] No UI glitches or blank states

**Notes — Avalanche:**

```
[Write your observations here]
```

---

### 4.3 — Ethereum Network (Test All Tokens)

> Test every token available on Ethereum. Always under $1.

**Available Ethereum tokens:** ETH, stETH, wstETH, USDC, USDT, WBTC, AAVE, UNI, LINK, LDO, USDe

- [ ] Switch to Ethereum network
- [ ] Confirm the network label on the swap card shows Ethereum correctly

**Swap pairs to test:**

- [ ] ETH → USDC
- [ ] ETH → USDT
- [ ] USDC → ETH
- [ ] USDC → USDT
- [ ] ETH → WBTC
- [ ] ETH → AAVE
- [ ] ETH → LINK
- [ ] USDC → UNI
- [ ] ETH → stETH
- [ ] ETH → LDO

For each pair, confirm:
- [ ] Quote appears and is reasonable
- [ ] Transaction executes or shows a clear error

**Notes — Ethereum:**

```
[Write your observations here]
```

---

### 4.4 — Other Networks (Main Tokens Only)

> For these networks, testing a few main tokens is enough.

**Binance Smart Chain (BNB, USDT, USDC):**

- [ ] BNB → USDT
- [ ] BNB → USDC
- [ ] Network label correct on swap card

**Polygon (POL, USDC, USDT, WETH):**

- [ ] POL → USDC
- [ ] USDC → WETH
- [ ] Network label correct on swap card

**Arbitrum (ETH, USDC, USDT, ARB):**

- [ ] ETH → USDC
- [ ] ETH → ARB
- [ ] Network label correct on swap card

**Optimism (ETH, USDC, OP):**

- [ ] ETH → USDC
- [ ] ETH → OP
- [ ] Network label correct on swap card

**Notes — Other Networks:**

```
[Write your observations here]
```

---

### Swap — End of Section Report

> Fill this in after completing all swap tests.

**Overall Status:** `[ ] All good` / `[ ] Issues found`

| # | Issue Description | Network | Token Pair | Severity (Low/Med/High) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |

**User Experience Notes:**
- Errors that were confusing or not user-friendly:
- Suggestions to improve the flow:
- Anything that worked especially well:

---

## Section 5 — Lending (Benqi on Avalanche)

> Goal: Test the full lending flow — supply, borrow, and repay. Always under $1 USD.

> **Note:** There is a 10% validation fee on all lending operations. For example, if you supply $1, only $0.90 goes into the protocol. The app should always show this fee breakdown clearly before you confirm.

### Page & Market Overview

- [ ] Navigate to the Lending page
- [ ] The page loads without errors
- [ ] A list of available tokens/markets is shown (AVAX, USDC, USDT, etc.)
- [ ] Each token shows a **Supply APY** and a **Borrow APY**
- [ ] The numbers look realistic (not 0% or 9999%)
- [ ] Token icons load correctly

### Supply Flow

- [ ] Select a token to supply (e.g., AVAX or USDC)
- [ ] Enter an amount under $1
- [ ] **Verify the fee breakdown is visible** — the app must show:
  - Total amount entered
  - 10% validation fee
  - Net amount that will be supplied (90%)
- [ ] Confirm the transaction
- [ ] A success message appears (or a clear pending/error state)
- [ ] After completion, the supplied balance appears in "Your Positions" on the Portfolio or Lending page

### Withdraw Flow

- [ ] With an active supply position, navigate to the lending interface
- [ ] Find the option to withdraw the supplied amount
- [ ] Enter a small amount to withdraw (under $1)
- [ ] The 10% fee breakdown is shown again
- [ ] Confirm and verify the transaction completes
- [ ] The balance is updated in the interface

### Borrow Flow

> Note: To borrow, you need an existing supply as collateral.

- [ ] With an active supply position, find the borrow option
- [ ] Select a token to borrow (use a very small amount)
- [ ] The app shows the current Borrow APY
- [ ] The 10% fee breakdown is visible before confirming
- [ ] Confirm and verify the transaction goes through
- [ ] A "Health Factor" indicator appears and shows a safe value (above 1.5)
- [ ] Borrowed amount appears in positions

### Repay Flow

- [ ] With an active borrow position, find the repay option
- [ ] Enter the borrowed amount (or a portion of it)
- [ ] Fee breakdown is shown
- [ ] Confirm and verify the transaction completes
- [ ] Borrowed balance is reduced or cleared

### General UX

- [ ] All error messages are clear and helpful (not generic "Transaction failed")
- [ ] Loading states are shown while transactions process
- [ ] Health factor changes are visible after borrow/repay actions

**Notes:**

```
[Write your observations here]
```

---

### Lending — End of Section Report

**Overall Status:** `[ ] All good` / `[ ] Issues found`

| # | Issue Description | Action Tested | Severity (Low/Med/High) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**User Experience Notes:**
- Fee display was clear and understandable? (Yes/No and notes):
- Errors that were confusing or not user-friendly:
- Suggestions to improve the flow:

---

## Section 6 — Liquid Staking

> Goal: Test the staking flow for both Lido (Ethereum) and Benqi (Avalanche). Always under $1.

---

### 6.1 — Lido (Ethereum)

> Lido lets you stake ETH on Ethereum and receive stETH (or wstETH) in return. There is no lock period — staking rewards are automatically added to your stETH balance.

**Supported tokens:** ETH → stETH / wstETH

#### Page Overview

- [ ] Navigate to the Liquid Staking section and select Lido / Ethereum
- [ ] The page shows the current staking APY
- [ ] ETH, stETH, and wstETH are listed with their details
- [ ] Minimum stake information is visible

#### Stake Flow

- [ ] Enter a small ETH amount (under $1 equivalent — e.g., 0.0003 ETH)
- [ ] The estimated stETH output is shown
- [ ] Confirm the transaction
- [ ] Transaction completes and stETH balance appears in the interface
- [ ] Staking position is visible (staked amount, stETH balance)

#### Unstake Flow

- [ ] With a stETH balance, find the unstake option
- [ ] Enter a small stETH amount
- [ ] Confirm and verify the transaction goes through
- [ ] Balance is updated

#### General UX

- [ ] APY shows correctly (realistic value, not null or 0% without explanation)
- [ ] Error messages are clear if something fails
- [ ] Loading states are shown during transactions

**Notes — Lido:**

```
[Write your observations here]
```

---

### 6.2 — Benqi Liquid Staking (Avalanche)

> Benqi allows you to stake AVAX and receive sAVAX in return. sAVAX automatically earns staking rewards over time.

#### Page Overview

- [ ] Navigate to the Liquid Staking section and select Benqi / Avalanche
- [ ] The page shows the current APY for staking AVAX
- [ ] AVAX and sAVAX are listed with their details
- [ ] Available liquidity or total staked is visible

#### Stake Flow

- [ ] Enter a small AVAX amount (under $1 equivalent)
- [ ] The estimated sAVAX output is shown
- [ ] Confirm the transaction
- [ ] Transaction completes and sAVAX balance appears
- [ ] Staking position is visible in the interface or portfolio

#### Unstake Flow

- [ ] With a sAVAX balance, find the unstake option
- [ ] Enter a small sAVAX amount
- [ ] Confirm and verify the transaction completes
- [ ] Balance is updated

#### General UX

- [ ] UI clearly distinguishes between Lido (Ethereum) and Benqi (Avalanche)
- [ ] APY shows correctly
- [ ] Error messages are clear and helpful

**Notes — Benqi Staking:**

```
[Write your observations here]
```

---

### Liquid Staking — End of Section Report

**Overall Status:** `[ ] All good` / `[ ] Issues found`

| # | Issue Description | Protocol | Action | Severity (Low/Med/High) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

**User Experience Notes:**
- Was it clear which protocol/chain each staking option uses?
- Errors that were confusing:
- Suggestions to improve:

---

## Section 7 — DCA (Dollar Cost Averaging)

> Goal: Create a daily DCA strategy, observe it execute automatically the following day, then cancel it.

> DCA allows you to automatically buy a token at a fixed schedule (daily, weekly, monthly). The app uses a Smart Wallet to execute trades without requiring your signature every time.

### Smart Wallet Setup (if not done yet)

- [ ] Navigate to the DCA page or Smart Wallets page
- [ ] If no smart wallet exists, the app shows a clear message guiding you to create one
- [ ] Create a Smart Wallet (this may require a one-time transaction to confirm)
- [ ] The smart wallet address is displayed after creation

### Create a DCA Strategy

- [ ] Click "Create Strategy" or the equivalent button
- [ ] A modal/form appears with the following options:
  - [ ] Select the Smart Wallet to use
  - [ ] Select the "From" token (the token you spend)
  - [ ] Select the "To" token (the token you want to accumulate)
  - [ ] Enter the amount (use a very small value, under $1)
  - [ ] Select the interval: **Daily**
- [ ] Confirm the creation
- [ ] The strategy appears in the strategy list with status **Active**
- [ ] The "Next Execution" date/time is shown and makes sense (within 24 hours)

### Verify the Strategy on Day 1

- [ ] The strategy card shows:
  - Token pair (from → to)
  - Amount per execution
  - Interval (Daily)
  - Status (Active)
  - Next execution time
- [ ] Navigate to Portfolio — the DCA position appears there
- [ ] No error in the strategy details

### Check Execution on Day 2

> Come back to the app the following day to check if the strategy executed automatically.

- [ ] The strategy shows a successful execution in the **Execution History**
- [ ] The history entry shows: timestamp, transaction hash, amount, status (success)
- [ ] The "Next Execution" time has moved forward by one day
- [ ] The "To" token balance in your portfolio reflects the new amount purchased

### Cancel the Strategy

- [ ] Find the delete/cancel option on the strategy card
- [ ] The app asks for confirmation before deleting (no accidental deletions)
- [ ] Confirm the deletion
- [ ] The strategy is removed from the list
- [ ] A success message is shown

### General UX

- [ ] Is the DCA setup process easy to understand for a new user?
- [ ] Is the "Smart Wallet required" message clear for users who haven't created one?
- [ ] Are transaction hashes visible in the execution history?
- [ ] Are errors shown in a user-friendly way?

**Notes:**

```
[Write your observations here]
```

---

### DCA — End of Section Report

**Overall Status:** `[ ] All good` / `[ ] Issues found`

| # | Issue Description | Step | Severity (Low/Med/High) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**User Experience Notes:**
- Smart wallet creation was clear and straightforward? (Yes/No):
- Was the strategy setup form easy to use?
- Did the execution history appear correctly after Day 2?
- Errors that were confusing:
- Suggestions to improve:

---

## Section 8 — Yield (Liquidity Pools on Base)

> Goal: Test entering a liquidity pool, monitoring the position, claiming rewards, and exiting. Always use amounts under $1.

> The Yield product uses Aerodrome pools on Base. You provide liquidity to a token pair and earn AERO rewards over time.

### Page & Pool Overview

- [ ] Navigate to the Yield page
- [ ] A list of available pools is shown (token pair names, APR, total liquidity)
- [ ] Each pool shows an estimated APR
- [ ] APR values look realistic (not 0 or unreasonably high without explanation)
- [ ] Pool names clearly show the two tokens involved (e.g., ETH/USDC, USDC/AERO)

### Enter a Pool (Provide Liquidity)

- [ ] Select a pool to enter (e.g., ETH/USDC or USDC/AERO)
- [ ] The "Enter" flow starts — a form or panel appears
- [ ] The app explains what tokens you need to provide
- [ ] Enter small amounts for both tokens (under $1 total)
- [ ] A summary of the operation is shown before confirming
- [ ] Confirm the transaction(s) — there may be multiple steps (approve + enter)
- [ ] The transaction completes and the position appears in the interface

### Monitor Position

- [ ] Your active position is visible on the Yield page or Portfolio
- [ ] The position shows:
  - Pool name
  - Amount of LP tokens staked
  - Pending rewards (AERO)
  - Token balances in the pool
- [ ] Rewards accumulate over time (even if small)

### Claim Rewards

- [ ] With an active position, find the "Claim" rewards option
- [ ] Enter the claim action
- [ ] The transaction completes
- [ ] Claimed AERO or reward tokens appear in your wallet balance

### Exit the Pool (Remove Liquidity)

- [ ] Find the "Exit" option on your active position
- [ ] Enter the exit flow
- [ ] Confirm the transaction(s)
- [ ] The position is removed from the list
- [ ] Token balances are returned to your wallet

### General UX

- [ ] Is it clear what "entering a pool" means for a less experienced user?
- [ ] Is the multi-step transaction flow (approve + enter) clearly explained?
- [ ] Are error messages clear and helpful?

**Notes:**

```
[Write your observations here]
```

---

### Yield — End of Section Report

**Overall Status:** `[ ] All good` / `[ ] Issues found`

| # | Issue Description | Step | Severity (Low/Med/High) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**User Experience Notes:**
- Was the pool selection and entry flow easy to understand?
- Was the multi-step flow (if any) clearly communicated?
- Did rewards appear and claim correctly?
- Errors that were confusing:
- Suggestions to improve:

---

## Phase 01 — Final Summary Report

> Complete this section after finishing all products above.

**Tester Name:**  
**Testing Date:**  
**App Version / Build:**  
**Wallet Used:**  

---

### Overall Status per Section

| Section | Status | Critical Issues |
|---|---|---|
| Landing Page | `[ ] Pass` / `[ ] Issues` | |
| Authentication | `[ ] Pass` / `[ ] Issues` | |
| Portfolio | `[ ] Pass` / `[ ] Issues` | |
| Swap | `[ ] Pass` / `[ ] Issues` | |
| Lending | `[ ] Pass` / `[ ] Issues` | |
| Liquid Staking — Lido | `[ ] Pass` / `[ ] Issues` | |
| Liquid Staking — Benqi | `[ ] Pass` / `[ ] Issues` | |
| DCA | `[ ] Pass` / `[ ] Issues` | |
| Yield | `[ ] Pass` / `[ ] Issues` | |

---

### Top Issues Found

> List the most important issues here, regardless of which section they came from.

| Priority | Product | Description | Expected Behavior | Actual Behavior |
|---|---|---|---|---|
| High | | | | |
| High | | | | |
| Medium | | | | |
| Medium | | | | |
| Low | | | | |
| Low | | | | |

---

### General User Experience Observations

**What felt smooth and worked well:**

```
[Write here]
```

**What was confusing or hard to understand:**

```
[Write here]
```

**Error messages that were not user-friendly (list them):**

```
[Write here]
```

**Suggestions to improve the overall experience:**

```
[Write here]
```

---

*End of Phase 01 Testing Guide*
