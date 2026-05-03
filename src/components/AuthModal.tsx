import React, { useState } from 'react';
import { authService } from '../utils/auth';
import './AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialMessage?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, initialMessage }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
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
          onSuccess();
          onClose();
        } else {
          setError(res.error || '登录失败');
        }
      } else {
        const res = await authService.register(username, password, inviteCode);
        if (res.success && res.token) {
          authService.setToken(res.token);
          onSuccess();
          onClose();
        } else {
          setError(res.error || '注册失败');
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
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
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
              placeholder="请输入密码"
              required
            />
          </div>

          {activeTab === 'register' && (
            <div className="form-group">
              <label htmlFor="inviteCode">邀请码</label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="请输入邀请码"
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className="auth-submit-btn" 
            disabled={isLoading}
          >
            {isLoading ? '请稍候...' : (activeTab === 'login' ? '登录' : '注册')}
          </button>
        </form>

        {activeTab === 'register' && (
          <div className="auth-purchase-link">
            <a onClick={() => alert("暂无购买链接，请联系管理员")}>［点击此处 9.9元获取授权码］</a>
          </div>
        )}

      </div>
    </div>
  );
};

export default AuthModal;
