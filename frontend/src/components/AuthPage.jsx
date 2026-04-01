import React, { useState } from 'react';
import { Music, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

const NATIONALITIES = [
  '대한민국', '미국', '영국', '일본', '중국', '독일', '프랑스',
  '이탈리아', '오스트리아', '네덜란드', '스페인', '러시아', '기타'
];

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({
    email: '', password: '', name: '',
    age: '', gender: '', nationality: ''
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { ...form, age: form.age ? parseInt(form.age) : undefined };

      const { data } = await api.post(endpoint, payload);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || '오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#f5c842]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img
              src="/logo.png"
              alt="ClassicTour"
              className="w-36 h-36 object-contain drop-shadow-lg"
            />
          </div>
          <p className="text-white/40 text-sm mt-1">클래식 공연 투어 트래커</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          {/* Tab Switch */}
          <div className="flex mb-6 bg-white/5 rounded-xl p-1">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                  setForm({ email: '', password: '', name: '', age: '', gender: '', nationality: '' });
                  setShowPw(false);
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${mode === m ? 'bg-[#f5c842] text-[#0a0e1a]' : 'text-white/50 hover:text-white'}`}
              >
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">이메일</label>
              <input
                type="email"
                className="input-field"
                placeholder="your@email.com"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder={mode === 'register' ? '최소 6자 이상' : '비밀번호 입력'}
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  required
                  minLength={mode === 'register' ? 6 : 1}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Register-only fields */}
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">이름</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="홍길동"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">나이</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="25"
                      min="1" max="120"
                      value={form.age}
                      onChange={e => update('age', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">성별</label>
                    <select
                      className="input-field"
                      value={form.gender}
                      onChange={e => update('gender', e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="남성">남성</option>
                      <option value="여성">여성</option>
                      <option value="기타">기타</option>
                      <option value="비공개">비공개</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1.5">국적</label>
                  <select
                    className="input-field"
                    value={form.nationality}
                    onChange={e => update('nationality', e.target.value)}
                  >
                    <option value="">선택하세요</option>
                    {NATIONALITIES.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          © {new Date().getFullYear()} ClassicTour. 클래식 음악을 사랑하는 모든 이를 위해.
        </p>
      </div>
    </div>
  );
}
