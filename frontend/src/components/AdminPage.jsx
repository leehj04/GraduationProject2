import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Save, X, ArrowLeft,
  Music, Loader2, Search, RefreshCw, Check,
  Calendar, MapPin, Users
} from 'lucide-react';
import api from '../api';

const INSTRUMENTS = [
  '피아노','바이올린','첼로','비올라','플루트','오보에','클라리넷',
  '파곳','호른','트럼펫','트롬본','타악기','하프','오르간',
  '지휘','소프라노','메조소프라노','테너','바리톤','베이스','기타',
];
const NATIONALITIES = [
  '대한민국','미국','영국','독일','프랑스','이탈리아','오스트리아',
  '러시아','일본','중국','폴란드','스페인','네덜란드','아르헨티나',
  '호주','캐나다','체코','헝가리','핀란드','스웨덴','스위스',
  '벨기에','우크라이나','이스라엘','그리스','포르투갈','브라질','기타',
];

const ADMIN_PW_KEY = 'classictour_admin_pw';
const TABS = [
  { id: 'musicians', label: '음악가 관리', icon: Music },
  { id: 'concerts',  label: '공연 관리',   icon: Calendar },
];

const EMPTY_MUSICIAN = { name:'', name_ko:'', bio:'', instrument:'', nationality:'', official_site:'', photo_url:'' };
const EMPTY_CONCERT  = {
  musician_id:'', title:'', venue_name:'', venue_address:'',
  venue_city:'', venue_country:'', venue_lat:'', venue_lng:'',
  concert_date:'', concert_time:'', program:'', ticket_url:'',
};

export default function AdminPage() {
  const navigate = useNavigate();
  const [password, setPassword]   = useState('');
  const [authed, setAuthed]       = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('musicians');
  const [toast, setToast]         = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_PW_KEY);
    if (saved) tryAuth(saved, true);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  async function tryAuth(pw, silent = false) {
    try {
      await api.get('/api/admin/musicians', { headers: { 'x-admin-password': pw } });
      setAuthed(true);
      sessionStorage.setItem(ADMIN_PW_KEY, pw);
    } catch {
      if (!silent) setAuthError('비밀번호가 틀렸습니다.');
    }
  }

  if (!authed) return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <Music className="w-5 h-5 text-[#f5c842]" />
          <h1 className="font-serif text-xl font-bold text-white">관리자 페이지</h1>
        </div>
        <p className="text-white/40 text-sm mb-4">관리자 비밀번호를 입력하세요.</p>
        <input type="password" className="input-field mb-3" placeholder="비밀번호"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryAuth(password)} />
        {authError && <p className="text-red-400 text-sm mb-3">{authError}</p>}
        <button onClick={() => tryAuth(password)} className="btn-primary w-full">로그인</button>
        <button onClick={() => navigate('/musicians')}
          className="w-full mt-3 text-white/40 hover:text-white text-sm transition-colors">
          ← 돌아가기
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50
                        bg-[#f5c842] text-[#0a0e1a] font-semibold
                        px-5 py-2.5 rounded-full shadow-lg text-sm fade-in flex items-center gap-2">
          <Check className="w-4 h-4" />{toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/musicians')}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-white">관리자 페이지</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-8 border border-white/10">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                            text-sm font-medium transition-all duration-200
                            ${activeTab === tab.id
                              ? 'bg-[#f5c842] text-[#0a0e1a]'
                              : 'text-white/50 hover:text-white'}`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'musicians'
          ? <MusiciansTab showToast={showToast} />
          : <ConcertsTab  showToast={showToast} />
        }
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   음악가 관리 탭
══════════════════════════════════════ */
function MusiciansTab({ showToast }) {
  const [musicians, setMusicians] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [scraping, setScraping]   = useState(false);
  const [form, setForm]           = useState(EMPTY_MUSICIAN);

  const pw = () => sessionStorage.getItem(ADMIN_PW_KEY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/musicians', { headers: { 'x-admin-password': pw() } });
      setMusicians(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditTarget(null); setForm(EMPTY_MUSICIAN); setShowForm(true); };
  const openEdit = (m) => {
    setEditTarget(m);
    setForm({ name: m.name||'', name_ko: m.name_ko||'', bio: m.bio||'',
              instrument: m.instrument||'', nationality: m.nationality||'',
              official_site: m.official_site||'', photo_url: m.photo_url||'' });
    setShowForm(true);
  };

  async function handleSave() {
    if (!form.name.trim()) { showToast('이름은 필수예요!'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/api/admin/musicians/${editTarget.id}`, form, { headers: { 'x-admin-password': pw() } });
        showToast('수정됐습니다 ✓');
      } else {
        await api.post('/api/admin/musicians', form, { headers: { 'x-admin-password': pw() } });
        showToast('추가됐습니다 ✓');
      }
      setShowForm(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || '오류가 발생했습니다.');
    }
    setSaving(false);
  }

  async function handleDelete(m) {
    if (!confirm(`"${m.name}"을 삭제할까요?`)) return;
    try {
      await api.delete(`/api/admin/musicians/${m.id}`, { headers: { 'x-admin-password': pw() } });
      showToast('삭제됐습니다.');
      load();
    } catch { showToast('삭제 실패'); }
  }

  async function handleScrape() {
    if (scraping) return;
    setScraping(true);
    showToast('스크래핑 시작됐습니다...');
    try {
      await api.post('/api/admin/scrape', {}, { headers: { 'x-admin-password': pw() } });
    } catch {}
    setTimeout(() => setScraping(false), 5000);
  }

  const filtered = musicians.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.name_ko && m.name_ko.includes(search))
  );

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-white/40 text-sm">총 {musicians.length}명</p>
        <div className="flex gap-2">
          <button onClick={handleScrape} disabled={scraping}
            className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
            공연 업데이트
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />음악가 추가
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input className="input-field pl-10 text-sm" placeholder="이름으로 검색..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-[#f5c842] animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div key={m.id}
              className="flex items-center gap-4 bg-white/5 border border-white/8 rounded-xl px-4 py-3.5">
              <span className="text-white/20 text-xs w-6 text-right flex-shrink-0">{m.id}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-semibold text-sm">{m.name}</p>
                  {m.name_ko && <p className="text-white/40 text-xs">{m.name_ko}</p>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {m.instrument && <span className="text-[#f5c842]/70 text-xs">{m.instrument}</span>}
                  {m.nationality && <span className="text-white/30 text-xs">{m.nationality}</span>}
                  {m.official_site && (
                    <span className="text-white/20 text-xs truncate max-w-[200px]">
                      {m.official_site.replace('https://', '').slice(0, 35)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(m)}
                  className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-white/60" />
                </button>
                <button onClick={() => handleDelete(m)}
                  className="w-8 h-8 rounded-lg bg-white/8 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 음악가 추가/수정 모달 */}
      {showForm && (
        <Modal title={editTarget ? '음악가 수정' : '음악가 추가'} onClose={() => setShowForm(false)}>
          <Field label="영문 이름 *">
            <input className="input-field text-sm" placeholder="예: Yunchan Lim"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="한국어 이름">
            <input className="input-field text-sm" placeholder="예: 임윤찬"
              value={form.name_ko} onChange={e => setForm(f => ({ ...f, name_ko: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="악기">
              <select className="input-field text-sm"
                value={form.instrument} onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}>
                <option value="">선택</option>
                {INSTRUMENTS.map(i => <option key={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="국적">
              <select className="input-field text-sm"
                value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}>
                <option value="">선택</option>
                {NATIONALITIES.map(n => <option key={n}>{n}</option>)}
              </select>
            </Field>
          </div>
          <Field label="소개">
            <textarea className="input-field text-sm resize-none" rows={2} placeholder="간단한 소개..."
              value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
          </Field>
          <Field label="공식 사이트 URL">
            <input className="input-field text-sm" placeholder="https://..."
              value={form.official_site} onChange={e => setForm(f => ({ ...f, official_site: e.target.value }))} />
            <p className="text-white/20 text-xs mt-1">입력하면 공연 정보 자동 수집에 활용돼요</p>
          </Field>
          <ModalFooter onCancel={() => setShowForm(false)} onSave={handleSave} saving={saving}
            label={editTarget ? '수정 완료' : '추가하기'} />
        </Modal>
      )}
    </>
  );
}

/* ══════════════════════════════════════
   공연 관리 탭
══════════════════════════════════════ */
function ConcertsTab({ showToast }) {
  const [concerts, setConcerts]     = useState([]);
  const [musicians, setMusicians]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterMusician, setFilterMusician] = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(EMPTY_CONCERT);
  const [programs, setPrograms]     = useState(['']); // 곡목 목록

  const pw = () => sessionStorage.getItem(ADMIN_PW_KEY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, mRes] = await Promise.all([
        api.get('/api/admin/concerts', { headers: { 'x-admin-password': pw() } }),
        api.get('/api/admin/musicians', { headers: { 'x-admin-password': pw() } }),
      ]);
      setConcerts(cRes.data);
      setMusicians(mRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_CONCERT);
    setPrograms(['']);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditTarget(c);
    setForm({
      musician_id: c.musician_id || '',
      title: c.title || '',
      venue_name: c.venue_name || '',
      venue_address: c.venue_address || '',
      venue_city: c.venue_city || '',
      venue_country: c.venue_country || '',
      venue_lat: c.venue_lat || '',
      venue_lng: c.venue_lng || '',
      concert_date: c.concert_date || '',
      concert_time: c.concert_time || '',
      ticket_url: c.ticket_url || '',
    });
    setPrograms(c.program?.length ? c.program : ['']);
    setShowForm(true);
  };

  async function handleSave() {
    if (!form.musician_id) { showToast('음악가를 선택해주세요!'); return; }
    if (!form.venue_name.trim()) { showToast('공연장 이름은 필수예요!'); return; }
    if (!form.concert_date) { showToast('날짜는 필수예요!'); return; }

    setSaving(true);
    const payload = {
      ...form,
      program: programs.filter(p => p.trim()),
    };
    try {
      if (editTarget) {
        await api.put(`/api/admin/concerts/${editTarget.id}`, payload, { headers: { 'x-admin-password': pw() } });
        showToast('수정됐습니다 ✓');
      } else {
        await api.post('/api/admin/concerts', payload, { headers: { 'x-admin-password': pw() } });
        showToast('추가됐습니다 ✓');
      }
      setShowForm(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || '오류가 발생했습니다.');
    }
    setSaving(false);
  }

  async function handleDelete(c) {
    if (!confirm(`"${c.title}" 공연을 삭제할까요?`)) return;
    try {
      await api.delete(`/api/admin/concerts/${c.id}`, { headers: { 'x-admin-password': pw() } });
      showToast('삭제됐습니다.');
      load();
    } catch { showToast('삭제 실패'); }
  }

  const filtered = concerts.filter(c => {
    const matchSearch = !search ||
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.venue_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.venue_city?.toLowerCase().includes(search.toLowerCase());
    const matchMusician = !filterMusician || String(c.musician_id) === filterMusician;
    return matchSearch && matchMusician;
  });

  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-white/40 text-sm">총 {concerts.length}개 공연</p>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />공연 추가
        </button>
      </div>

      {/* 검색 + 음악가 필터 */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input className="input-field pl-10 text-sm" placeholder="공연명, 공연장, 도시 검색..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field text-sm w-48"
          value={filterMusician} onChange={e => setFilterMusician(e.target.value)}>
          <option value="">전체 음악가</option>
          {musicians.map(m => (
            <option key={m.id} value={m.id}>{m.name_ko || m.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-[#f5c842] animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">공연이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id}
              className="flex items-center gap-4 bg-white/5 border border-white/8 rounded-xl px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-semibold text-sm">{c.title}</p>
                  <span className="text-[#f5c842]/70 text-xs">
                    {musicians.find(m => m.id === c.musician_id)?.name_ko ||
                     musicians.find(m => m.id === c.musician_id)?.name || '?'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-white/50 text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{formatDate(c.concert_date)}
                    {c.concert_time && ` ${c.concert_time}`}
                  </span>
                  <span className="text-white/30 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{c.venue_name}
                    {c.venue_city && `, ${c.venue_city}`}
                  </span>
                  {(c.venue_lat && c.venue_lng) ? (
                    <span className="text-green-400/60 text-xs">📍 좌표 있음</span>
                  ) : (
                    <span className="text-red-400/60 text-xs">⚠ 좌표 없음</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(c)}
                  className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-white/60" />
                </button>
                <button onClick={() => handleDelete(c)}
                  className="w-8 h-8 rounded-lg bg-white/8 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 공연 추가/수정 모달 */}
      {showForm && (
        <Modal title={editTarget ? '공연 수정' : '공연 추가'} onClose={() => setShowForm(false)}>
          {/* 음악가 선택 */}
          <Field label="음악가 *">
            <select className="input-field text-sm"
              value={form.musician_id}
              onChange={e => setForm(f => ({ ...f, musician_id: e.target.value }))}>
              <option value="">선택해주세요</option>
              {musicians.map(m => (
                <option key={m.id} value={m.id}>{m.name_ko || m.name}</option>
              ))}
            </select>
          </Field>

          {/* 공연 제목 */}
          <Field label="공연 제목">
            <input className="input-field text-sm" placeholder="비워두면 자동 생성"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Field>

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="날짜 *">
              <input type="date" className="input-field text-sm"
                value={form.concert_date}
                onChange={e => setForm(f => ({ ...f, concert_date: e.target.value }))} />
            </Field>
            <Field label="시간">
              <input type="time" className="input-field text-sm"
                value={form.concert_time}
                onChange={e => setForm(f => ({ ...f, concert_time: e.target.value }))} />
            </Field>
          </div>

          {/* 공연장 */}
          <Field label="공연장 이름 *">
            <input className="input-field text-sm" placeholder="예: Carnegie Hall"
              value={form.venue_name} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))} />
          </Field>

          {/* 주소 */}
          <Field label="주소">
            <input className="input-field text-sm" placeholder="예: 881 7th Ave, New York, NY 10019, USA"
              value={form.venue_address} onChange={e => setForm(f => ({ ...f, venue_address: e.target.value }))} />
            <p className="text-white/20 text-xs mt-1">주소를 입력하면 지도 좌표를 자동으로 찾아줘요</p>
          </Field>

          {/* 도시 + 국가 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="도시">
              <input className="input-field text-sm" placeholder="예: New York"
                value={form.venue_city} onChange={e => setForm(f => ({ ...f, venue_city: e.target.value }))} />
            </Field>
            <Field label="국가">
              <input className="input-field text-sm" placeholder="예: USA"
                value={form.venue_country} onChange={e => setForm(f => ({ ...f, venue_country: e.target.value }))} />
            </Field>
          </div>

          {/* 좌표 (선택) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="위도 (선택)">
              <input className="input-field text-sm" placeholder="예: 40.7651"
                value={form.venue_lat} onChange={e => setForm(f => ({ ...f, venue_lat: e.target.value }))} />
            </Field>
            <Field label="경도 (선택)">
              <input className="input-field text-sm" placeholder="예: -73.9800"
                value={form.venue_lng} onChange={e => setForm(f => ({ ...f, venue_lng: e.target.value }))} />
            </Field>
          </div>
          <p className="text-white/20 text-xs -mt-2">
            좌표를 직접 입력하거나, 주소만 입력하면 자동으로 계산해요.
            <a href="https://www.latlong.net" target="_blank" rel="noopener noreferrer"
              className="text-[#f5c842]/50 hover:text-[#f5c842] ml-1 transition-colors">
              latlong.net에서 검색 →
            </a>
          </p>

          {/* 연주 곡목 */}
          <Field label="연주 곡목">
            <div className="space-y-2">
              {programs.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input-field text-sm flex-1"
                    placeholder={`예: Beethoven - Piano Sonata No. 14`}
                    value={p}
                    onChange={e => {
                      const next = [...programs];
                      next[i] = e.target.value;
                      setPrograms(next);
                    }} />
                  {programs.length > 1 && (
                    <button onClick={() => setPrograms(programs.filter((_, idx) => idx !== i))}
                      className="w-8 h-8 rounded-lg bg-white/8 hover:bg-red-500/30 flex items-center justify-center">
                      <X className="w-3.5 h-3.5 text-white/60" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setPrograms([...programs, ''])}
                className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors">
                <Plus className="w-3 h-3" /> 곡목 추가
              </button>
            </div>
          </Field>

          {/* 티켓 URL */}
          <Field label="티켓 구매 URL">
            <input className="input-field text-sm" placeholder="https://..."
              value={form.ticket_url} onChange={e => setForm(f => ({ ...f, ticket_url: e.target.value }))} />
          </Field>

          <ModalFooter onCancel={() => setShowForm(false)} onSave={handleSave} saving={saving}
            label={editTarget ? '수정 완료' : '추가하기'} />
        </Modal>
      )}
    </>
  );
}

/* ══════════════════════════════════════
   공통 컴포넌트
══════════════════════════════════════ */
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111827] border border-white/15 rounded-2xl w-full max-w-lg
                      shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#111827]">
          <h2 className="font-serif font-bold text-white">{title}</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-white/50 text-xs mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, label }) {
  return (
    <div className="flex gap-2 pt-2">
      <button onClick={onCancel}
        className="flex-1 py-2.5 rounded-lg border border-white/15
                   text-white/50 hover:bg-white/10 text-sm transition-colors">
        취소
      </button>
      <button onClick={onSave} disabled={saving}
        className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {label}
      </button>
    </div>
  );
}
