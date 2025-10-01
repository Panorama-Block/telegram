export interface AuthData {
  address: string;
  sessionKeyAddress: string;
  loginPayload: string;
  signature: string;
  telegram_user_id: string;
}

export interface AuthResult {
  id: string;
  username?: string;
  language_code?: string;
  auth_date: number;
  valid: boolean;
  zico_user_id: string;
}

export async function verifyTelegramAuth(authData: AuthData): Promise<AuthResult> {
  // For now, return a mock result
  // In production, this would verify the signature and session key
  console.log('🔐 [AUTH] Verifying auth data:', {
    address: authData.address,
    sessionKeyAddress: authData.sessionKeyAddress,
    telegram_user_id: authData.telegram_user_id
  });

  // Mock verification - in production, verify the signature
  const isValid = authData.address && authData.sessionKeyAddress && authData.signature;
  
  if (!isValid) {
    throw new Error('Invalid authentication data');
  }

  // Generate a mock zico_user_id based on the address
  const zicoUserId = `zico_${authData.address.slice(2, 8)}`;

  return {
    id: authData.telegram_user_id,
    username: 'user',
    language_code: 'pt',
    auth_date: Math.floor(Date.now() / 1000),
    valid: true,
    zico_user_id: zicoUserId
  };
}
