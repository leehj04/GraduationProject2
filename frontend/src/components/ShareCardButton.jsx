import React, { useState } from 'react';
import { Share2, Copy, Check, X, Loader2, MapPin, Calendar } from 'lucide-react';
import api from '../api';

export default function ShareCardButton({ musicianId, musicianName }) {
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied]   = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/share', { musician_id: musicianId });
      setShareUrl(data.share_url);
    } catch (err) {
      alert('공유 링크 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); if (!shareUrl) handleGenerate(); }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                   bg-white/8 hover:bg-white/15 border border-white/10
                   hover:border-white/25 text-white/70 hover:text-white
                   text-sm font-medium transition-all duration-200 w-full justify-center"
      >
        <Share2 className="w-4 h-4" />
        투어 경로 공유하기
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111827] border border-white/15 rounded-2xl w-full max-w-sm shadow-2xl fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#f5c842]" />
                <h3 className="font-serif font-bold text-white">투어 경로 공유</h3>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-white/50 text-sm">
                <span className="text-white font-medium">{musicianName}</span>의
                앞으로 6개월 투어 경로를 링크로 공유하세요.
                링크를 받은 사람은 로그인 없이 지도를 볼 수 있어요.
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 className="w-5 h-5 text-[#f5c842] animate-spin" />
                  <p className="text-white/40 text-sm">링크 생성 중...</p>
                </div>
              ) : shareUrl ? (
                <div className="space-y-3">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <p className="text-white/60 text-xs break-all leading-relaxed">{shareUrl}</p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl
                                font-medium text-sm transition-all duration-200
                                ${copied
                                  ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                                  : 'btn-primary'}`}
                  >
                    {copied
                      ? <><Check className="w-4 h-4" /> 복사됨!</>
                      : <><Copy className="w-4 h-4" /> 링크 복사</>}
                  </button>

                  {/* SNS Share buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${musicianName} 투어 경로를 확인해보세요!`)}&url=${encodeURIComponent(shareUrl)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl
                                 bg-[#1da1f2]/10 hover:bg-[#1da1f2]/20 border border-[#1da1f2]/20
                                 text-[#1da1f2] text-xs font-medium transition-colors"
                    >
                      𝕏 Twitter
                    </a>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: `${musicianName} 투어`, url: shareUrl });
                        } else {
                          handleCopy();
                        }
                      }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl
                                 bg-white/8 hover:bg-white/15 border border-white/10
                                 text-white/60 text-xs font-medium transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" /> 더 보기
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
