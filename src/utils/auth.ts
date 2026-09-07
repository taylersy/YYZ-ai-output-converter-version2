const BASE_URL = 'https://yyz-ai-output-conventer-version2.auth.taylersy.com';

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: any;
  message?: string;
  error?: string;
}

export interface PermissionResponse {
  allowed: boolean;
  reason?: string;
  vip_expire_time?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  'Invalid invite code': '邀请码无效，请检查后重试',
  'Invite code has already been used': '该邀请码已被使用，请更换新的邀请码',
  'Username already exists': '用户名已存在，请更换用户名',
  'Invalid username or password': '用户名或密码错误',
  'Username must be 3-64 characters': '用户名长度需为 3–64 个字符',
  'Password must be 8-128 characters': '密码长度需为 8–128 个字符',
};

function localizedError(error: unknown, fallback: string): string {
  return typeof error === 'string' ? (ERROR_MESSAGES[error] || error) : fallback;
}

export const authService = {
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token: string) {
    localStorage.setItem('token', token);
  },

  clearToken() {
    localStorage.removeItem('token');
  },

  async register(username: string, password: string, invite_code: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, invite_code }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { error: '服务器响应格式错误' };
      }
      
      if (!response.ok) {
        return { success: false, error: localizedError(data.error, '注册失败') };
      }
      return data;
    } catch (err) {
      console.error('Register error:', err);
      return { success: false, error: '网络异常，请稍后重试' };
    }
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { error: '服务器响应格式错误' };
      }

      if (!response.ok) {
        return { success: false, error: localizedError(data.error, '登录失败，请检查用户名和密码') };
      }
      return data;
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: '网络异常，请稍后重试' };
    }
  },

  async redeemInvite(invite_code: string): Promise<AuthResponse> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: '登录状态已失效，请重新登录' };
    }

    try {
      const response = await fetch(`${BASE_URL}/api/redeem-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ invite_code }),
      });
      const data = await response.json().catch(() => ({ error: '服务器响应格式错误' }));
      if (!response.ok) {
        return { success: false, error: localizedError(data.error, '邀请码兑换失败') };
      }
      return data;
    } catch (err) {
      console.error('Redeem invite error:', err);
      return { success: false, error: '网络异常，请稍后重试' };
    }
  },

  async checkPermission(): Promise<PermissionResponse> {
    const token = this.getToken();
    if (!token) {
      return { allowed: false, reason: 'unauthorized' };
    }

    try {
      const response = await fetch(`${BASE_URL}/api/check-permission`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errorMsg = 'unauthorized';
        try {
          const data = await response.json();
          errorMsg = data.reason || data.error || errorMsg;
        } catch (e) {
          // 如果解析 JSON 失败，说明后端返回了纯文本错误
        }
        return { allowed: false, reason: errorMsg };
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Check permission error:', err);
      return { allowed: false, reason: 'network_error' };
    }
  }
};
