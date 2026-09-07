import React, { useState } from 'react';
import { authService } from '../utils/auth';
import './AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialMessage?: string;
  initialTab?: AuthTab;
}

export type AuthTab = 'login' | 'register' | 'redeem';

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, initialMessage, initialTab = 'login' }) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  const [error, setError] = useState<string>(initialMessage || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (activeTab === 'login') {
        const res = await authService.login(username, password);
        if (res.success && res.token) {
          authService.setToken(res.token);
          onClose();
          onSuccess();
        } else {
          setError(res.error || '登录失败');
        }
      } else if (activeTab === 'register') {
        const res = await authService.register(username, password, inviteCode);
        if (res.success && res.token) {
          authService.setToken(res.token);
          onClose();
          onSuccess();
        } else {
          setError(res.error || '注册失败');
        }
      } else {
        const res = await authService.redeemInvite(inviteCode);
        if (res.success) {
          onClose();
          onSuccess();
        } else {
          setError(res.error || '邀请码兑换失败');
        }
      }
    } catch (err) {
      setError('网络异常，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={e => e.stopPropagation()}>
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setError(''); }}
            type="button"
          >
            登录
          </button>
          <button 
            className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setError(''); }}
            type="button"
          >
            使用邀请码注册
          </button>
          {authService.getToken() && (
            <button
              className={`auth-tab ${activeTab === 'redeem' ? 'active' : ''}`}
              onClick={() => { setActiveTab('redeem'); setError(''); }}
              type="button"
            >
              续期
            </button>
          )}
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          {activeTab !== 'redeem' && (
            <>
              <div className="form-group">
                <label htmlFor="username">用户名</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名（3–64 个字符）"
                  minLength={3}
                  maxLength={64}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">密码</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码（至少 8 个字符）"
                  minLength={8}
                  maxLength={128}
                  autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </div>
            </>
          )}

          {(activeTab === 'register' || activeTab === 'redeem') && (
            <div className="form-group">
              <label htmlFor="inviteCode">邀请码</label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="请输入邀请码"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={64}
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className="auth-submit-btn" 
            disabled={isLoading}
          >
            {isLoading ? '请稍候...' : (activeTab === 'login' ? '登录' : activeTab === 'register' ? '注册' : '兑换并续期')}
          </button>
        </form>

        {(activeTab === 'register' || activeTab === 'redeem') && (
          <div className="auth-purchase-link">
            <a onClick={() => alert("暂无购买链接，请联系管理员")}>［点击此处 9.9元获取授权码］</a>
          </div>
        )}

      </div>
    </div>
  );
};

export default AuthModal;
