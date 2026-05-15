import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { UI, ALL_VENDORS, KITCHEN_VENDORS, SERVER_VENDOR, vcolor, itemName } from './i18n';
import './App.css';

// ── helpers ───────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState('');
  const show = useCallback((m) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3500);
  }, []);
  return [msg, show];
}

// ── App ───────────────────────────────────────────────
export default function App() {
  const [lang, setLang]       = useState('ja');
  const [tab, setTab]         = useState('staff');
  const [location, setLocation] = useState(''); // '' = not yet selected
  const [items, setItems]     = useState([]);
  const [sessions, setSessions] = useState([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [toastMsg, showToast] = useToast();
  const [showManual, setShowManual] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const t = (k) => UI[lang][k] || UI.ja[k] || k;

  // Load data on mount
  useEffect(() => {
    Promise.all([api.getItems(), api.getSessions(), api.getSettings()])
      .then(([its, sess, settings]) => {
        setItems(its);
        setSessions(sess);
        setAdminEmail(settings.adminEmail || '');
      })
      .catch(() => showToast(t('toastError')))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const refreshSessions = (loc) => {
    const l = loc !== undefined ? loc : location;
    api.getSessions(l).then(setSessions).catch(console.error);
  };

  if (loading) return (
    <div className="app" style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
      <div style={{color:'var(--text-2)',fontSize:14}}>{t('loading')}</div>
    </div>
  );

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className="logo"><span>Tanto</span> Gyoza &amp; Ramen Bar</div>
          {location && (
            <span
              onClick={() => setLocation('')}
              style={{fontSize:12,fontWeight:500,background:'#D85A30',color:'white',padding:'5px 12px',borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}
              title={lang==='en'?'Change store':lang==='zh'?'切换店铺':'店舗を変更'}
            >
              <i className="ti ti-building-store" aria-hidden="true" style={{fontSize:13}} />
              {lang==='en'?location:lang==='zh'?location+'店':location+'店'}
              <span style={{opacity:0.7,fontSize:11}}>× {lang==='en'?'change':lang==='zh'?'切换':'変更'}</span>
            </span>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button
            onClick={()=>setShowManual(true)}
            style={{width:30,height:30,borderRadius:'50%',border:'0.5px solid var(--border)',background:'var(--bg)',color:'var(--text-2)',fontSize:14,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
            aria-label="使い方"
          >?</button>
          <div className="lang-switcher">
            {['ja','en','zh'].map(l => (
              <button key={l} className={`lang-btn${lang===l?' active':''}`} onClick={()=>setLang(l)}>
                {l==='ja'?'日本語':l==='en'?'English':'中文'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs — only shown after location is chosen */}
      {location && (
        <div className="tab-bar">
          <button className={`tab${tab==='staff'?' active':''}`} onClick={()=>setTab('staff')}>
            {t('tabStaff')}
          </button>
          <button className={`tab${['admin','history','settings'].includes(tab)?' active':''}`} onClick={()=>{
            if(!adminUnlocked){ setTab('admin'); } else { setTab('admin'); }
            setTab('admin');
          }}>
            {lang==='en'?'Admin':lang==='zh'?'管理员':'管理者'}
            {!adminUnlocked && <i className="ti ti-lock" aria-hidden="true" style={{fontSize:11,marginLeft:5,opacity:0.6}} />}
          </button>
        </div>
      )}

      {/* Location selector — shown until a store is chosen */}
      {!location && (
        <LocationSelect lang={lang} onSelect={(loc) => {
          setLocation(loc);
          refreshSessions(loc);
        }} />
      )}

      {/* Views — only shown after location is chosen */}
      {location && tab === 'staff' && (
        <StaffTab
          lang={lang} t={t} items={items} location={location}
          adminEmail={adminEmail}
          onComplete={() => {
            refreshSessions();
          }}
          showToast={showToast}
        />
      )}
      {location && ['admin','history','settings'].includes(tab) && (
        adminUnlocked
          ? <AdminArea
              lang={lang} t={t} items={items} sessions={sessions}
              location={location} activeTab={tab} setActiveTab={setTab}
              adminEmail={adminEmail} setAdminEmail={setAdminEmail}
              setItems={setItems} showToast={showToast}
            />
          : <AdminLock
              lang={lang}
              onUnlock={() => setAdminUnlocked(true)}
            />
      )}

      {/* Manual Modal */}
      {showManual && <ManualModal lang={lang} onClose={()=>setShowManual(false)} />}

      {/* Toast */}
      {toastMsg && <div className="toast show">{toastMsg}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// STAFF TAB
// ─────────────────────────────────────────────────────
function StaffTab({ lang, t, items, location, adminEmail, onComplete, showToast }) {
  const [screen, setScreen]           = useState('top'); // 'top' | 'count' | 'done'
  const [staffName, setStaffName]     = useState('');
  const [selected, setSelected]       = useState([]);
  const [activeVendor, setActiveVendor] = useState(null);
  const [savedVendors, setSavedVendors] = useState({});
  const [counts, setCounts]           = useState({}); // { itemId: value }
  const [completedInfo, setCompletedInfo] = useState(null); // { staffName, categories, date, time, location }

  const CATEGORIES = ['肉・海鮮','野菜・卵','麺・米','調味料','乾物・ストック','冷凍・その他','サーバー'];
  const CAT_LABELS = {
    ja: {'肉・海鮮':'肉・海鮮','野菜・卵':'野菜・卵','麺・米':'麺・米','調味料':'調味料','乾物・ストック':'乾物・ストック','冷凍・その他':'冷凍・その他','サーバー':'サーバー'},
    en: {'肉・海鮮':'Meat & Seafood','野菜・卵':'Vegetables & Eggs','麺・米':'Noodles & Rice','調味料':'Seasonings','乾物・ストック':'Dry Goods','冷凍・その他':'Frozen & Other','サーバー':'Server (Bar)'},
    zh: {'肉・海鮮':'肉类・海鲜','野菜・卵':'蔬菜・鸡蛋','麺・米':'面条・米饭','調味料':'调味料','乾物・ストック':'干货','冷凍・その他':'冷冻・其他','サーバー':'服务员（酒水）'},
  };
  const CAT_ICONS = {'肉・海鮮':'ti-meat','野菜・卵':'ti-leaf','麺・米':'ti-bowl','調味料':'ti-salt','乾物・ストック':'ti-package','冷凍・その他':'ti-snowflake','サーバー':'ti-glass-full'};
  const CAT_COLORS = {'肉・海鮮':'#E24B4A','野菜・卵':'#1D9E75','麺・米':'#BA7517','調味料':'#378ADD','乾物・ストック':'#534AB7','冷凍・その他':'#888780','サーバー':'#534AB7'};

  function catLabel(c) { return (CAT_LABELS[lang]||CAT_LABELS.ja)[c]||c; }
  function getCatItems(c) { return items.filter(i => i.category === c); }

  function toggleCat(c) {
    setSelected(s => s.includes(c) ? s.filter(x=>x!==c) : [...s, c]);
  }
  function toggleAll() {
    setSelected(s => s.length === CATEGORIES.length ? [] : [...CATEGORIES]);
  }

  function startCounting() {
    if (!staffName.trim()) { showToast(t('toastEnterName')); return; }
    if (!selected.length)  { showToast(t('toastSelectVendor')); return; }
    setActiveVendor(selected[0]);
    setScreen('count');
  }

  function backToTop() { setScreen('top'); }

  function getVendorItems(v) {
    return items.filter(i => i.category === v);
  }

  function vendorProgress(v) {
    const its = getVendorItems(v);
    const filled = its.filter(i => counts[i.id] !== undefined && counts[i.id] !== '').length;
    return { filled, total: its.length };
  }

  function totalProgress() {
    let filled = 0, total = 0;
    selected.forEach(v => {
      const p = vendorProgress(v);
      filled += p.filled; total += p.total;
    });
    return { filled, total };
  }

  function saveCurrentVendor() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
    setSavedVendors(sv => ({ ...sv, [activeVendor]: { staff: staffName, time: timeStr } }));
    // activeVendor here is actually a category key
    showToast(t('toastVendorSaved'));
    // Auto-advance
    const next = selected.find(v => v !== activeVendor && !savedVendors[v] && v !== activeVendor);
    if (next) setActiveVendor(next);
  }

  async function finishAll() {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const timeStr = now.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });

    // Ensure current vendor is stamped
    const finalStamps = { ...savedVendors };
    if (!finalStamps[activeVendor]) {
      finalStamps[activeVendor] = { staff: staffName, time: timeStr };
    }

    // 選択したカテゴリーのアイテムのみ送信
    const sessionItems = items
      .filter(item => selected.includes(item.category))
      .map(item => ({
        id: item.id,
        current: counts[item.id] !== undefined && counts[item.id] !== '' ? parseInt(counts[item.id]) : null,
        staffStamp: finalStamps[item.category]?.staff || staffName,
        stampTime:  finalStamps[item.category]?.time  || timeStr,
      }));

    try {
      await api.postSession({
        date: dateKey, month: dateKey.slice(0,7), time: timeStr,
        staffName, location: location || 'Piikoi', vendorStamps: finalStamps, items: sessionItems,
      });
      // Save completed info for notification screen
      setCompletedInfo({
        staffName,
        categories: selected,
        date: dateKey,
        time: timeStr,
        location: location || 'Piikoi',
      });
      setCounts({}); setSavedVendors({}); setSelected([]);
      setScreen('done');
      onComplete();
    } catch(e) {
      showToast(t('toastError'));
    }
  }

  const { filled, total } = totalProgress();

  // ── DONE SCREEN ──
  if (screen === 'done' && completedInfo) {
    const catLabelsJa = {'肉・海鮮':'肉・海鮮','野菜・卵':'野菜・卵','麺・米':'麺・米','調味料':'調味料','乾物・ストック':'乾物・ストック','冷凍・その他':'冷凍・その他','サーバー':'サーバー'};
    const catLabelsEn = {'肉・海鮮':'Meat & Seafood','野菜・卵':'Vegetables & Eggs','麺・米':'Noodles & Rice','調味料':'Seasonings','乾物・ストック':'Dry Goods','冷凍・その他':'Frozen & Other','サーバー':'Server (Bar)'};
    const catLabelsZh = {'肉・海鮮':'肉类・海鲜','野菜・卵':'蔬菜・鸡蛋','麺・米':'面条・米饭','調味料':'调味料','乾物・ストック':'干货','冷凍・その他':'冷冻・其他','サーバー':'服务员（酒水）'};
    const cl = lang==='en'?catLabelsEn:lang==='zh'?catLabelsZh:catLabelsJa;

    const catListJa = completedInfo.categories.map(c=>catLabelsJa[c]||c).join('、');
    const catListEn = completedInfo.categories.map(c=>catLabelsEn[c]||c).join(', ');
    const subject = `【Tanto棚卸し通知】${completedInfo.location}店 ${completedInfo.date} ${completedInfo.time}`;
    const body = `Tanto Gyoza and Ramen Bar — 棚卸し完了通知

店舗: ${completedInfo.location}店
日時: ${completedInfo.date} ${completedInfo.time}
担当: ${completedInfo.staffName}
カテゴリー: ${catListJa}

以上、棚卸しが完了しました。
管理者画面で詳細をご確認ください。`;

    function openNotifyGmail() {
      const toMail = adminEmail || 'sales@tanto-otabe.com';
      navigator.clipboard.writeText(body).catch(()=>{});
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toMail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank');
    }

    return (
      <div style={{maxWidth:420,margin:'3rem auto',textAlign:'center',padding:'0 1rem'}}>
        <div style={{fontSize:56,marginBottom:'0.75rem'}}>✅</div>
        <div style={{fontSize:18,fontWeight:500,color:'var(--text)',marginBottom:6}}>
          {lang==='en'?'Inventory Complete!':lang==='zh'?'盘点完成！':'棚卸し完了！'}
        </div>
        <div style={{fontSize:13,color:'var(--text-2)',marginBottom:'1.5rem'}}>
          {completedInfo.location}店 — {completedInfo.staffName} — {completedInfo.time}
        </div>

        {/* Completed categories */}
        <div style={{background:'var(--bg-2)',borderRadius:'var(--radius)',padding:'1rem',marginBottom:'1.5rem',textAlign:'left'}}>
          <div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',marginBottom:8}}>
            {lang==='en'?'Completed Categories':lang==='zh'?'已完成类别':'完了カテゴリー'}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {completedInfo.categories.map(c=>(
              <span key={c} style={{fontSize:12,fontWeight:500,background:'#E1F5EE',color:'#085041',padding:'3px 10px',borderRadius:10}}>
                ✓ {cl[c]||c}
              </span>
            ))}
          </div>
        </div>

        {/* Notify button */}
        <button
          onClick={openNotifyGmail}
          style={{width:'100%',padding:'14px',background:'#D85A30',color:'white',border:'none',borderRadius:'var(--radius-sm)',fontSize:14,fontWeight:500,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
        >
          <i className="ti ti-mail" aria-hidden="true" style={{fontSize:16}} />
          {lang==='en'?'Notify Manager via Gmail':lang==='zh'?'通过 Gmail 通知管理员':'管理者へGmailで通知する'}
        </button>
        <div style={{fontSize:11,color:'var(--text-2)',marginBottom:'1.5rem'}}>
          {lang==='en'?'Gmail opens with the notification pre-filled. Enter the manager email and send.':lang==='zh'?'Gmail 将自动填写通知内容，输入管理员邮箱后发送即可。':'Gmailが開きます。管理者のメールアドレスを入力して送信してください。'}
        </div>

        <button
          onClick={()=>{ setStaffName(''); setScreen('top'); }}
          style={{width:'100%',padding:'12px',background:'transparent',border:'0.5px solid var(--border)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--text-2)',cursor:'pointer'}}
        >
          {lang==='en'?'Back to Home':lang==='zh'?'返回首页':'ホームに戻る'}
        </button>
      </div>
    );
  }

  // ── TOP SCREEN ──
  if (screen === 'top') return (
    <div>
      <div className="top-intro">
        <div className="top-title">{t('topTitle')}</div>
        <div className="top-subtitle">{t('topSubtitle')}</div>
      </div>

      <div className="staff-input-row">
        <label>{t('staffLabel')}</label>
        <input
          type="text" value={staffName}
          onChange={e => setStaffName(e.target.value)}
          placeholder={t('staffPlaceholder')}
        />
      </div>

      <div className="vendor-grid">
        {CATEGORIES.map(c => {
          const its = getCatItems(c);
          const isSel = selected.includes(c);
          const isDone = !!savedVendors[c];
          return (
            <div
              key={c}
              className={`vendor-tile${isSel?' selected':''}${isDone?' done':''}`}
              onClick={() => toggleCat(c)}
            >
              <div style={{width:36,height:36,borderRadius:9,background:isSel?CAT_COLORS[c]:'var(--bg-2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
                <i className={`ti ${CAT_ICONS[c]}`} style={{fontSize:18,color:isSel?'white':CAT_COLORS[c]}} aria-hidden="true" />
              </div>
              <div className="vt-info">
                <div className="vt-name">{catLabel(c)}</div>
                <div className="vt-count">{its.length}{t('itemsLabel')}</div>
              </div>
              {isDone
                ? <span className="vt-done-badge">✓ {savedVendors[c].staff}</span>
                : isSel ? <span style={{fontSize:18,color:'var(--accent)'}}>✓</span> : null
              }
            </div>
          );
        })}
      </div>

      <button className="select-all-btn" onClick={toggleAll}>
        {selected.length === CATEGORIES.length ? t('deselectAll') : t('selectAll')}
      </button>
      <button
        className="start-btn"
        onClick={startCounting}
        disabled={!staffName.trim() || !selected.length}
      >
        {t('startBtn')}
      </button>
    </div>
  );

  // ── COUNT SCREEN ──
  const activeItems = getVendorItems(activeVendor);
  const isServer = activeVendor === 'サーバー';

  return (
    <div>
      {/* Counting header */}
      <div className="counting-header">
        <span className="staff-badge">{staffName}</span>
        <span className="vendor-info">— {catLabel(activeVendor)} ({activeItems.length}{t('itemsLabel')})</span>
        <button className="btn-outline" style={{marginLeft:'auto',fontSize:12,padding:'5px 10px'}} onClick={backToTop}>
          ← {t('backBtn')}
        </button>
      </div>

      {/* Category tabs */}
      <div className="vendor-tabs">
        {selected.map(c => {
          const isDone = !!savedVendors[c];
          const isActive = c === activeVendor;
          return (
            <button
              key={c}
              className={`vtab${isActive?' active':''}${isDone?' completed':''}`}
              style={isActive ? {background:CAT_COLORS[c],color:'white',borderColor:CAT_COLORS[c]} : {}}
              onClick={() => setActiveVendor(c)}
            >
              {isDone && <span className="vtab-dot" />}
              <i className={`ti ${CAT_ICONS[c]}`} style={{fontSize:12}} aria-hidden="true" />
              {catLabel(c)}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{width: total ? `${Math.round(filled/total*100)}%` : '0%'}} />
      </div>

      {/* Items */}
      <div className="item-grid">
        {activeItems.map(item => {
          const val = counts[item.id] !== undefined ? counts[item.id] : '';
          const num = val === '' ? null : parseInt(val);
          const sc = num === null ? 'empty' : num === 0 ? 'out' : num < item.min_stock * 0.5 ? 'low' : 'ok';
          return (
            <div key={item.id} className={`item-card${isServer?' server-card':''}`}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div className="item-name">{itemName(item, lang)}</div>
                  <div className="item-unit">{item.vendor} | {t('scardUnit')}: {item.unit} | {t('scardMin')}: {item.min_stock}</div>
                </div>
                <div className={`item-status s-${sc}`} />
              </div>
              <div className="item-input-row">
                <button className="qty-btn" onClick={() => {
                  const cur = parseInt(counts[item.id] || 0);
                  setCounts(c => ({...c, [item.id]: Math.max(0, cur - 1)}));
                }}>−</button>
                <input
                  className="qty-input" type="number" min="0" placeholder="0" value={val}
                  onChange={e => setCounts(c => ({...c, [item.id]: e.target.value}))}
                />
                <button className="qty-btn" onClick={() => {
                  const cur = parseInt(counts[item.id] || 0);
                  setCounts(c => ({...c, [item.id]: cur + 1}));
                }}>＋</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action bar */}
      <div className="action-bar">
        <div className="progress-info">
          <strong>{filled}</strong> / {total} {t('progressLabel')}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-secondary" onClick={saveCurrentVendor}>{t('saveVendorBtn')}</button>
          <button className="btn-primary" onClick={finishAll}>{t('finishAllBtn')}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ADMIN TAB
// ─────────────────────────────────────────────────────
function AdminTab({ lang, t, items, sessions, location, adminEmail, setAdminEmail, showToast }) {
  const [latestSession, setLatestSession] = useState(null);
  const [showGmail, setShowGmail]         = useState(false);
  const [mailTo, setMailTo]               = useState(adminEmail);
  const [mailSubject, setMailSubject]     = useState('');
  const [mailBody, setMailBody]           = useState('');

  useEffect(() => {
    if (sessions.length) {
      api.getSession(sessions[0].id).then(setLatestSession).catch(console.error);
    }
  }, [sessions]);

  useEffect(() => { setMailTo(adminEmail); }, [adminEmail]);

  function buildOrderJa(session) {
    if (!session) return '';
    const oi = session.items.filter(i => (i.min_stock - (i.current_stock||0)) > 0);
    if (!oi.length) return '発注が必要なアイテムはありません。';
    const stamps = session.vendorStamps || {};
    let staffSummary = '';
    Object.keys(stamps).forEach(v => { staffSummary += `  ${v}: ${stamps[v].staff}（${stamps[v].time}）\n`; });
    const locName = session.location ? `【${session.location}店】` : '';
    let txt = `Tanto Gyoza and Ramen Bar ${locName}— 発注リスト\n日付: ${session.date} ${session.time}\n`;
    if (staffSummary) txt += `\n【担当スタッフ】\n${staffSummary}`;
    txt += `\n${'─'.repeat(42)}\n\n`;
    const kitchen = oi.filter(i => i.vendor !== SERVER_VENDOR);
    const server  = oi.filter(i => i.vendor === SERVER_VENDOR);
    const vs = [...new Set(kitchen.map(i=>i.vendor))];
    vs.forEach(v => {
      txt += `【${v}】\n`;
      kitchen.filter(i=>i.vendor===v).forEach(i => {
        const n = i.min_stock - (i.current_stock||0);
        txt += `  ・${i.name_ja}: ${n} ${i.unit}（現 ${i.current_stock||0} / 規定 ${i.min_stock}）\n`;
      });
      txt += '\n';
    });
    if (server.length) {
      txt += `【サーバー棚卸し — アルコール・ドリンク】\n`;
      server.forEach(i => {
        const n = i.min_stock - (i.current_stock||0);
        txt += `  ・${i.name_ja}: ${n} ${i.unit}（現 ${i.current_stock||0} / 規定 ${i.min_stock}）\n`;
      });
    }
    return txt + '\n' + '─'.repeat(42) + '\n以上、よろしくお願いいたします。\nTanto Gyoza and Ramen Bar';
  }

  function openGmailModal() {
    if (!latestSession) { showToast(t('toastNoSession')); return; }
    const locTag = latestSession.location ? `【${latestSession.location}】` : '';
    setMailSubject(`【Tanto発注】${locTag}${latestSession.date} 棚卸し結果`);
    setShowGmail(true);
  }

  function openGmail() {
    if (!mailTo) { showToast(t('toastNoEmail')); return; }
    api.postSetting('adminEmail', mailTo).then(() => setAdminEmail(mailTo)).catch(console.error);
    // 本文をクリップボードにコピーしてからGmailを開く（URL長すぎるとError 400になるため）
    navigator.clipboard.writeText(mailBody).catch(() => {});
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mailTo)}&su=${encodeURIComponent(mailSubject)}`;
    window.open(url, '_blank');
    setShowGmail(false);
    showToast(lang==='en'
      ? 'Gmail opened. Body copied to clipboard — paste it in.'
      : lang==='zh'
      ? 'Gmail已打开。正文已复制，请粘贴到邮件中。'
      : 'Gmailを開きました。本文はクリップボードにコピー済みです。メール本文に貼り付けてください。');
  }

  function copyOrder() {
    if (!latestSession) { showToast(t('toastNoSession')); return; }
    navigator.clipboard.writeText(buildOrderJa(latestSession))
      .then(() => showToast(t('toastCopy')))
      .catch(() => showToast(t('toastCopyFail')));
  }

  function downloadCsv() {
    if (!latestSession) { showToast(t('toastNoSession')); return; }
    const items = latestSession.items;
    const rows = [
      ['アイテム名', 'Item Name', '品名', '業者/Vendor', '現在庫/Current', '規定数/Min', '発注数/Order Qty', '単位/Unit', '担当者/Staff', '時刻/Time'],
    ];
    // Kitchen items first, then server
    const kitchen = items.filter(i => i.vendor !== 'サーバー棚卸し');
    const server  = items.filter(i => i.vendor === 'サーバー棚卸し');
    [...kitchen, ...server].forEach(item => {
      const cur = item.current_stock || 0;
      const needed = Math.max(0, item.min_stock - cur);
      if (needed > 0) {
        rows.push([
          item.name_ja,
          item.name_en,
          item.name_zh,
          item.vendor,
          cur,
          item.min_stock,
          needed,
          item.unit,
          item.staff_stamp || '',
          item.stamp_time || '',
        ]);
      }
    });
    if (rows.length === 1) { showToast('発注が必要なアイテムはありません。'); return; }
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const bom = '﻿'; // UTF-8 BOM for Excel/Sheets compatibility
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tanto_order_${latestSession.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(lang==='en' ? 'CSV downloaded.' : lang==='zh' ? 'CSV已下载。' : 'CSVをダウンロードしました。');
  }

  const locationLabel = location
    ? (lang==='en' ? location : lang==='zh' ? location+'店' : location+'店')
    : '';

  // Summary
  let ok=0, low=0, ord=0;
  const sessionItems = latestSession?.items || [];
  sessionItems.forEach(item => {
    const cur = item.current_stock || 0;
    const needed = Math.max(0, item.min_stock - cur);
    if (needed > 0) ord++;
    else if (cur < item.min_stock * 1.3) low++;
    else ok++;
  });

  const kitchen = sessionItems.filter(i => i.vendor !== SERVER_VENDOR);
  const server  = sessionItems.filter(i => i.vendor === SERVER_VENDOR);

  return (
    <div>
      {/* Summary cards */}
      <div className="summary-cards">
        {[
          [t('sTotal'), sessionItems.length, ''],
          [t('sOk'), ok, ''],
          [t('sLow'), low, 'warn'],
          [t('sOrder'), ord, 'danger'],
        ].map(([label, val, cls]) => (
          <div key={label} className="sum-card">
            <div className="sum-label">{label}</div>
            <div className={`sum-value${cls?' '+cls:''}`}>{val || '—'}</div>
          </div>
        ))}
      </div>

      <div className="section-header">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div className="section-title">{t('adminTitle')}</div>
          {location && <span style={{fontSize:11,fontWeight:500,background:'#FAECE7',color:'#993C1D',padding:'2px 10px',borderRadius:10}}>{locationLabel}</span>}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn-outline" onClick={downloadCsv}><i className="ti ti-file-spreadsheet" /> {lang==='en'?'Export CSV':lang==='zh'?'导出CSV':'CSV出力'}</button>
          <button className="btn-outline" onClick={copyOrder}><i className="ti ti-copy" /> {t('copyBtn')}</button>
          <button className="btn-outline" onClick={openGmailModal}><i className="ti ti-mail" /> {t('gmailBtn')}</button>
        </div>
      </div>

      {!latestSession ? (
        <div className="empty-state">{t('adminEmpty')}</div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table>
            <thead>
              <tr>
                <th style={{width:'28%'}}>{t('colItem')}</th>
                <th style={{width:'18%'}}>{t('colVendor')}</th>
                <th style={{width:'10%'}}>{t('colCurrent')}</th>
                <th style={{width:'10%'}}>{t('colMin')}</th>
                <th style={{width:'11%'}}>{t('colOrder')}</th>
                <th style={{width:'10%'}}>{t('colStatus')}</th>
                <th style={{width:'13%'}}>{t('colStaff')}</th>
              </tr>
            </thead>
            <tbody>
              {[...kitchen, ...(server.length ? [{_divider:true}, ...server] : [])].map((item, idx) => {
                if (item._divider) return (
                  <tr key="div">
                    <td colSpan={7} style={{padding:'6px 10px',background:'var(--bg-2)',fontSize:12,fontWeight:500,color:'#3C3489'}}>
                      ▸ サーバー棚卸し（アルコール・ドリンク）
                    </td>
                  </tr>
                );
                const cur = item.current_stock || 0;
                const needed = Math.max(0, item.min_stock - cur);
                const isSrv = item.vendor === SERVER_VENDOR;
                const bc = needed > 0 ? 'order' : cur < item.min_stock * 1.3 ? 'low' : 'ok';
                const bl = needed > 0 ? t('badgeOrder') : cur < item.min_stock * 1.3 ? t('badgeLow') : t('badgeOk');
                const name = itemName(item, lang);
                return (
                  <tr key={item.id || idx}>
                    <td title={name}>{name}</td>
                    <td>
                      <span className="vendor-badge" style={{background:vcolor(item.vendor,1),color:vcolor(item.vendor,2)}}>
                        {isSrv ? 'サーバー' : item.vendor}
                      </span>
                    </td>
                    <td>{cur} <span className="unit-label">{item.unit}</span></td>
                    <td>{item.min_stock} <span className="unit-label">{item.unit}</span></td>
                    <td style={{fontWeight:needed>0?500:400,color:needed>0?'#A32D2D':'var(--text-2)'}}>
                      {needed > 0 ? `+${needed} ${item.unit}` : '—'}
                    </td>
                    <td><span className={`badge b-${bc}`}>{bl}</span></td>
                    <td>
                      {item.staff_stamp
                        ? <span className="stamp">{item.staff_stamp} {item.stamp_time}</span>
                        : <span style={{color:'var(--text-2)',fontSize:11}}>—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Gmail modal */}
      {showGmail && (
        <div className="modal-bg open">
          <div className="modal">
            <div className="modal-title"><i className="ti ti-mail" /> {t('gmailTitle')}</div>
            <div className="gmail-info"><i className="ti ti-info-circle" /> {t('gmailInfo')}</div>
            <div className="form-row">
              <label className="form-label">{t('gmailTo')}</label>
              <input className="form-input" value={mailTo} onChange={e=>setMailTo(e.target.value)} placeholder="manager@tanto-hi.com" />
            </div>
            <div className="form-row">
              <label className="form-label">{t('gmailSubject')}</label>
              <input className="form-input" value={mailSubject} onChange={e=>setMailSubject(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">{t('gmailBody')}</label>
              <textarea className="form-input" rows={8} style={{resize:'vertical',fontSize:12,fontFamily:'monospace'}} value={mailBody} onChange={e=>setMailBody(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn-outline" onClick={()=>setShowGmail(false)}>{t('gmailCancel')}</button>
              <button className="btn-primary" onClick={openGmail}><i className="ti ti-external-link" /> {t('gmailOpen')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// HISTORY TAB
// ─────────────────────────────────────────────────────
function HistoryTab({ lang, t, sessions, showToast }) {
  const [monthFilter, setMonthFilter] = useState('');
  const [activeId, setActiveId]       = useState(null);
  const [detail, setDetail]           = useState(null);

  const months = [...new Set(sessions.map(s=>s.month))].sort().reverse();
  const filtered = sessions.filter(s => !monthFilter || s.month === monthFilter);

  useEffect(() => {
    if (filtered.length && !activeId) setActiveId(filtered[0].id);
  }, [filtered, activeId]);

  useEffect(() => {
    if (activeId) {
      api.getSession(activeId).then(setDetail).catch(console.error);
    }
  }, [activeId]);

  if (!sessions.length) return <div className="empty-state">{t('historyEmpty')}</div>;

  return (
    <div>
      <div className="section-header">
        <div className="section-title">{t('historyTitle')}</div>
        <select className="form-input" style={{width:'auto',fontSize:13}} value={monthFilter} onChange={e=>setMonthFilter(e.target.value)}>
          <option value="">{t('historyAll')}</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="history-tabs">
        {filtered.map(s => (
          <button key={s.id} className={`htab${s.id===activeId?' active':''}`} onClick={()=>setActiveId(s.id)}>
            {s.date} {s.time}{s.staff_name ? ` — ${s.staff_name}` : ''}
          </button>
        ))}
      </div>

      {!detail ? <div style={{color:'var(--text-2)',fontSize:13,padding:'1rem 0'}}>{t('loading')}</div> : (
        <div>
          <div style={{marginBottom:'1rem',fontSize:13,color:'var(--text-2)'}}>
            {t('historyDate')}: <strong style={{color:'var(--text)'}}>{detail.date} {detail.time}</strong>
            {detail.vendorStamps && (
              <div className="stamp-row">
                {Object.keys(detail.vendorStamps).map(v => (
                  <span key={v} className="stamp">{v}: {detail.vendorStamps[v].staff} {detail.vendorStamps[v].time}</span>
                ))}
              </div>
            )}
          </div>
          {[...KITCHEN_VENDORS, SERVER_VENDOR].map(v => {
            const vItems = detail.items.filter(i => i.vendor === v);
            if (!vItems.length) return null;
            const stamp = detail.vendorStamps?.[v];
            const isServer = v === SERVER_VENDOR;
            return (
              <div key={v} style={{marginBottom:'1.25rem'}}>
                <div className="vendor-header">
                  <div className="vt-dot" style={{background:vcolor(v,0)}} />
                  <span style={{fontSize:13,fontWeight:500}}>{isServer ? t('serverLabel') : v}</span>
                  {stamp && <span style={{fontSize:11,color:'var(--text-2)'}}>{t('stampedBy')} {stamp.staff} {stamp.time}</span>}
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{fontSize:12}}>
                    <thead>
                      <tr>
                        <th style={{width:'36%'}}>{t('colItem')}</th>
                        <th style={{width:'14%'}}>{t('colStock')}</th>
                        <th style={{width:'14%'}}>{t('scardMin')}</th>
                        <th style={{width:'18%'}}>{t('colOrderQty')}</th>
                        <th style={{width:'18%'}}>{t('colState')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vItems.map(item => {
                        const cur = item.current_stock || 0;
                        const n = Math.max(0, item.min_stock - cur);
                        const bc = n>0?'order':cur<item.min_stock*1.3?'low':'ok';
                        const bl = n>0?t('badgeOrderS'):cur<item.min_stock*1.3?t('badgeLowS'):t('badgeOkS');
                        return (
                          <tr key={item.id}>
                            <td style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={itemName(item,lang)}>{itemName(item,lang)}</td>
                            <td>{cur} {item.unit}</td>
                            <td>{item.min_stock} {item.unit}</td>
                            <td style={{color:n>0?'#A32D2D':'var(--text-2)'}}>{n>0?`+${n} ${item.unit}`:'—'}</td>
                            <td><span className={`badge b-${bc}`}>{bl}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// SETTINGS TAB
// ─────────────────────────────────────────────────────
function SettingsTab({ lang, t, items, setItems, adminEmail, setAdminEmail, showToast }) {
  const [email, setEmail] = useState(adminEmail);
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    setSaving(true);
    try {
      await api.postSetting('adminEmail', email);
      setAdminEmail(email);
      showToast(t('toastSave'));
    } catch(e) {
      showToast(t('toastError'));
    } finally {
      setSaving(false);
    }
  }

  const ALL_CATEGORIES = ['肉・海鮮','野菜・卵','麺・米','調味料','乾物・ストック','冷凍・その他','サーバー'];

  async function patchItem(item, field, value) {
    const updated = { unit: item.unit, min_stock: item.min_stock, category: item.category, [field]: value };
    try {
      const result = await api.patchItem(item.id, updated);
      setItems(its => its.map(i => i.id === item.id ? { ...i, ...result } : i));
    } catch(e) {
      showToast(t('toastError'));
    }
  }

  return (
    <div>
      <div className="section-header">
        <div className="section-title">{t('settingsTitle')}</div>
        <button className="btn-primary" onClick={saveAll} disabled={saving}>
          <i className="ti ti-device-floppy" /> {saving ? t('saving') : t('saveBtn')}
        </button>
      </div>

      <div className="settings-grid">
        {items.map(item => {
          const isServer = item.vendor === SERVER_VENDOR;
          return (
            <div key={item.id} className="scard" style={isServer?{borderColor:'#AFA9EC'}:{}}>
              <div className="scard-name">
                <span style={{fontSize:10,background:'var(--bg-2)',color:'var(--text-2)',padding:'1px 6px',borderRadius:8,flexShrink:0}}>{item.category}</span>
                {item.name_ja}
              </div>
              <div className="scard-row">
                <span className="scard-label">{lang==='en'?'Category':lang==='zh'?'类别':'カテゴリー'}</span>
                <select
                  className="scard-input"
                  defaultValue={item.category}
                  onChange={e => patchItem(item, 'category', e.target.value)}
                  style={{width:130,fontSize:11,textAlign:'right'}}
                >
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="scard-row">
                <span className="scard-label">{t('scardUnit')}</span>
                <input
                  className="scard-input" defaultValue={item.unit}
                  onBlur={e => patchItem(item, 'unit', e.target.value)}
                />
              </div>
              <div className="scard-row">
                <span className="scard-label">{t('scardMin')}</span>
                <input
                  className="scard-input" type="number" defaultValue={item.min_stock}
                  onBlur={e => patchItem(item, 'min_stock', parseInt(e.target.value)||0)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:'1.5rem',paddingTop:'1rem',borderTop:'0.5px solid var(--border)'}}>
        <div style={{fontSize:14,fontWeight:500,marginBottom:8}}>{t('emailTitle')}</div>
        <div className="form-row">
          <label className="form-label">{t('emailLabel')}</label>
          <input className="form-input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="sales@tanto-otabe.com" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// MANUAL MODAL
// ─────────────────────────────────────────────────────
const MANUAL_STEPS = {
  ja: [
    {
      num: '1', color: '#D85A30',
      title: '言語を選択する',
      sub: 'Select Language',
      body: '画面右上の言語ボタンをタップして、使いやすい言語に切り替えます。「日本語」「English」「中文」から選択できます。',
      tip: '一度選ぶと表示がすぐ切り替わります。',
    },
    {
      num: '2', color: '#D85A30',
      title: '担当ベンダーを選択する',
      sub: 'Select Your Vendor',
      body: '担当者名を入力後、リストから担当ベンダーを選択します。サーバーの方は「サーバー棚卸し」を選択。オレンジ色でハイライトされたら「棚卸しを開始する」をタップします。',
      tip: '担当外のベンダーは選ばないでください。複数担当の場合は複数選択も可能です。',
    },
    {
      num: '3', color: '#D85A30',
      title: '在庫をカウントする',
      sub: 'Count Inventory',
      body: '各アイテムの現在庫数を「＋」「－」ボタンまたは直接入力で記録します。途中で止める場合は「このベンダーを保存」で途中保存できます。',
      tip: '数が不確かな場合は 0 のままにし、確認してから入力してください。',
    },
    {
      num: '✓', color: '#1D9E75',
      title: '完了して送信する',
      sub: 'Complete & Send',
      body: '全アイテムの入力が終わったら「全て完了・送信」ボタンをタップします。管理者画面に結果が表示されれば完了です。送信ボタンを押さずに閉じた場合、データは送信されません。',
      tip: '送信完了後は管理者に報告してください。',
    },
  ],
  en: [
    {
      num: '1', color: '#D85A30',
      title: 'Select Language',
      sub: '言語を選択する',
      body: 'Tap the language buttons in the top right to switch to your preferred language: 日本語, English, or 中文.',
      tip: 'The display switches immediately after selection.',
    },
    {
      num: '2', color: '#D85A30',
      title: 'Select Your Vendor',
      sub: '担当ベンダーを選択',
      body: 'Enter your name, then tap your assigned vendor from the list. Servers should select "Server Inventory". Once highlighted in orange, tap "Start Counting".',
      tip: 'Only select your assigned vendor(s). Do not select vendors you are not responsible for.',
    },
    {
      num: '3', color: '#D85A30',
      title: 'Count Inventory',
      sub: '在庫をカウントする',
      body: 'Enter the current stock for each item using the + and − buttons or by typing directly. You can save progress mid-way with "Save This Vendor".',
      tip: 'If unsure of a count, leave it at 0 and verify before submitting.',
    },
    {
      num: '✓', color: '#1D9E75',
      title: 'Complete & Send',
      sub: '完了して送信する',
      body: 'Once all items are entered, tap "Complete & Send All". Results will appear in the admin view. If you close the app without tapping this button, data will NOT be saved.',
      tip: 'Please notify your manager after submitting.',
    },
  ],
  zh: [
    {
      num: '1', color: '#D85A30',
      title: '选择语言',
      sub: 'Select Language',
      body: '点击右上角的语言按钮，切换到您偏好的语言：日本語、English 或 中文。',
      tip: '选择后页面会立即切换。',
    },
    {
      num: '2', color: '#D85A30',
      title: '选择负责的供应商',
      sub: 'Select Your Vendor',
      body: '输入您的姓名后，从列表中选择您负责的供应商。服务员请选择「サーバー棚卸し」。选中后变为橙色高亮，点击「开始盘点」。',
      tip: '请只选择您负责的供应商，不要选择其他供应商。',
    },
    {
      num: '3', color: '#D85A30',
      title: '盘点库存',
      sub: 'Count Inventory',
      body: '使用 ＋ 和 － 按钮或直接输入，记录每个商品的当前库存数量。中途可以点击「保存此供应商」暂时保存进度。',
      tip: '如果不确定数量，请先填 0，确认后再修改。',
    },
    {
      num: '✓', color: '#1D9E75',
      title: '完成并提交',
      sub: 'Complete & Send',
      body: '所有商品录入完成后，点击「全部完成并发送」按钮。管理员界面出现结果即表示提交成功。如果不点击此按钮直接关闭，数据将不会被保存。',
      tip: '提交后请通知管理员。',
    },
  ],
};

function ManualModal({ lang, onClose }) {
  const [openStep, setOpenStep] = useState(null);
  const steps = MANUAL_STEPS[lang] || MANUAL_STEPS.ja;
  const title = lang==='en' ? 'How to Use' : lang==='zh' ? '使用说明' : '棚卸しの使い方';
  const sub   = lang==='en' ? 'Inventory System Manual' : lang==='zh' ? 'Inventory System Manual' : 'Inventory System Manual';
  const appLink = lang==='en' ? 'Open App' : lang==='zh' ? '打开应用' : 'アプリを開く';

  return (
    <div
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:200, padding:'1rem',
      }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}
    >
      <div style={{
        background:'var(--bg)', borderRadius:'var(--radius)', border:'0.5px solid var(--border)',
        width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', position:'relative',
        padding:'1.25rem',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{position:'absolute',top:12,right:14,background:'none',border:'none',fontSize:20,color:'var(--text-2)',cursor:'pointer',lineHeight:1}}
        >×</button>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'1rem'}}>
          <div style={{width:36,height:36,background:'#D85A30',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <i className="ti ti-clipboard-list" style={{fontSize:18,color:'white'}} aria-hidden="true" />
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:500,color:'var(--text)'}}>{title}</div>
            <div style={{fontSize:11,color:'var(--text-2)'}}>{sub}</div>
          </div>
        </div>

        {/* Steps */}
        {steps.map((step, i) => (
          <div key={i} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:'var(--radius)',marginBottom:8,overflow:'hidden'}}>
            <div
              onClick={() => setOpenStep(openStep===i ? null : i)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer',background:openStep===i?'var(--bg-2)':'var(--bg)'}}
            >
              <div style={{width:32,height:32,borderRadius:'50%',background:step.color,color:'white',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {step.num}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'#D85A30',fontWeight:500,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:1}}>Step {i+1}</div>
                <div style={{fontSize:14,fontWeight:500,color:'var(--text)'}}>{step.title}</div>
                <div style={{fontSize:11,color:'var(--text-2)'}}>{step.sub}</div>
              </div>
              <span style={{fontSize:16,color:'var(--text-2)',transform:openStep===i?'rotate(90deg)':'none',transition:'transform 0.2s',display:'inline-block'}}>›</span>
            </div>
            {openStep === i && (
              <div style={{padding:'0 14px 14px',borderTop:'0.5px solid var(--border)'}}>
                <p style={{fontSize:13,color:'var(--text)',lineHeight:1.7,marginTop:12}}>{step.body}</p>
                <div style={{background:'#FAECE7',borderRadius:8,padding:'8px 12px',marginTop:10,display:'flex',gap:8,alignItems:'flex-start'}}>
                  <i className="ti ti-info-circle" style={{fontSize:14,color:'#D85A30',flexShrink:0,marginTop:1}} aria-hidden="true" />
                  <p style={{fontSize:12,color:'#993C1D',lineHeight:1.6,margin:0}}>{step.tip}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* App link */}
        <div style={{marginTop:14,background:'var(--bg-2)',borderRadius:'var(--radius)',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:13,color:'var(--text-2)'}}>{appLink}</div>
          <a
            href="https://lively-cat-production.up.railway.app"
            target="_blank" rel="noreferrer"
            style={{background:'#D85A30',color:'white',padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:500,textDecoration:'none'}}
          >
            lively-cat-production.up.railway.app →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// LOCATION SELECT
// ─────────────────────────────────────────────────────
const LOCATIONS = [
  { key: 'Piikoi',     label: 'Piikoi店',     labelEn: 'Piikoi',     labelZh: 'Piikoi店' },
  { key: 'University', label: 'University店',  labelEn: 'University', labelZh: 'University店' },
];

function LocationSelect({ lang, onSelect }) {
  const title   = lang==='en' ? 'Select Store' : lang==='zh' ? '选择店铺' : '店舗を選択してください';
  const sub     = lang==='en' ? 'Choose your location to begin.' : lang==='zh' ? '请选择您所在的店铺。' : 'どちらの店舗ですか？';

  return (
    <div style={{maxWidth:440,margin:'4rem auto',textAlign:'center',padding:'0 1rem'}}>
      <div style={{fontSize:40,marginBottom:'1rem'}}>🏮</div>
      <div style={{fontSize:18,fontWeight:500,color:'var(--text)',marginBottom:6}}>{title}</div>
      <div style={{fontSize:13,color:'var(--text-2)',marginBottom:'2rem'}}>{sub}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {LOCATIONS.map(loc => (
          <button
            key={loc.key}
            onClick={() => onSelect(loc.key)}
            style={{
              background:'var(--bg)', border:'0.5px solid var(--border)',
              borderRadius:'var(--radius)', padding:'2rem 1rem',
              cursor:'pointer', transition:'all 0.15s',
              display:'flex', flexDirection:'column', alignItems:'center', gap:8,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#D85A30'; e.currentTarget.style.background='#FAECE7'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--bg)'; }}
          >
            <div style={{width:48,height:48,borderRadius:12,background:'#D85A30',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <i className="ti ti-building-store" style={{fontSize:24,color:'white'}} aria-hidden="true" />
            </div>
            <div style={{fontSize:16,fontWeight:500,color:'var(--text)'}}>
              {lang==='en' ? loc.labelEn : lang==='zh' ? loc.labelZh : loc.label}
            </div>
            <div style={{fontSize:11,color:'var(--text-2)'}}>Tanto Gyoza &amp; Ramen Bar</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ADMIN LOCK
// ─────────────────────────────────────────────────────
function AdminLock({ lang, onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  function tryUnlock() {
    if (pw === 'tanto1109') { onUnlock(); setErr(false); }
    else { setErr(true); setPw(''); }
  }

  return (
    <div style={{maxWidth:360,margin:'4rem auto',textAlign:'center',padding:'0 1rem'}}>
      <div style={{fontSize:40,marginBottom:'1rem'}}>🔒</div>
      <div style={{fontSize:16,fontWeight:500,color:'var(--text)',marginBottom:6}}>
        {lang==='en'?'Admin Access Required':lang==='zh'?'需要管理员权限':'管理者専用エリア'}
      </div>
      <div style={{fontSize:13,color:'var(--text-2)',marginBottom:'1.5rem'}}>
        {lang==='en'?'Enter the admin password to continue.':lang==='zh'?'请输入管理员密码。':'パスワードを入力してください。'}
      </div>
      <input
        className="form-input"
        type="password"
        placeholder={lang==='en'?'Password':lang==='zh'?'密码':'パスワード'}
        value={pw}
        onChange={e=>{setPw(e.target.value);setErr(false);}}
        onKeyDown={e=>e.key==='Enter'&&tryUnlock()}
        style={{marginBottom:8,textAlign:'center',fontSize:16,letterSpacing:4}}
        autoFocus
      />
      {err && <div style={{fontSize:12,color:'#A32D2D',marginBottom:8}}>
        {lang==='en'?'Incorrect password.':lang==='zh'?'密码错误。':'パスワードが違います。'}
      </div>}
      <button className="btn-primary" style={{width:'100%'}} onClick={tryUnlock}>
        {lang==='en'?'Unlock':lang==='zh'?'解锁':'ロック解除'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ADMIN AREA (sub-tabs: 発注 / 履歴 / 設定)
// ─────────────────────────────────────────────────────
function AdminArea({ lang, t, items, sessions, location, activeTab, setActiveTab, adminEmail, setAdminEmail, setItems, showToast }) {
  const subTabs = [
    { key:'admin',    labelJa:'発注',  labelEn:'Orders',   labelZh:'订货' },
    { key:'history',  labelJa:'履歴',  labelEn:'History',  labelZh:'历史' },
    { key:'settings', labelJa:'設定',  labelEn:'Settings', labelZh:'设置' },
  ];

  function label(tab) {
    if(lang==='en') return tab.labelEn;
    if(lang==='zh') return tab.labelZh;
    return tab.labelJa;
  }

  const currentTab = subTabs.find(s=>s.key===activeTab) ? activeTab : 'admin';

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:'1.25rem',background:'var(--bg-2)',padding:4,borderRadius:'var(--radius-sm)'}}>
        {subTabs.map(sub => (
          <button
            key={sub.key}
            onClick={() => setActiveTab(sub.key)}
            style={{
              flex:1, padding:'7px 8px', textAlign:'center', fontSize:13,
              border: currentTab===sub.key ? '0.5px solid var(--border)' : 'none',
              background: currentTab===sub.key ? 'var(--bg)' : 'transparent',
              color: currentTab===sub.key ? 'var(--text)' : 'var(--text-2)',
              fontWeight: currentTab===sub.key ? 500 : 400,
              borderRadius:'var(--radius-sm)', cursor:'pointer',
            }}
          >
            {label(sub)}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {currentTab === 'admin' && (
        <AdminTab
          lang={lang} t={t} items={items} sessions={sessions}
          location={location}
          adminEmail={adminEmail} setAdminEmail={setAdminEmail}
          showToast={showToast}
        />
      )}
      {currentTab === 'history' && (
        <HistoryTab lang={lang} t={t} sessions={sessions} showToast={showToast} />
      )}
      {currentTab === 'settings' && (
        <SettingsTab
          lang={lang} t={t} items={items} setItems={setItems}
          adminEmail={adminEmail} setAdminEmail={setAdminEmail}
          showToast={showToast}
        />
      )}
    </div>
  );
}
