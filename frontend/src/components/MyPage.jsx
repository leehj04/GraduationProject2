import React, { useState, useEffect } from 'react';
import {
  X, User, Lock, Star, Users, MapPin, Save,
  Loader2, CheckCircle, AlertCircle, ChevronLeft
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const NATIONALITIES = [
  '대한민국', '미국', '영국', '일본', '중국', '독일', '프랑스',
  '이탈리아', '오스트리아', '네덜란드', '스페인', '러시아', '기타'
];

const TABS = [
  { id: 'profile',    label: '회원정보 수정', icon: User },
  { id: 'password',   label: '비밀번호 변경', icon: Lock },
  { id: 'reviews',    label: '내 후기',        icon: Star },
  { id: 'companions', label: '내 동행글',      icon: Users },
];

export default function MyPage({ onClose }) {
  const [activeTab, setActiveTab] = useState('profile');
  const { user, login } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 */}
      <div className="relative w-full max-w-lg bg-[#111827] border border-white/10 rounded-2xl
                      shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#f5c842]" />
            <h2 className="font-serif font-bold text-white text-lg">마이페이지</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20
                       flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* 사용자 정보 요약 */}
        <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20
                            flex items-center justify-center">
              <User className="w-6 h-6 text-[#f5c842]" />
            </div>
            <div>
              <p className="text-white font-semibold">{user?.name}</p>
              <p className="text-white/40 text-xs">{user?.email}</p>
              <div className="flex gap-2 mt-1">
                {user?.age && <span className="text-white/30 text-xs">{user.age}세</span>}
                {user?.gender && <span className="text-white/30 text-xs">{user.gender}</span>}
                {user?.nationality && <span className="text-white/30 text-xs">{user.nationality}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-white/10 flex-shrink-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap
                            transition-all border-b-2 flex-shrink-0
                            ${activeTab === tab.id
                              ? 'text-[#f5c842] border-[#f5c842]'
                              : 'text-white/40 border-transparent hover:text-white'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profile' && <ProfileTab user={user} onUpdate={(updatedUser) => {
            login(localStorage.getItem('token'), updatedUser);
          }} />}
          {activeTab === 'password' && <PasswordTab />}
          {activeTab === 'reviews' && <MyReviews navigate={navigate} onClose={onClose} />}
          {activeTab === 'companions' && <MyCompanions navigate={navigate} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

/* ── 회원정보 수정 ─────────────────────────────── */
function ProfileTab({ user, onUpdate }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    age: user?.age || '',
    gender: user?.gender || '',
    nationality: user?.nationality || '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const { data } = await api.put('/api/auth/profile', {
        ...form,
        age: form.age ? parseInt(form.age) : null,
      });
      onUpdate(data.user);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || '수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
      <div>
        <label className="block text-white/50 text-xs mb-1.5">이름 *</label>
        <input
          type="text"
          className="input-field text-sm"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-white/50 text-xs mb-1.5">나이</label>
          <input
            type="number"
            className="input-field text-sm"
            min="1" max="120"
            value={form.age}
            onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-white/50 text-xs mb-1.5">성별</label>
          <select
            className="input-field text-sm bg-[#1a1f35]"
            value={form.gender}
            onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
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
        <label className="block text-white/50 text-xs mb-1.5">국적</label>
        <select
          className="input-field text-sm bg-[#1a1f35]"
          value={form.nationality}
          onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
        >
          <option value="">선택하세요</option>
          {NATIONALITIES.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30
                        rounded-lg px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30
                        rounded-lg px-4 py-3 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          회원정보가 수정되었습니다!
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        저장
      </button>
    </form>
  );
}

/* ── 비밀번호 변경 ─────────────────────────────── */
function PasswordTab() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await api.put('/api/auth/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setSuccess(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || '비밀번호 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
      <div>
        <label className="block text-white/50 text-xs mb-1.5">현재 비밀번호</label>
        <input
          type="password"
          className="input-field text-sm"
          placeholder="현재 비밀번호 입력"
          value={form.currentPassword}
          onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
          required
        />
      </div>
      <div>
        <label className="block text-white/50 text-xs mb-1.5">새 비밀번호</label>
        <input
          type="password"
          className="input-field text-sm"
          placeholder="최소 6자 이상"
          value={form.newPassword}
          onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
          minLength={6}
          required
        />
      </div>
      <div>
        <label className="block text-white/50 text-xs mb-1.5">새 비밀번호 확인</label>
        <input
          type="password"
          className="input-field text-sm"
          placeholder="새 비밀번호 재입력"
          value={form.confirmPassword}
          onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
          required
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30
                        rounded-lg px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30
                        rounded-lg px-4 py-3 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          비밀번호가 변경되었습니다!
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        비밀번호 변경
      </button>
    </form>
  );
}

/* ── 내 후기 ───────────────────────────────────── */
function MyReviews({ navigate, onClose }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/reviews/my')
      .then(r => setReviews(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const deleteReview = async (e, review) => {
    e.stopPropagation();
    await api.delete(`/api/reviews/${review.concert_id}`);
    setReviews(prev => prev.filter(r => r.id !== review.id));
  };

  if (loading) return <LoadingSpinner />;

  if (reviews.length === 0) return (
    <EmptyState icon={<Star className="w-12 h-12 text-white/20" />}
      message="작성한 후기가 없습니다." />
  );

  return (
    <div className="px-6 py-5 space-y-3">
      {reviews.map(review => (
        <div
          key={review.id}
          onClick={() => {
            onClose();
            navigate(`/map/${review.musician_id}`, { state: { selectedConcertId: review.concert_id } });
          }}
          className="bg-white/5 border border-white/8 rounded-xl p-4 cursor-pointer
                     hover:bg-white/10 hover:border-[#f5c842]/25 transition-all"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{review.venue_name}</p>
              <p className="text-white/40 text-xs mt-0.5">
                {review.musician_name_ko || review.musician_name} · {formatDate(review.concert_date)}
              </p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-[#f5c842] fill-[#f5c842]' : 'text-white/20'}`} />
              ))}
            </div>
          </div>
          {review.content && (
            <p className="text-white/50 text-xs line-clamp-2 mb-2">{review.content}</p>
          )}
          <div className="flex justify-between items-center">
            <p className="text-white/25 text-xs">{formatDate(review.created_at)}</p>
            <button
              onClick={e => deleteReview(e, review)}
              className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
            >삭제</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 내 동행글 ─────────────────────────────────── */
function MyCompanions({ navigate, onClose }) {
  const [companions, setCompanions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/companions/my')
      .then(r => setCompanions(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const deleteCompanion = async (e, id) => {
    e.stopPropagation();
    await api.delete(`/api/companions/${id}`);
    setCompanions(prev => prev.filter(c => c.id !== id));
  };

  if (loading) return <LoadingSpinner />;

  if (companions.length === 0) return (
    <EmptyState icon={<Users className="w-12 h-12 text-white/20" />}
      message="작성한 동행 구하기 글이 없습니다." />
  );

  return (
    <div className="px-6 py-5 space-y-3">
      {companions.map(post => (
        <div
          key={post.id}
          onClick={() => {
            onClose();
            navigate(`/map/${post.musician_id}`, {
              state: { selectedConcertId: post.concert_id, openCompanion: true }
            });
          }}
          className="bg-white/5 border border-white/8 rounded-xl p-4 cursor-pointer
                     hover:bg-white/10 hover:border-[#f5c842]/25 transition-all"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3 h-3 text-white/30" />
            <p className="text-white/40 text-xs truncate">
              {post.venue_name} · {post.musician_name_ko || post.musician_name} · {formatDate(post.concert_date)}
            </p>
          </div>
          <p className="text-white font-semibold text-sm mb-1">{post.title}</p>
          <p className="text-white/50 text-xs line-clamp-2">{post.content}</p>
          <div className="flex justify-between items-center mt-2">
            <p className="text-white/25 text-xs">{formatDate(post.created_at)}</p>
            <button
              onClick={e => deleteCompanion(e, post.id)}
              className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
            >삭제</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-[#f5c842] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="mb-4">{icon}</div>
      <p className="text-white/40 text-sm">{message}</p>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}
