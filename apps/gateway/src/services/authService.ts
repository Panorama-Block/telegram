export interface AuthData {
  address: string;
  sessionKeyAddress: string;
  loginPayload: any; // Changed from string to any to accept object
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
  jwt_token?: string;
}

export async function verifyTelegramAuth(authData: AuthData): Promise<AuthResult> {
  console.log('🔐 [AUTH] Verifying auth data with auth-service:', {
    address: authData.address,
    sessionKeyAddress: authData.sessionKeyAddress,
    telegram_user_id: authData.telegram_user_id
  });

  try {
    // Call the auth-service to verify the signature
    const authServiceUrl = process.env.AUTH_API_BASE || 'http://localhost:3301';
    
    const response = await fetch(`${authServiceUrl}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: authData.loginPayload, // Already an object, no need to parse
        signature: authData.signature
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as { error?: string };
      throw new Error(`Auth service error: ${errorData.error || response.statusText}`);
    }

    const authResult = await response.json() as { 
      address: string; 
      sessionId: string; 
      token?: string; 
    };
    
    console.log('✅ [AUTH] Authentication successful with auth-service:', {
      address: authResult.address,
      sessionId: authResult.sessionId,
      tokenLength: authResult.token?.length || 0
    });

    // Return the real JWT token from auth-service
    return {
      id: authData.telegram_user_id,
      username: 'user',
      language_code: 'pt',
      auth_date: Math.floor(Date.now() / 1000),
      valid: true,
      zico_user_id: authResult.address, // Use address as user ID
      jwt_token: authResult.token // Return the real JWT
    };

  } catch (error: any) {
    console.error('❌ [AUTH] Authentication failed:', error.message);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}
