export function getLinkSuccessText(zicoUserId: string): string {
  return `✅ *Carteira conectada com sucesso!*\n\n` +
         `ID: \`${zicoUserId}\`\n\n` +
         `Agora você pode usar o bot para fazer swaps de tokens. ` +
         `Use /swap para começar!`;
}

export function getTutorialMessages(): string[] {
  return [
    `📚 *Como usar o bot:*\n\n` +
    `• /swap - Iniciar um swap de tokens\n` +
    `• /balance - Ver saldo da carteira\n` +
    `• /help - Ver todos os comandos\n\n` +
    `💡 *Dica:* Use /swap para trocar tokens entre diferentes blockchains!`,
    
    `🔗 *Blockchains suportadas:*\n\n` +
    `• Ethereum (Sepolia)\n` +
    `• Polygon (Mumbai)\n` +
    `• BSC (Testnet)\n\n` +
    `Mais blockchains serão adicionadas em breve!`
  ];
}
