import React, { useState, useEffect } from 'react';
import { Star, Loader2, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api';

export default function ReviewSection({ concertId }) {
  const [reviews, setReviews]       = useState([]);
  const [avgRating, setAvgRating]   = useState(null);
  const [myReview, setMyReview]     = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [showAll, setShowAll]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formContent, setFormContent] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const loadReviews = async () => {
    try {
      const [rRes, mRes] = await Promise.all([
        api.get(`/api/reviews/${concertId}`),
        api.get(`/api/reviews/${concertId}/mine`),
      ]);
      setReviews(rRes.data.reviews);
      setAvgRating(rRes.data.avgRating);
      setMyReview(mRes.data);
      if (mRes.data) {
        setFormRating(mRes.data.rating);
        setFormContent(mRes.data.content || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReviews(); }, [concertId]);

  const handleSubmit = async () => {
    if (!formRating) return;
    setSaving(true);
    try {
      const saved = await api.post(`/api/reviews/${concertId}`, {
        rating: formRating,
        content: formContent.trim() || undefined,
      });
      setMyReview(saved.data);
      setShowForm(false);
      await loadReviews();
    } catch (err) {
      alert(err.response?.data?.error || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('후기를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/api/reviews/${concertId}`);
      setMyReview(null);
      setFormRating(5);
      setFormContent('');
      await loadReviews();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const visibleReviews = showAll ? reviews : reviews.slice(0, 3);

  return (
    <div className="mt-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
            공연 후기
          </p>
          {avgRating && (
            <div className="flex items-center gap-1 bg-[#f5c842]/10 px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 text-[#f5c842] fill-[#f5c842]" />
              <span className="text-[#f5c842] text-xs font-bold">{avgRating}</span>
              <span className="text-white/30 text-xs">({reviews.length})</span>
            </div>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-[#f5c842] transition-colors"
          >
            <Pencil className="w-3 h-3" />
            {myReview ? '수정' : '후기 작성'}
          </button>
        )}
      </div>

      {/* Write Form */}
      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 fade-in">
          <p className="text-white/60 text-xs mb-3">
            {myReview ? '후기 수정' : '후기를 남겨보세요'}
          </p>

          {/* Star Rating */}
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setFormRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    star <= (hoverRating || formRating)
                      ? 'text-[#f5c842] fill-[#f5c842]'
                      : 'text-white/20'
                  }`}
                />
              </button>
            ))}
            <span className="text-white/50 text-xs ml-2">
              {['', '별로예요', '그저 그래요', '괜찮아요', '좋아요', '최고예요'][hoverRating || formRating]}
            </span>
          </div>

          {/* Content */}
          <textarea
            className="input-field text-sm resize-none mb-3"
            rows={3}
            placeholder="공연 감상을 자유롭게 남겨주세요 (선택 사항, 최대 500자)"
            value={formContent}
            onChange={e => setFormContent(e.target.value)}
            maxLength={500}
          />
          <p className="text-white/20 text-xs mb-3 text-right">{formContent.length}/500</p>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-lg border border-white/15
                         text-white/50 hover:bg-white/10 text-sm transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {myReview ? '수정 완료' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* My Review (preview when form closed) */}
      {myReview && !showForm && (
        <div className="bg-[#f5c842]/5 border border-[#f5c842]/20 rounded-xl p-3.5 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < myReview.rating ? 'text-[#f5c842] fill-[#f5c842]' : 'text-white/15'}`} />
              ))}
              <span className="text-[#f5c842]/70 text-xs ml-1">내 후기</span>
            </div>
            <button onClick={handleDelete} className="text-white/25 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {myReview.content && (
            <p className="text-white/60 text-xs leading-relaxed">{myReview.content}</p>
          )}
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      ) : reviews.filter(r => r.user_id !== myReview?.user_id).length === 0 && !myReview ? (
        <p className="text-white/25 text-xs text-center py-4">아직 후기가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {visibleReviews
            .filter(r => !myReview || r.user_id !== myReview.user_id)
            .map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}

          {reviews.length > 3 && (
            <button
              onClick={() => setShowAll(p => !p)}
              className="w-full flex items-center justify-center gap-1 py-2
                         text-white/30 hover:text-white/60 text-xs transition-colors"
            >
              {showAll
                ? <><ChevronUp className="w-3.5 h-3.5" /> 접기</>
                : <><ChevronDown className="w-3.5 h-3.5" /> {reviews.length - 3}개 더 보기</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div className="bg-white/4 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-[#f5c842] fill-[#f5c842]' : 'text-white/15'}`} />
            ))}
          </div>
          <span className="text-white/50 text-xs">{review.author_name}</span>
          {review.author_nationality && (
            <span className="text-white/25 text-xs">· {review.author_nationality}</span>
          )}
        </div>
        <span className="text-white/20 text-xs">{formatTimeAgo(review.created_at)}</span>
      </div>
      {review.content && (
        <p className="text-white/55 text-xs leading-relaxed">{review.content}</p>
      )}
    </div>
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
