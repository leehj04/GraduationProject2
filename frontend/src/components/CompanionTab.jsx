import React, { useState, useEffect, useRef } from 'react';
import { PenSquare, X, Loader2, User, ChevronLeft, Send, MessageSquare, Trash2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function CompanionTab({ concertId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'write' | 'detail'
  const [selectedPost, setSelectedPost] = useState(null);
  const { user } = useAuth();

  const loadPosts = () => {
    setLoading(true);
    api.get(`/api/companions/${concertId}`)
      .then(r => setPosts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPosts(); }, [concertId]);

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
    setView('list');
  };

  const handleDeletePost = async (postId) => {
    await api.delete(`/api/companions/${postId}`);
    setPosts(prev => prev.filter(p => p.id !== postId));
    setView('list');
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col relative">
      {/* Sub header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 flex-shrink-0">
        {view !== 'list' && (
          <button
            onClick={() => setView('list')}
            className="text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <h3 className="text-white/70 text-sm font-medium">
          {view === 'write' ? '동행 구하기 글쓰기' : view === 'detail' ? '게시글' : `동행 구하기 (${posts.length})`}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === 'list' && (
          <PostList
            posts={posts}
            loading={loading}
            currentUser={user}
            onSelectPost={(post) => { setSelectedPost(post); setView('detail'); }}
          />
        )}
        {view === 'write' && (
          <WritePost concertId={concertId} onCreated={handlePostCreated} onCancel={() => setView('list')} />
        )}
        {view === 'detail' && selectedPost && (
          <PostDetail
            post={selectedPost}
            currentUser={user}
            onDelete={handleDeletePost}
          />
        )}
      </div>

      {/* Floating write button */}
      {view === 'list' && user && (
        <button
          onClick={() => setView('write')}
          className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#f5c842] hover:bg-[#e6b800]
                     flex items-center justify-center shadow-lg transition-all duration-200
                     hover:scale-105 active:scale-95"
          title="글쓰기"
        >
          <PenSquare className="w-5 h-5 text-[#0a0e1a]" />
        </button>
      )}
    </div>
  );
}

/* ── 글 목록 ─────────────────────────────────── */
function PostList({ posts, loading, currentUser, onSelectPost }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-[#f5c842] animate-spin" />
    </div>
  );

  if (posts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <User className="w-7 h-7 text-white/20" />
      </div>
      <p className="text-white/40 text-sm">아직 동행 구하기 글이 없습니다.</p>
      <p className="text-white/25 text-xs mt-1">아래 버튼을 눌러 글을 작성해보세요!</p>
    </div>
  );

  return (
    <div className="px-4 py-4 space-y-2">
      {posts.map(post => (
        <button
          key={post.id}
          onClick={() => onSelectPost(post)}
          className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/8
                     hover:border-white/20 rounded-xl p-4 transition-all duration-200"
        >
          <h4 className="text-white font-semibold text-sm leading-tight truncate">{post.title}</h4>
          <p className="text-white/50 text-xs mt-1.5 line-clamp-2 leading-relaxed">{post.content}</p>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-[#f5c842]/20 flex items-center justify-center">
                <User className="w-3 h-3 text-[#f5c842]" />
              </div>
              <span className="text-white/40 text-xs">{post.author_name}</span>
            </div>
            <span className="text-white/25 text-xs">{formatTimeAgo(post.created_at)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── 글 상세 + 댓글 ───────────────────────────── */
function PostDetail({ post, currentUser, onDelete }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get(`/api/companions/${post.id}/comments`)
      .then(r => setComments(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [post.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/api/companions/${post.id}/comments`, { content });
      setComments(prev => [...prev, data]);
      setContent('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    await api.delete(`/api/companions/comments/${commentId}`);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5">
          {/* 글 제목 */}
          <div className="flex items-start justify-between gap-2 mb-4">
            <h3 className="font-serif text-lg font-bold text-white leading-tight">{post.title}</h3>
            {/* 내 글이면 삭제 버튼 */}
            {currentUser?.id === post.user_id && (
              <button
                onClick={() => onDelete(post.id)}
                className="flex-shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                title="글 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 작성자 정보 */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-3">작성자 정보</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20
                              flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-[#f5c842]" />
              </div>
              <div className="space-y-1">
                <p className="text-white font-semibold text-sm">{post.author_name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {post.author_age && (
                    <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full">
                      {post.author_age}세
                    </span>
                  )}
                  {post.author_gender && (
                    <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full">
                      {post.author_gender}
                    </span>
                  )}
                  {post.author_nationality && (
                    <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full">
                      {post.author_nationality}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 본문 */}
          <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap mb-2">{post.content}</p>
          <p className="text-white/25 text-xs mb-6">{new Date(post.created_at).toLocaleString('ko-KR')}</p>

          {/* 댓글 섹션 */}
          <div className="border-t border-white/10 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-white/40" />
              <p className="text-white/40 text-sm font-medium">댓글 {comments.length}개</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-[#f5c842] animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-white/25 text-xs text-center py-6">첫 댓글을 남겨보세요!</p>
            ) : (
              <div className="space-y-3 mb-4">
                {comments.map(comment => (
                  <div key={comment.id}
                    className="bg-white/5 border border-white/8 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20
                                        flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-[#f5c842]" />
                        </div>
                        <div>
                          <span className="text-white/70 text-xs font-medium">{comment.author_name}</span>
                          <div className="flex gap-1.5 mt-0.5">
                            {comment.author_age && (
                              <span className="text-white/30 text-[10px]">{comment.author_age}세</span>
                            )}
                            {comment.author_gender && (
                              <span className="text-white/30 text-[10px]">{comment.author_gender}</span>
                            )}
                            {comment.author_nationality && (
                              <span className="text-white/30 text-[10px]">{comment.author_nationality}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* 내 댓글이면 삭제 */}
                      {currentUser?.id === comment.user_id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-400/40 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{comment.content}</p>
                    <p className="text-white/20 text-xs mt-2">{formatTimeAgo(comment.created_at)}</p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 댓글 입력창 — 하단 고정 */}
      {currentUser && (
        <div className="flex-shrink-0 border-t border-white/10 px-4 py-3 bg-[#0a0e1a]">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="flex-1 bg-white/8 border border-white/15 rounded-xl px-3 py-2
                         text-white text-sm placeholder-white/30
                         focus:outline-none focus:border-[#f5c842]/50"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="w-10 h-10 rounded-xl bg-[#f5c842] hover:bg-[#e6b800]
                         flex items-center justify-center transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {submitting
                ? <Loader2 className="w-4 h-4 text-[#0a0e1a] animate-spin" />
                : <Send className="w-4 h-4 text-[#0a0e1a]" />
              }
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ── 글쓰기 ──────────────────────────────────── */
function WritePost({ concertId, onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('제목과 본문을 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/companions', {
        concert_id: concertId,
        title: title.trim(),
        content: content.trim()
      });
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || '글 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
      <div>
        <label className="block text-white/50 text-xs mb-1.5">제목</label>
        <input
          type="text"
          className="input-field text-sm"
          placeholder="제목을 입력하세요 (최대 100자)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
          required
        />
        <p className="text-white/20 text-xs mt-1 text-right">{title.length}/100</p>
      </div>

      <div>
        <label className="block text-white/50 text-xs mb-1.5">본문</label>
        <textarea
          className="input-field text-sm resize-none"
          rows={7}
          placeholder={`동행을 구하는 글을 작성하세요.\n\n예시)\n- 원하는 동행 조건 (나이, 성별 등)\n- 연락 방법 (이메일, 오픈카톡 링크 등)\n- 좌석 위치나 기타 조건`}
          value={content}
          onChange={e => setContent(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-xs">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border border-white/15 text-white/60
                     hover:bg-white/10 transition-colors text-sm"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          등록
        </button>
      </div>
    </form>
  );
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return '방금 전';
  if (mins < 60)  return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}
