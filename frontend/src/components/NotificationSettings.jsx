import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import api from '../api';

const NOTIFY_OPTIONS = [
  { days: 7, label: '1주일 전' },
  { days: 3, label: '3일 전' },
  { days: 1, label: '하루 전' },
];

export default function NotificationSettings({ concertId, concertDate }) {
  const [activeDays, setActiveDays] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(null); // 저장 중인 days 값

  // 공연이 이미 지났는지 확인
  const isPast = concertDate && new Date(concertDate + 'T00:00:00') < new Date();

  useEffect(() => {
    api.get(`/api/notifications/concert/${concertId}`)
      .then(r => setActiveDays(r.data.activeDays))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [concertId]);

  const toggle = async (days) => {
    if (saving) return;
    setSaving(days);
    const isActive = activeDays.includes(days);
    try {
      if (isActive) {
        await api.delete('/api/notifications', {
          data: { concert_id: concertId, notify_days: days }
        });
        setActiveDays(prev => prev.filter(d => d !== days));
      } else {
        await api.post('/api/notifications', {
          concert_id: concertId,
          notify_days: days
        });
        setActiveDays(prev => [...prev, days]);
      }
    } catch (err) {
      const msg = err.response?.data?.error || '오류가 발생했습니다.';
      alert(msg);
    } finally {
      setSaving(null);
    }
  };

  if (isPast) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-3.5 h-3.5 text-white/40" />
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
          이메일 알림
        </p>
      </div>

      {loading ? (
        <div className="flex gap-2">
          {NOTIFY_OPTIONS.map(o => (
            <div key={o.days} className="h-8 w-20 bg-white/10 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {NOTIFY_OPTIONS.map(({ days, label }) => {
            const isActive = activeDays.includes(days);
            const isSaving = saving === days;

            // 해당 날짜가 이미 지났는지 체크
            const notifyDate = new Date(concertDate + 'T00:00:00');
            notifyDate.setDate(notifyDate.getDate() - days);
            const alreadyPassed = notifyDate < new Date();

            return (
              <button
                key={days}
                onClick={() => toggle(days)}
                disabled={isSaving || alreadyPassed}
                title={alreadyPassed ? '알림 날짜가 이미 지났습니다' : ''}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                            font-medium transition-all duration-200
                            ${alreadyPassed
                              ? 'opacity-30 cursor-not-allowed bg-white/5 text-white/30'
                              : isActive
                                ? 'bg-[#f5c842]/20 border border-[#f5c842]/40 text-[#f5c842]'
                                : 'bg-white/8 border border-white/15 text-white/60 hover:bg-white/15'
                            }`}
              >
                {isSaving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isActive ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Bell className="w-3 h-3" />
                )}
                {label}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-white/25 text-[10px] mt-2">
        선택한 시기에 이메일로 알려드립니다
      </p>
    </div>
  );
}
