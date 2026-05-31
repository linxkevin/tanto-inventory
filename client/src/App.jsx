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
  const DEFAULT_CATEGORIES = ['肉・海鮮','野菜・卵','麺・米','調味料','乾物・ストック','冷凍・その他','サーバー','消耗品','キッチン備品'];
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const t = (k) => UI[lang][k] || UI.ja[k] || k;

  // Load data on mount
  useEffect(() => {
    Promise.all([api.getItems(), api.getSessions(), api.getSettings(), api.getCategories()])
      .then(([its, sess, settings, cats]) => {
        setItems(its); // active items only (for staff)
        setSessions(sess);
        setAdminEmail(settings.adminEmail || '');
        if (cats && cats.length) {
          setCategories(cats.map(c => ({ name: c.name, name_en: c.name_en, name_zh: c.name_zh, icon: c.icon })));
        }
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
          <button className={`tab${tab==='receipt'?' active':''}`} onClick={()=>setTab('receipt')}>
            {lang==='en'?'📷 Delivery':lang==='zh'?'📷 入库':'📷 納品'}
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
          adminEmail={adminEmail} categories={categories}
          onComplete={() => {
            refreshSessions();
          }}
          showToast={showToast}
        />
      )}
      {location && tab === 'receipt' && (
        <ReceiptTab lang={lang} showToast={showToast} location={location} />
      )}

      {location && ['admin','history','settings','order'].includes(tab) && (
        adminUnlocked
          ? <AdminArea
              lang={lang} t={t} items={items} sessions={sessions}
              location={location} activeTab={tab} setActiveTab={setTab}
              adminEmail={adminEmail} setAdminEmail={setAdminEmail}
              setItems={setItems} showToast={showToast}
              categories={categories} setCategories={setCategories}
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
function StaffTab({ lang, t, items, location, adminEmail, categories: catProp, onComplete, showToast }) {
  const [screen, setScreen]           = useState('top'); // 'top' | 'count' | 'done'
  const [staffName, setStaffName]     = useState('');
  const [selected, setSelected]       = useState([]);
  const [activeVendor, setActiveVendor] = useState(null);
  const [savedVendors, setSavedVendors] = useState({});
  const [counts, setCounts]           = useState({}); // { itemId: value }
  const [completedInfo, setCompletedInfo] = useState(null); // { staffName, categories, date, time, location }

  // Use categories from App state (managed in settings)
  const CATEGORIES = catProp || ['肉・海鮮','野菜・卵','麺・米','調味料','乾物・ストック','冷凍・その他','サーバー'];
  const CAT_LABELS = {
    ja: {'肉・海鮮':'肉・海鮮','野菜・卵':'野菜・卵','麺・米':'麺・米','調味料':'調味料','乾物・ストック':'乾物・ストック','冷凍・その他':'冷凍・その他','サーバー':'サーバー','消耗品':'消耗品','キッチン備品':'キッチン備品'},
    en: {'肉・海鮮':'Meat & Seafood','野菜・卵':'Vegetables & Eggs','麺・米':'Noodles & Rice','調味料':'Seasonings','乾物・ストック':'Dry Goods','冷凍・その他':'Frozen & Other','サーバー':'Server (Bar)','消耗品':'Supplies','キッチン備品':'Kitchen Supplies'},
    zh: {'肉・海鮮':'肉类・海鲜','野菜・卵':'蔬菜・鸡蛋','麺・米':'面条・米饭','調味料':'调味料','乾物・ストック':'干货','冷凍・その他':'冷冻・其他','サーバー':'服务员（酒水）','消耗品':'耗材','キッチン備品':'厨房用品'},
  };
  const CAT_ICONS = {'肉・海鮮':'ti-meat','野菜・卵':'ti-leaf','麺・米':'ti-bowl','調味料':'ti-salt','乾物・ストック':'ti-package','冷凍・その他':'ti-snowflake','サーバー':'ti-glass-full','消耗品':'ti-box','キッチン備品':'ti-tool'};
  const CAT_COLORS = {'肉・海鮮':'#E24B4A','野菜・卵':'#1D9E75','麺・米':'#BA7517','調味料':'#378ADD','乾物・ストック':'#534AB7','冷凍・その他':'#888780','サーバー':'#993556','消耗品':'#4A7B6F','キッチン備品':'#7B6F4A'};

  function getCatName(c) { return typeof c==='string' ? c : c.name; }
  function getCatIcon(c) { return typeof c==='object' && c.icon ? c.icon : (CAT_ICONS[getCatName(c)] || 'ti-tag'); }
  function getCatColor(c) { return CAT_COLORS[getCatName(c)] || '#888780'; }
  function catLabel(c) {
    const n = getCatName(c);
    // Use translated names from DB if available
    if (typeof c === 'object') {
      if (lang === 'en' && c.name_en) return c.name_en;
      if (lang === 'zh' && c.name_zh) return c.name_zh;
    }
    // Fall back to hardcoded translations
    return (CAT_LABELS[lang]||CAT_LABELS.ja)[n] || n;
  }
  function getCatItems(c) { return items.filter(i => i.category === getCatName(c)); }

  function toggleCat(c) {
    const name = getCatName(c);
    setSelected(s => s.includes(name) ? s.filter(x=>x!==name) : [...s, name]);
  }
  function toggleAll() {
    setSelected(s => s.length === CATEGORIES.length ? [] : CATEGORIES.map(getCatName));
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

    const catListJa = completedInfo.categories.map(c=>{const n=typeof c==='string'?c:c.name; return catLabelsJa[n]||n;}).join('、');
    const catListEn = completedInfo.categories.map(c=>{const n=typeof c==='string'?c:c.name; return catLabelsEn[n]||n;}).join(', ');
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
            {completedInfo.categories.map(c=>{ const n=typeof c==='string'?c:c.name; return (
              <span key={n} style={{fontSize:12,fontWeight:500,background:'#E1F5EE',color:'#085041',padding:'3px 10px',borderRadius:10}}>
                ✓ {cl[n]||n}
              </span>
            );})}
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
          const isSel = selected.includes(getCatName(c));
          const isDone = !!savedVendors[getCatName(c)];
          return (
            <div
              key={c}
              className={`vendor-tile${isSel?' selected':''}${isDone?' done':''}`}
              onClick={() => toggleCat(c)}
            >
              <div style={{width:36,height:36,borderRadius:9,background:isSel?getCatColor(c):'var(--bg-2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
                <i className={`ti ${getCatIcon(c)}`} style={{fontSize:18,color:isSel?'white':getCatColor(c)}} aria-hidden="true" />
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
          const isDone = !!savedVendors[getCatName(c)];
          const isActive = getCatName(c) === activeVendor;
          return (
            <button
              key={c}
              className={`vtab${isActive?' active':''}${isDone?' completed':''}`}
              style={isActive ? {background:getCatColor(c),color:'white',borderColor:getCatColor(c)} : {}}
              onClick={() => setActiveVendor(c)}
            >
              {isDone && <span className="vtab-dot" />}
              <i className={`ti ${getCatIcon(c)}`} style={{fontSize:12}} aria-hidden="true" />
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
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [showGmail, setShowGmail]         = useState(false);
  const [mailTo, setMailTo]               = useState(adminEmail);
  const [mailSubject, setMailSubject]     = useState('');
  const [mailBody, setMailBody]           = useState('');
  const [sortMode, setSortMode]           = useState('vendor'); // 'vendor' | 'category'
  const [statusFilter, setStatusFilter]   = useState('all'); // 'all' | 'ok' | 'low' | 'order'

  useEffect(() => {
    if (sessions.length) {
      const id = selectedSessionId || sessions[0].id;
      api.getSession(id).then(setLatestSession).catch(console.error);
    }
  }, [sessions, selectedSessionId]);

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
      {/* Session selector */}
      <div style={{marginBottom:'1rem',background:'var(--bg-2)',borderRadius:'var(--radius)',padding:'10px 14px',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',whiteSpace:'nowrap'}}>
          <i className="ti ti-calendar" aria-hidden="true" style={{marginRight:4}} />
          {lang==='en'?'Select Session:':lang==='zh'?'选择盘点记录:':'棚卸しを選択:'}
        </div>
        <select
          className="form-input"
          style={{flex:1,minWidth:200,fontSize:13}}
          value={selectedSessionId || (sessions[0]?.id || '')}
          onChange={e => { setSelectedSessionId(Number(e.target.value)); setStatusFilter('all'); }}
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.date} {s.time}{s.staff_name ? ` — ${s.staff_name}` : ''}{s.location ? ` (${s.location})` : ''}
            </option>
          ))}
        </select>
        {selectedSessionId && selectedSessionId !== sessions[0]?.id && (
          <button
            onClick={() => { setSelectedSessionId(null); setStatusFilter('all'); }}
            style={{fontSize:12,padding:'4px 10px',borderRadius:10,border:'0.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',color:'var(--text-2)',whiteSpace:'nowrap'}}
          >
            {lang==='en'?'← Latest':lang==='zh'?'← 最新':'← 最新へ'}
          </button>
        )}
      </div>

      {/* Summary cards — clickable filters */}
      <div className="summary-cards">
        {[
          [t('sTotal'), sessionItems.length, '', 'all'],
          [t('sOk'), ok, '', 'ok'],
          [t('sLow'), low, 'warn', 'low'],
          [t('sOrder'), ord, 'danger', 'order'],
        ].map(([label, val, cls, filterKey]) => {
          const isActive = statusFilter === filterKey;
          return (
            <div key={label} className="sum-card" onClick={() => setStatusFilter(isActive ? 'all' : filterKey)}
              style={{cursor:'pointer', border: isActive ? '2px solid #D85A30' : '2px solid transparent',
                transition:'all 0.15s', borderRadius:'var(--radius-sm)'}}>
              <div className="sum-label">{label}</div>
              <div className={`sum-value${cls?' '+cls:''}`}>{val || '—'}</div>
              {isActive && <div style={{fontSize:10,color:'#D85A30',marginTop:4,fontWeight:500}}>
                {lang==='en'?'✓ Filtered':lang==='zh'?'✓ 已筛选':'✓ フィルター中'}
              </div>}
            </div>
          );
        })}
      </div>

      <div className="section-header">
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <div className="section-title">{t('adminTitle')}</div>
          {location && <span style={{fontSize:11,fontWeight:500,background:'#FAECE7',color:'#993C1D',padding:'2px 10px',borderRadius:10}}>{locationLabel}</span>}
          {latestSession && (
            <span style={{fontSize:11,color:'var(--text-2)'}}>
              {latestSession.date} {latestSession.time}
              {latestSession.staff_name ? ` — ${latestSession.staff_name}` : ''}
            </span>
          )}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {/* Sort toggle */}
          <div style={{display:'flex',background:'var(--bg-2)',borderRadius:'var(--radius-sm)',border:'0.5px solid var(--border)',overflow:'hidden'}}>
            <button onClick={()=>setSortMode('vendor')}
              style={{padding:'6px 12px',fontSize:12,border:'none',cursor:'pointer',fontWeight:sortMode==='vendor'?500:400,
                background:sortMode==='vendor'?'#D85A30':'transparent',
                color:sortMode==='vendor'?'white':'var(--text-2)'}}>
              <i className="ti ti-building-store" aria-hidden="true" style={{fontSize:12,marginRight:4}} />
              {lang==='en'?'By Vendor':lang==='zh'?'按供应商':'業者別'}
            </button>
            <button onClick={()=>setSortMode('category')}
              style={{padding:'6px 12px',fontSize:12,border:'none',cursor:'pointer',fontWeight:sortMode==='category'?500:400,
                background:sortMode==='category'?'#D85A30':'transparent',
                color:sortMode==='category'?'white':'var(--text-2)'}}>
              <i className="ti ti-tag" aria-hidden="true" style={{fontSize:12,marginRight:4}} />
              {lang==='en'?'By Category':lang==='zh'?'按类别':'カテゴリー別'}
            </button>
          </div>
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
                <th style={{width:'26%'}}>{t('colItem')}</th>
                <th style={{width:'16%'}}>{sortMode==='category'?(lang==='en'?'Category':lang==='zh'?'类别':'カテゴリー'):t('colVendor')}</th>
                <th style={{width:'10%'}}>{t('colCurrent')}</th>
                <th style={{width:'10%'}}>{t('colMin')}</th>
                <th style={{width:'11%'}}>{t('colOrder')}</th>
                <th style={{width:'10%'}}>{t('colStatus')}</th>
                <th style={{width:'17%'}}>{t('colStaff')}</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Apply status filter
                const filterFn = (item) => {
                  if (statusFilter === 'all') return true;
                  const cur = item.current_stock || 0;
                  const needed = Math.max(0, item.min_stock - cur);
                  if (statusFilter === 'order') return needed > 0;
                  if (statusFilter === 'low')   return needed === 0 && cur < item.min_stock * 1.3;
                  if (statusFilter === 'ok')    return needed === 0 && cur >= item.min_stock * 1.3;
                  return true;
                };

                // Build rows based on sortMode
                if (sortMode === 'category') {
                  const cats = [...new Set(sessionItems.map(i => i.category).filter(Boolean))].sort();
                  const rows = [];
                  cats.forEach(cat => {
                    const catItems = sessionItems.filter(i => i.category === cat).filter(filterFn);
                    if (!catItems.length) return;
                    rows.push({ _divider: true, label: cat, color: '#534AB7' });
                    catItems.forEach(i => rows.push(i));
                  });
                  return rows;
                } else {
                  const filteredKitchen = kitchen.filter(filterFn);
                  const filteredServer  = server.filter(filterFn);
                  return [...filteredKitchen, ...(filteredServer.length ? [{_divider:true, label:'サーバー棚卸し（アルコール・ドリンク）', color:'#3C3489'}, ...filteredServer] : [])];
                }
              })().map((item, idx) => {
                if (item._divider) return (
                  <tr key={`div-${idx}`}>
                    <td colSpan={7} style={{padding:'6px 10px',background:'var(--bg-2)',fontSize:12,fontWeight:500,color:item.color||'#3C3489'}}>
                      ▸ {item.label}
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
                      <span className="vendor-badge" style={{
                        background: sortMode==='category' ? 'var(--bg-2)' : vcolor(item.vendor,1),
                        color: sortMode==='category' ? 'var(--text-2)' : vcolor(item.vendor,2)
                      }}>
                        {sortMode==='category' ? (isSrv ? 'サーバー' : item.vendor) : (isSrv ? 'サーバー' : item.vendor)}
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
function SettingsTab({ lang, t, items, setItems, adminEmail, setAdminEmail, categories, setCategories, showToast }) {
  const [email, setEmail] = useState(adminEmail);
  const [saving, setSaving] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('ti-tag');
  const [allItems, setAllItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name_ja:'', unit:'個', vendor:'', min_stock:2, category:'' });
  const [settingsFilter, setSettingsFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState(null); // item being edited
  const [matchingItem, setMatchingItem] = useState(null); // item for matching info

  // Load ALL items (including inactive) for settings
  useEffect(() => {
    api.getItems(true).then(setAllItems).catch(console.error);
  }, []);

  function refreshAllItems() {
    api.getItems(true).then(setAllItems).catch(console.error);
    api.getItems().then(setItems).catch(console.error);
  }

  async function toggleActive(item) {
    try {
      const updated = await api.patchItem(item.id, {
        unit: item.unit, min_stock: item.min_stock,
        category: item.category, active: !item.active
      });
      setAllItems(its => its.map(i => i.id===item.id ? {...i, active: updated.active} : i));
      setItems(its => !updated.active
        ? its.filter(i => i.id !== item.id)
        : [...its, updated].sort((a,b) => a.id-b.id)
      );
      showToast(updated.active
        ? (lang==='en'?'Item enabled.':lang==='zh'?'商品已启用。':'アイテムを有効にしました。')
        : (lang==='en'?'Item hidden.':lang==='zh'?'商品已隐藏。':'アイテムを非表示にしました。')
      );
    } catch(e) { showToast(t('toastError')); }
  }

  async function deleteItem(item) {
    const confirmMsg = lang==='en'
      ? `Delete "${item.name_ja}"? This cannot be undone.`
      : lang==='zh' ? `确定删除"${item.name_ja}"？此操作无法撤销。`
      : `「${item.name_ja}」を削除しますか？この操作は取り消せません。`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.deleteItem(item.id);
      setAllItems(its => its.filter(i => i.id !== item.id));
      setItems(its => its.filter(i => i.id !== item.id));
      showToast(lang==='en'?'Item deleted.':lang==='zh'?'商品已删除。':'アイテムを削除しました。');
    } catch(e) { showToast(t('toastError')); }
  }

  async function updateItem() {
    if (!editingItem) return;
    showToast(lang==='en'?'Saving...':lang==='zh'?'保存中...':'保存中...');
    try {
      // Auto-translate if name changed
      let name_en = editingItem.name_en, name_zh = editingItem.name_zh;
      const originalItem = allItems.find(i => i.id===editingItem.id);
      if (originalItem && originalItem.name_ja !== editingItem.name_ja) {
        try {
          const t2 = await translateJa(editingItem.name_ja, 'item');
          name_en = t2.en; name_zh = t2.zh;
        } catch(e) { console.warn('Translation failed'); }
      }
      const updated = await api.patchItem(editingItem.id, {
        name_ja: editingItem.name_ja,
        name_en,
        name_zh,
        unit: editingItem.unit,
        min_stock: editingItem.min_stock,
        category: editingItem.category,
        active: editingItem.active !== false,
        vendor_item_name: editingItem.vendor_item_name || '',
        vendor_item_code: editingItem.vendor_item_code || '',
        order_item_name: editingItem.order_item_name || '',
      });
      setAllItems(its => its.map(i => i.id===editingItem.id ? {...i, ...updated} : i));
      setItems(its => its.map(i => i.id===editingItem.id ? {...i, ...updated} : i));
      setEditingItem(null);
      showToast(lang==='en'?'Item updated.':lang==='zh'?'商品已更新。':'アイテムを更新しました。');
    } catch(e) { showToast(t('toastError')); }
  }

  async function saveMatchingInfo() {
    if (!matchingItem) return;
    try {
      const updated = await api.patchItem(matchingItem.id, {
        name_ja: matchingItem.name_ja,
        name_en: matchingItem.name_en,
        name_zh: matchingItem.name_zh,
        unit: matchingItem.unit,
        min_stock: matchingItem.min_stock,
        category: matchingItem.category,
        active: matchingItem.active !== false,
        vendor_item_name: matchingItem.vendor_item_name || '',
        vendor_item_code: matchingItem.vendor_item_code || '',
        order_item_name: matchingItem.order_item_name || '',
      });
      setAllItems(its => its.map(i => i.id===matchingItem.id ? {...i, ...updated} : i));
      setItems(its => its.map(i => i.id===matchingItem.id ? {...i, ...updated} : i));
      setMatchingItem(null);
      showToast('突合情報を保存しました。');
    } catch(e) { showToast(t('toastError')); }
  }

  async function addNewItem() {
    if (!newItem.name_ja.trim()) { showToast(lang==='en'?'Enter item name.':lang==='zh'?'请输入商品名称。':'アイテム名を入力してください。'); return; }
    showToast(lang==='en'?'Translating & adding...':lang==='zh'?'翻译并添加中...':'翻訳・追加中...');
    try {
      // Auto-translate item name
      let name_en = newItem.name_ja, name_zh = newItem.name_ja;
      try {
        const t2 = await translateJa(newItem.name_ja, 'item');
        name_en = t2.en; name_zh = t2.zh;
      } catch(e) { console.warn('Item translation failed'); }

      const created = await api.postItem({
        ...newItem,
        name_en,
        name_zh,
        category: newItem.category || (categories[0]?getCatName(categories[0]):'調味料'),
      });
      setAllItems(its => [...its, created]);
      setItems(its => [...its, created]);
      setNewItem({ name_ja:'', unit:'個', vendor:'', min_stock:2, category:'' });
      setShowAddItem(false);
      showToast(lang==='en'?`Added: ${name_en}`:lang==='zh'?`已添加: ${name_zh}`:`追加しました（EN: ${name_en}）`);
    } catch(e) { showToast(t('toastError')); }
  }

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

  // Icon options for new categories
  const ICON_OPTIONS = [
    {icon:'ti-tag', label:'汎用'},
    {icon:'ti-meat', label:'肉'},
    {icon:'ti-leaf', label:'野菜'},
    {icon:'ti-bowl', label:'麺'},
    {icon:'ti-salt', label:'調味料'},
    {icon:'ti-package', label:'乾物'},
    {icon:'ti-snowflake', label:'冷凍'},
    {icon:'ti-glass-full', label:'ドリンク'},
    {icon:'ti-fish', label:'魚'},
    {icon:'ti-egg', label:'卵'},
    {icon:'ti-bread', label:'パン'},
    {icon:'ti-milk', label:'乳製品'},
    {icon:'ti-lemon', label:'果物'},
    {icon:'ti-soup', label:'スープ'},
    {icon:'ti-bottle', label:'ボトル'},
  ];

  // Shared translation helper — calls server-side endpoint to avoid CORS
  async function translateJa(text, type='general') {
    const result = await api.translate(text, type);
    return { en: result.en || text, zh: result.zh || text };
  }

  // Translate all categories that are missing translations
  async function translateAllCategories() {
    const missing = categories.filter(c => {
      const n = typeof c==='string'?c:c.name;
      const en = typeof c==='object'?c.name_en:null;
      return !en || en === n;
    });
    if (!missing.length) { showToast(lang==='en'?'All categories already translated.':lang==='zh'?'所有类别已翻译。':'全カテゴリーが翻訳済みです。'); return; }
    showToast(lang==='en'?`Translating ${missing.length} categories...`:lang==='zh'?`正在翻译 ${missing.length} 个类别...`:`${missing.length}件のカテゴリーを翻訳中...`);
    let done = 0;
    for (const cat of missing) {
      const name = typeof cat==='string'?cat:cat.name;
      try {
        const { en, zh } = await translateJa(name, 'category');
        await api.patchCategory(name, { name_en: en, name_zh: zh });
        setCategories(cs => cs.map(c => (typeof c==='string'?c:c.name)===name ? {...(typeof c==='object'?c:{name:c}), name_en: en, name_zh: zh} : c));
        done++;
      } catch(e) { console.warn('Translation failed for', name); }
    }
    showToast(lang==='en'?`Translated ${done} categories.`:lang==='zh'?`已翻译 ${done} 个类别。`:`${done}件のカテゴリーを翻訳しました。`);
  }

  // Translate all items missing translations
  async function translateAllItems() {
    const missing = allItems.filter(i => !i.name_en || i.name_en === i.name_ja);
    if (!missing.length) {
      showToast(lang==='en'?'All items already translated.':lang==='zh'?'所有商品已翻译。':'全アイテムが翻訳済みです。');
      return;
    }
    showToast(lang==='en'?`Translating ${missing.length} items...`:lang==='zh'?`正在翻译 ${missing.length} 个商品...`:`${missing.length}件のアイテムを翻訳中...`);
    let done = 0;
    for (const item of missing) {
      try {
        const { en, zh } = await translateJa(item.name_ja, 'item');
        await api.patchItem(item.id, {
          name_ja: item.name_ja, name_en: en, name_zh: zh,
          unit: item.unit, min_stock: item.min_stock,
          category: item.category, active: item.active !== false,
        });
        setAllItems(its => its.map(i => i.id===item.id ? {...i, name_en: en, name_zh: zh} : i));
        setItems(its => its.map(i => i.id===item.id ? {...i, name_en: en, name_zh: zh} : i));
        done++;
      } catch(e) { console.warn('Translation failed for', item.name_ja); }
    }
    showToast(lang==='en'?`Translated ${done} items.`:lang==='zh'?`已翻译 ${done} 个商品。`:`${done}件のアイテムを翻訳しました。`);
  }

  async function addCategory() {
    const name = newCatInput.trim();
    if (!name) return;
    if (categories.some(c => (typeof c==='string'?c:c.name) === name)) {
      showToast(lang==='en'?'Category already exists.':lang==='zh'?'类别已存在。':'そのカテゴリーは既に存在します。');
      return;
    }
    showToast(lang==='en'?'Translating...':lang==='zh'?'翻译中...':'翻訳中...');
    try {
      // Auto-translate using Claude API
      let name_en = name, name_zh = name;
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: `Translate this Japanese food/inventory category name into English and Simplified Chinese. Reply ONLY with JSON like: {"en":"...","zh":"..."}

Japanese: ${name}`
            }]
          })
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[^}]+\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          name_en = parsed.en || name;
          name_zh = parsed.zh || name;
        }
      } catch(translationErr) {
        console.warn('Translation failed, using Japanese name:', translationErr);
      }

      const created = await api.postCategory(name, newCatIcon, name_en, name_zh);
      setCategories(c => [...c, { name, name_en, name_zh, icon: newCatIcon }]);
      setNewCatInput('');
      setNewCatIcon('ti-tag');
      showToast(lang==='en'?`Category added: ${name_en}`:lang==='zh'?`类别已添加: ${name_zh}`:`カテゴリーを追加しました（EN: ${name_en} / 中: ${name_zh}）`);
    } catch(e) {
      showToast(t('toastError'));
    }
  }

  function getCatName(c) { return typeof c==='string' ? c : c.name; }

  async function deleteCategory(cat) {
    const catName = getCatName(cat);
    const inUse = items.some(i => i.category === catName);
    if (inUse) { showToast(lang==='en'?'Cannot delete: items are using this category.':lang==='zh'?'无法删除：该类别下有商品。':'このカテゴリーを使用中のアイテムがあるため削除できません。'); return; }
    try {
      await api.deleteCategory(catName);
      setCategories(c => c.filter(x => getCatName(x) !== catName));
      showToast(lang==='en'?'Category deleted.':lang==='zh'?'类别已删除。':'カテゴリーを削除しました。');
    } catch(e) {
      showToast(t('toastError'));
    }
  }

  const ALL_CATEGORIES = categories || [];

  async function patchItem(item, field, value) {
    const updated = { unit: item.unit, min_stock: item.min_stock, category: item.category, [field]: value };
    try {
      const result = await api.patchItem(item.id, updated);
      setItems(its => its.map(i => i.id === item.id ? { ...i, ...result } : i));
      setAllItems(its => its.map(i => i.id === item.id ? { ...i, ...result } : i));
      showToast(lang==='en'?'✓ Saved.':lang==='zh'?'✓ 已保存。':'✓ 保存しました。');
    } catch(e) {
      showToast(lang==='en'?'Save failed. Please try again.':lang==='zh'?'保存失败，请重试。':'保存に失敗しました。もう一度試してください。');
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

      {/* Search bar */}
      <div style={{position:'relative',marginBottom:10}}>
        <i className="ti ti-search" aria-hidden="true" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'var(--text-2)'}} />
        <input
          className="form-input"
          placeholder={lang==='en'?'Search items...':lang==='zh'?'搜索商品...':'アイテムを検索...'}
          value={searchQuery}
          onChange={e=>setSearchQuery(e.target.value)}
          style={{paddingLeft:32}}
        />
        {searchQuery && (
          <button onClick={()=>setSearchQuery('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',fontSize:16}}>×</button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
        {[
          {key:'all', labelJa:'全て', labelEn:'All', labelZh:'全部'},
          {key:'active', labelJa:'有効', labelEn:'Active', labelZh:'启用'},
          {key:'inactive', labelJa:'非表示', labelEn:'Hidden', labelZh:'隐藏'},
        ].map(f=>(
          <button key={f.key} onClick={()=>setSettingsFilter(f.key)}
            style={{padding:'4px 12px',fontSize:12,borderRadius:20,border:'0.5px solid var(--border)',cursor:'pointer',
              background:settingsFilter===f.key?'#D85A30':'var(--bg)',
              color:settingsFilter===f.key?'white':'var(--text-2)',
              borderColor:settingsFilter===f.key?'#D85A30':'var(--border)'}}>
            {lang==='en'?f.labelEn:lang==='zh'?f.labelZh:f.labelJa}
          </button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          <button onClick={translateAllItems}
            style={{padding:'4px 12px',fontSize:12,borderRadius:20,border:'0.5px solid #378ADD',background:'#E6F1FB',color:'#042C53',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
            <i className="ti ti-language" aria-hidden="true" style={{fontSize:13}} />
            {lang==='en'?'Translate all':lang==='zh'?'一键翻译':'一括翻訳'}
          </button>
          <button onClick={()=>setShowAddItem(v=>!v)}
            style={{padding:'4px 14px',fontSize:12,borderRadius:20,border:'0.5px solid #D85A30',cursor:'pointer',background:showAddItem?'#D85A30':'transparent',color:showAddItem?'white':'#D85A30'}}>
            <i className="ti ti-plus" aria-hidden="true" /> {lang==='en'?'Add Item':lang==='zh'?'添加商品':'アイテム追加'}
          </button>
        </div>
      </div>

      {/* Add item form */}
      {showAddItem && (
        <div style={{background:'var(--bg-2)',borderRadius:'var(--radius)',padding:'1rem',marginBottom:12,border:'0.5px solid var(--border)'}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:10}}>{lang==='en'?'New Item':lang==='zh'?'新商品':'新しいアイテム'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div className="form-row" style={{margin:0}}>
              <label className="form-label">{lang==='en'?'Name (JP)':lang==='zh'?'名称（日文）':'アイテム名（日本語）'}</label>
              <input className="form-input" value={newItem.name_ja} onChange={e=>setNewItem(v=>({...v,name_ja:e.target.value}))} />
            </div>
            <div className="form-row" style={{margin:0}}>
              <label className="form-label">{lang==='en'?'Category':lang==='zh'?'类别':'カテゴリー'}</label>
              <select className="form-input" value={newItem.category} onChange={e=>setNewItem(v=>({...v,category:e.target.value}))}>
                {ALL_CATEGORIES.map(c=>{const n=typeof c==='string'?c:c.name;return <option key={n} value={n}>{n}</option>;})}
              </select>
            </div>
            <div className="form-row" style={{margin:0}}>
              <label className="form-label">{lang==='en'?'Unit':lang==='zh'?'单位':'単位'}</label>
              <input className="form-input" value={newItem.unit} onChange={e=>setNewItem(v=>({...v,unit:e.target.value}))} />
            </div>
            <div className="form-row" style={{margin:0}}>
              <label className="form-label">{lang==='en'?'Min Stock':lang==='zh'?'最低库存':'規定在庫'}</label>
              <input className="form-input" type="number" value={newItem.min_stock} onChange={e=>setNewItem(v=>({...v,min_stock:parseInt(e.target.value)||0}))} />
            </div>
            <div className="form-row" style={{margin:0}}>
              <label className="form-label">{lang==='en'?'Vendor':lang==='zh'?'供应商':'業者'}</label>
              <input className="form-input" value={newItem.vendor} onChange={e=>setNewItem(v=>({...v,vendor:e.target.value}))} />
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:10,justifyContent:'flex-end'}}>
            <button className="btn-outline" onClick={()=>setShowAddItem(false)}>{lang==='en'?'Cancel':lang==='zh'?'取消':'キャンセル'}</button>
            <button className="btn-primary" onClick={addNewItem}>{lang==='en'?'Add':lang==='zh'?'添加':'追加'}</button>
          </div>
        </div>
      )}

      {/* Item list */}
      <div className="settings-grid">
        {(allItems.length ? allItems : items)
          .filter(item => settingsFilter==='all' ? true : settingsFilter==='active' ? item.active!==false : item.active===false)
          .filter(item => !searchQuery || item.name_ja.toLowerCase().includes(searchQuery.toLowerCase()) || (item.category||'').toLowerCase().includes(searchQuery.toLowerCase()) || (item.vendor||'').toLowerCase().includes(searchQuery.toLowerCase()))
          .map(item => {
          const isHidden = item.active === false;
          return (
            <div key={item.id} className="scard" style={{opacity:isHidden?0.55:1,borderColor:isHidden?'var(--border)':'var(--border)'}}>
              <div className="scard-name" style={{justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                  <span style={{fontSize:10,background:'var(--bg-2)',color:'var(--text-2)',padding:'1px 6px',borderRadius:8,flexShrink:0}}>{item.category}</span>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name_ja}</span>
                </div>
                {isHidden && <span style={{fontSize:10,background:'#FAEEDA',color:'#633806',padding:'1px 6px',borderRadius:8,flexShrink:0}}>{lang==='en'?'Hidden':lang==='zh'?'隐藏':'非表示'}</span>}
              </div>
              <div className="scard-row">
                <span className="scard-label">{lang==='en'?'Category':lang==='zh'?'类别':'カテゴリー'}</span>
                <span style={{fontSize:11,color:'var(--text-2)'}}>{item.category}</span>
              </div>
              <div className="scard-row">
                <span className="scard-label">{t('scardUnit')}</span>
                <span style={{fontSize:11,color:'var(--text-2)'}}>{item.unit}</span>
              </div>
              <div className="scard-row">
                <span className="scard-label">{t('scardMin')}</span>
                <span style={{fontSize:11,color:'var(--text-2)'}}>{item.min_stock}</span>
              </div>
              <div style={{marginTop:8,paddingTop:8,borderTop:'0.5px solid var(--border)',display:'flex',gap:6,alignItems:'center'}}>
                <button onClick={()=>setMatchingItem({...item})}
                  style={{fontSize:11,padding:'4px 10px',borderRadius:8,border:'1px solid #D85A30',background:'transparent',color:'#D85A30',cursor:'pointer'}}>
                  🔗 突合
                </button>
                <button onClick={()=>setEditingItem({...item})}
                  style={{fontSize:12,padding:'4px 12px',borderRadius:10,border:'0.5px solid #D85A30',background:'#FAECE7',cursor:'pointer',color:'#D85A30',fontWeight:500}}>
                  <i className="ti ti-pencil" aria-hidden="true" style={{fontSize:11}} /> {lang==='en'?'Edit':lang==='zh'?'编辑':'編集'}
                </button>
                <div style={{flex:1}}></div>
                <button onClick={()=>toggleActive(item)}
                  style={{fontSize:11,padding:'3px 10px',borderRadius:10,border:'0.5px solid var(--border)',background:'transparent',cursor:'pointer',color:'var(--text-2)'}}>
                  {isHidden
                    ? (lang==='en'?'Enable':lang==='zh'?'启用':'有効')
                    : (lang==='en'?'Hide':lang==='zh'?'隐藏':'非表示')}
                </button>
                <button onClick={()=>deleteItem(item)}
                  style={{fontSize:11,padding:'3px 10px',borderRadius:10,border:'0.5px solid #FCEBEB',background:'#FCEBEB',cursor:'pointer',color:'#A32D2D'}}>
                  {lang==='en'?'Delete':lang==='zh'?'删除':'削除'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:200,overflowY:'auto',padding:'2rem'}}
          onClick={e=>e.target===e.currentTarget&&setEditingItem(null)}>
          <div style={{background:'var(--bg)',borderRadius:'var(--radius)',border:'0.5px solid var(--border)',padding:'1.5rem',width:'100%',maxWidth:420,position:'relative',margin:'0 auto'}}>
            <button onClick={()=>setEditingItem(null)}
              style={{position:'absolute',top:12,right:14,background:'none',border:'none',fontSize:20,color:'var(--text-2)',cursor:'pointer'}}>×</button>
            <div style={{fontSize:15,fontWeight:500,marginBottom:'1rem'}}>
              <i className="ti ti-pencil" aria-hidden="true" style={{marginRight:6}} />
              {lang==='en'?'Edit Item':lang==='zh'?'编辑商品':'アイテム編集'}
            </div>
            <div className="form-row">
              <label className="form-label">{lang==='en'?'Name (JP)':lang==='zh'?'名称（日文）':'アイテム名（日本語）'}</label>
              <input className="form-input" value={editingItem.name_ja}
                onChange={e=>setEditingItem(v=>({...v,name_ja:e.target.value}))} />
            </div>
            <div className="form-row">
              <label className="form-label">{lang==='en'?'Category':lang==='zh'?'类别':'カテゴリー'}</label>
              <select className="form-input" value={editingItem.category}
                onChange={e=>setEditingItem(v=>({...v,category:e.target.value}))}>
                {ALL_CATEGORIES.map(c=>{const n=typeof c==='string'?c:c.name;return <option key={n} value={n}>{n}</option>;})}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="form-row" style={{margin:0}}>
                <label className="form-label">{lang==='en'?'Unit':lang==='zh'?'单位':'単位'}</label>
                <input className="form-input" value={editingItem.unit}
                  onChange={e=>setEditingItem(v=>({...v,unit:e.target.value}))} />
              </div>
              <div className="form-row" style={{margin:0}}>
                <label className="form-label">{lang==='en'?'Min Stock':lang==='zh'?'最低库存':'規定在庫'}</label>
                <input className="form-input" type="number" value={editingItem.min_stock}
                  onChange={e=>setEditingItem(v=>({...v,min_stock:parseInt(e.target.value)||0}))} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">{lang==='en'?'Vendor':lang==='zh'?'供应商':'業者'}</label>
              <input className="form-input" value={editingItem.vendor||''}
                onChange={e=>setEditingItem(v=>({...v,vendor:e.target.value}))} />
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:'1rem'}}>
              <button className="btn-outline" onClick={()=>setEditingItem(null)}>
                {lang==='en'?'Cancel':lang==='zh'?'取消':'キャンセル'}
              </button>
              <button className="btn-primary" onClick={updateItem}>
                <i className="ti ti-device-floppy" aria-hidden="true" /> {lang==='en'?'Save':lang==='zh'?'保存':'保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matching Modal */}
      {matchingItem && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}
          onClick={e=>e.target===e.currentTarget&&setMatchingItem(null)}>
          <div style={{background:'var(--bg)',borderRadius:'var(--radius)',border:'0.5px solid var(--border)',padding:'1.5rem',width:'100%',maxWidth:400,position:'relative'}}>
            <button onClick={()=>setMatchingItem(null)}
              style={{position:'absolute',top:12,right:14,background:'none',border:'none',fontSize:20,color:'var(--text-2)',cursor:'pointer'}}>×</button>
            <div style={{fontSize:15,fontWeight:500,marginBottom:4}}>
              🔗 突合情報
            </div>
            <div style={{fontSize:12,color:'var(--text-2)',marginBottom:16}}>{matchingItem.name_ja}</div>
            <div className="form-row">
              <label className="form-label">伝票品名（納品伝票上の品名）</label>
              <input className="form-input" value={matchingItem.vendor_item_name||''}
                placeholder="例: PORK GROUND"
                onChange={e=>setMatchingItem(v=>({...v,vendor_item_name:e.target.value}))} />
            </div>
            <div className="form-row">
              <label className="form-label">伝票品番</label>
              <input className="form-input" value={matchingItem.vendor_item_code||''}
                placeholder="例: P-GP-WS"
                onChange={e=>setMatchingItem(v=>({...v,vendor_item_code:e.target.value}))} />
            </div>
            <div className="form-row">
              <label className="form-label">発注書品名（発注フォーム上の品名）</label>
              <input className="form-input" value={matchingItem.order_item_name||''}
                placeholder="例: Pork Ground"
                onChange={e=>setMatchingItem(v=>({...v,order_item_name:e.target.value}))} />
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:'1rem'}}>
              <button className="btn-outline" onClick={()=>setMatchingItem(null)}>キャンセル</button>
              <button className="btn-primary" onClick={saveMatchingInfo}>
                <i className="ti ti-device-floppy" aria-hidden="true" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management */}
      <div style={{marginTop:'1.5rem',paddingTop:'1rem',borderTop:'0.5px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:500}}>
            {lang==='en'?'Category Management':lang==='zh'?'类别管理':'カテゴリー管理'}
          </div>
          <button onClick={translateAllCategories}
            style={{fontSize:12,padding:'4px 12px',borderRadius:10,border:'0.5px solid #378ADD',background:'#E6F1FB',color:'#042C53',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
            <i className="ti ti-language" aria-hidden="true" style={{fontSize:13}} />
            {lang==='en'?'Auto-translate all':lang==='zh'?'一键翻译':'一括翻訳'}
          </button>
        </div>

        {/* Existing categories */}
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
          {(categories||[]).map(cat => {
            const name = typeof cat==='string'?cat:cat.name;
            const icon = typeof cat==='string'?null:cat.icon;
            return (
              <div key={name} style={{display:'flex',alignItems:'center',gap:6,background:'var(--bg-2)',border:'0.5px solid var(--border)',borderRadius:20,padding:'4px 12px'}}>
                {icon && <i className={`ti ${icon}`} aria-hidden="true" style={{fontSize:13,color:'var(--text-2)'}} />}
                <span style={{fontSize:13,color:'var(--text)'}}>{name}</span>
                <button
                  onClick={() => deleteCategory(cat)}
                  style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:14,lineHeight:1,padding:0,display:'flex',alignItems:'center'}}
                  title={lang==='en'?'Delete':lang==='zh'?'删除':'削除'}
                >×</button>
              </div>
            );
          })}
        </div>

        {/* Add new category */}
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <input
            className="form-input"
            value={newCatInput}
            onChange={e => setNewCatInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addCategory()}
            placeholder={lang==='en'?'New category name...':lang==='zh'?'新类别名称...':'新しいカテゴリー名...'}
            style={{flex:1}}
          />
          <button className="btn-primary" onClick={addCategory} style={{whiteSpace:'nowrap'}}>
            <i className="ti ti-plus" aria-hidden="true" /> {lang==='en'?'Add':lang==='zh'?'添加':'追加'}
          </button>
        </div>
        {/* Icon picker */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
          {ICON_OPTIONS.map(opt => (
            <button
              key={opt.icon}
              onClick={() => setNewCatIcon(opt.icon)}
              title={opt.label}
              style={{width:34,height:34,borderRadius:'var(--radius-sm)',border:newCatIcon===opt.icon?'2px solid #D85A30':'0.5px solid var(--border)',background:newCatIcon===opt.icon?'#FAECE7':'var(--bg-2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
            >
              <i className={`ti ${opt.icon}`} style={{fontSize:16,color:newCatIcon===opt.icon?'#D85A30':'var(--text-2)'}} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div style={{fontSize:11,color:'var(--text-2)',marginTop:6}}>
          {lang==='en'?'Categories in use cannot be deleted.':lang==='zh'?'正在使用的类别无法删除。':'使用中のカテゴリーは削除できません。'}
        </div>
      </div>

      {/* Email Settings */}
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
      title: '担当カテゴリーを選択する',
      sub: 'Select Your Category',
      body: '担当者名を入力後、リストから担当カテゴリーを選択します。サーバーの方は「サーバー」を選択。オレンジ色でハイライトされたら「棚卸しを開始する」をタップします。',
      tip: '担当外のカテゴリーは選ばないでください。複数担当の場合は複数選択も可能です。',
    },
    {
      num: '3', color: '#D85A30',
      title: '在庫をカウントする',
      sub: 'Count Inventory',
      body: '各アイテムの現在庫数を「＋」「－」ボタンまたは直接入力で記録します。途中で止める場合は「このカテゴリーを保存」で途中保存できます。',
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
      title: 'Select Your Category',
      sub: '担当カテゴリーを選択',
      body: 'Enter your name, then tap your assigned category from the list. Servers should select "Server". Once highlighted in orange, tap "Start Counting".',
      tip: 'Only select your assigned category. You can select multiple if you are responsible for more than one.',
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
      title: '选择负责的类别',
      sub: 'Select Your Category',
      body: '输入您的姓名后，从列表中选择您负责的类别。服务员请选择「サーバー」。选中后变为橙色高亮，点击「开始盘点」。',
      tip: '请只选择您负责的类别，不要选择其他类别。',
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
function AdminArea({ lang, t, items, sessions, location, activeTab, setActiveTab, adminEmail, setAdminEmail, setItems, showToast, categories, setCategories }) {
  const subTabs = [
    { key:'order',    labelJa:'📋 発注',  labelEn:'📋 Order',    labelZh:'📋 发单' },
    { key:'admin',    labelJa:'📦 棚卸し', labelEn:'📦 Inventory', labelZh:'📦 盘点' },
    { key:'history',  labelJa:'履歴',     labelEn:'History',      labelZh:'历史' },
    { key:'settings', labelJa:'設定',     labelEn:'Settings',     labelZh:'设置' },
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
      {currentTab === 'order' && (
        <OrderTab lang={lang} t={t} items={items} showToast={showToast} location={location} sessions={sessions} />
      )}

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
          categories={categories} setCategories={setCategories}
          showToast={showToast}
        />
      )}
    </div>
  );
}


const VENDORS_JA = ['Wismettac Asian Foods, Inc.','The Cherry Co., Ltd.','JFC International INC.','KUKUI FOOD','Select 7, Inc.','Sun Noodle','Fukuoka Package USA, Inc.','その他'];
const VENDORS_EN = ['Wismettac Asian Foods, Inc.','The Cherry Co., Ltd.','JFC International INC.','KUKUI FOOD','Select 7, Inc.','Sun Noodle','Fukuoka Package USA, Inc.','Other'];
const VENDORS_ZH = ['Wismettac Asian Foods, Inc.','The Cherry Co., Ltd.','JFC International INC.','KUKUI FOOD','Select 7, Inc.','Sun Noodle','Fukuoka Package USA, Inc.','其他'];

function ReceiptTab({ lang, t, showToast, location }) {
  const [step, setStep]           = useState('capture'); // capture | review | saved
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl]   = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [rows, setRows]           = useState([]);
  const [footer, setFooter]       = useState({ invoice_no: '', subtotal: '', tax_amount: '', total: '' });
  const [saving, setSaving]       = useState(false);
  const [history, setHistory]     = useState([]);
  const [historyTab, setHistoryTab] = useState('input'); // input | history

  const vendors = lang === 'en' ? VENDORS_EN : lang === 'zh' ? VENDORS_ZH : VENDORS_JA;

  const L = {
    title:       { ja:'📷 納品伝票リーダー', en:'📷 Delivery Receipt', zh:'📷 入库单扫描' },
    capture:     { ja:'写真を撮る / 選ぶ',   en:'Take / Select Photo',  zh:'拍照 / 选择' },
    analyze:     { ja:'AI解析する',           en:'Analyze with AI',      zh:'AI解析' },
    analyzing:   { ja:'解析中...',            en:'Analyzing...',         zh:'解析中...' },
    vendor:      { ja:'業者',                 en:'Vendor',               zh:'供应商' },
    itemName:    { ja:'品名',                 en:'Item Name',            zh:'品名' },
    itemCode:    { ja:'品番',                 en:'Item Code',            zh:'品号' },
    unitPrice:   { ja:'単価',                 en:'Unit Price',           zh:'单价' },
    quantity:    { ja:'数量',                 en:'Qty',                  zh:'数量' },
    date:        { ja:'納品日',               en:'Date',                 zh:'日期' },
    addRow:      { ja:'+ 行を追加',           en:'+ Add Row',            zh:'+ 追加行' },
    save:        { ja:'台帳に保存',           en:'Save to Ledger',       zh:'保存台账' },
    saving:      { ja:'保存中...',            en:'Saving...',            zh:'保存中...' },
    saved:       { ja:'✅ 保存しました',       en:'✅ Saved',             zh:'✅ 已保存' },
    retry:       { ja:'別の伝票を読む',       en:'Scan Another',         zh:'再次扫描' },
    history:     { ja:'納品履歴',             en:'Delivery History',     zh:'入库历史' },
    input:       { ja:'伝票入力',             en:'Enter Receipt',        zh:'录入单据' },
    noHistory:   { ja:'履歴なし',             en:'No history',           zh:'暂无记录' },
    monthly:     { ja:'月次集計',             en:'Monthly Summary',      zh:'月度汇总' },
    subtotal:    { ja:'小計',                 en:'Subtotal',             zh:'小计' },
    grandTotal:  { ja:'総計',                 en:'Grand Total',          zh:'总计' },
    total:       { ja:'合計',                 en:'Total',                zh:'合计' },
    note:        { ja:'備考',                 en:'Note',                 zh:'备注' },
    tax:         { ja:'税額',                 en:'Tax',                  zh:'税额' },
    deleteRow:   { ja:'削除',                 en:'Del',                  zh:'删' },
    aiHint:      { ja:'伝票の写真を選ぶとAIが自動で読み取ります', en:'Select a photo of the delivery slip — AI will read it automatically', zh:'选择送货单照片，AI将自动识别内容' },
  };
  const l = (k) => L[k]?.[lang] || L[k]?.ja || k;

  // 画像選択
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setStep('capture');
    setRows([]);
  };

  // AI解析
  const analyze = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64Resized(imageFile);
      const mediaType = 'image/jpeg';

      const _BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${_BASE}/api/analyze-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: mediaType })
      });

      const data = await response.json();
      const text = data.content?.find(c => c.type === 'text')?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      const today = new Date().toISOString().slice(0,10);
      const detectedVendor = parsed.vendor || '';
      const detectedDate = parsed.delivered_date || today;

      const newRows = (parsed.items || []).map((it, i) => ({
        id: Date.now() + i,
        vendor: detectedVendor,
        item_name: it.item_name || '',
        item_code: it.item_code || '',
        unit_price: it.unit_price !== null && it.unit_price !== undefined ? String(it.unit_price) : '',
        quantity: it.quantity !== null && it.quantity !== undefined ? String(it.quantity) : '',
        delivered_date: detectedDate,
        note: it.note || '',
      }));

      if (newRows.length === 0) {
        newRows.push(emptyRow(detectedVendor, detectedDate));
      }

      setFooter({
        invoice_no: parsed.invoice_no || '',
        subtotal: parsed.subtotal != null ? String(parsed.subtotal) : '',
        tax_amount: parsed.tax_amount != null ? String(parsed.tax_amount) : '',
        total: parsed.total != null ? String(parsed.total) : '',
      });
      setRows(newRows);
      setStep('review');
    } catch (err) {
      console.error(err);
      showToast('❌ 解析エラー。手動で入力してください。');
      setRows([emptyRow('', new Date().toISOString().slice(0,10))]);
      setStep('review');
    } finally {
      setAnalyzing(false);
    }
  };

  const emptyRow = (vendor = '', date = new Date().toISOString().slice(0,10)) => ({
    id: Date.now() + Math.random(),
    vendor,
    item_name: '',
    item_code: '',
    unit_price: '',
    quantity: '',
    delivered_date: date,
    note: '',
  });

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows(prev => [...prev, emptyRow(last?.vendor || '', last?.delivered_date || '')]);
  };

  // 保存
  const saveAll = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      // Invoice No.重複チェック
      if (footer.invoice_no) {
        const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const existing = await fetch(`${BASE}/api/deliveries?invoice_no=${encodeURIComponent(footer.invoice_no)}`).then(r => r.json());
        if (existing.length > 0) {
          const ok = window.confirm(`Invoice No. "${footer.invoice_no}" はすでに登録されています。\n上書きしますか？\n（既存データを削除して新しいデータを保存します）`);
          if (!ok) { setSaving(false); return; }
          // 既存データを削除
          await Promise.all(existing.map(it => fetch(`${BASE}/api/deliveries/${it.id}`, { method: 'DELETE' })));
        }
      }
      const validRows = rows.filter(r => r.item_name.trim() !== '');
      if (validRows.length === 0) { showToast('❌ 品名を入力してください'); setSaving(false); return; }
      const payload = validRows.map(r => ({
        vendor: r.vendor,
        item_name: r.item_name,
        item_code: r.item_code,
        unit_price: r.unit_price !== '' ? parseFloat(r.unit_price) : null,
        quantity: r.quantity !== '' ? parseFloat(r.quantity) : null,
        delivered_date: r.delivered_date,
        note: r.note,
          invoice_no: footer.invoice_no || '',
          location: location || 'Piikoi',
          tax_amount: footer.tax_amount !== '' ? parseFloat(footer.tax_amount) : 0,
        subtotal: footer.subtotal !== '' ? parseFloat(footer.subtotal) : 0,
        total: footer.total !== '' ? parseFloat(footer.total) : 0,
        image_url: '',
      }));
      const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const res = await fetch(`${BASE}/api/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast(l('saved'));
      setStep('saved');
      loadHistory();
    } catch (e) {
      showToast('❌ 保存エラー: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // 行単位削除
  const deleteItem = async (id) => {
    if (!window.confirm('この行を削除しますか？')) return;
    try {
      const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      await fetch(`${BASE}/api/deliveries/${id}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      showToast('❌ 削除エラー: ' + e.message);
    }
  };

  // グループ削除
  const deleteGroup = async (ids) => {
    if (!window.confirm(`${ids.length}件まとめて削除しますか？`)) return;
    try {
      const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      await Promise.all(ids.map(id => fetch(`${BASE}/api/deliveries/${id}`, { method: 'DELETE' })));
      setHistory(prev => prev.filter(h => !ids.includes(h.id)));
    } catch (e) {
      showToast('❌ 削除エラー: ' + e.message);
    }
  };

  // 履歴取得
  const loadHistory = async () => {
    try {
      const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const res = await fetch(`${BASE}/api/deliveries`);
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  // 合計計算
  const total = rows.reduce((sum, r) => {
    const p = parseFloat(r.unit_price) || 0;
    const q = parseFloat(r.quantity) || 0;
    return sum + p * q;
  }, 0);

  const inputRef = React.useRef();

  return (
    <div style={{ padding: '0 0 80px' }}>
      {/* サブタブ */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--bg-2)', padding:4, borderRadius:10 }}>
        {['input','history','monthly'].map(tt => (
          <button key={tt}
            onClick={() => setHistoryTab(tt)}
            style={{
              flex:1, padding:'8px 0', fontSize:13, border:'none', borderRadius:8, cursor:'pointer',
              background: historyTab===tt ? 'var(--bg)' : 'transparent',
              color: historyTab===tt ? 'var(--text-1)' : 'var(--text-2)',
              fontWeight: historyTab===tt ? 600 : 400,
              boxShadow: historyTab===tt ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >{l(tt)}</button>
        ))}
      </div>

      {/* ── 入力タブ ── */}
      {historyTab === 'input' && (
        <>
          {/* Step: capture */}
          {(step === 'capture' || step === 'review') && (
            <div style={{ marginBottom:16 }}>
              {/* 画像プレビュー */}
              <label style={{
                display:'block', width:'100%', minHeight: imageUrl ? 'auto' : 140,
                border:'2px dashed var(--border)', borderRadius:14,
                background:'var(--bg-2)', cursor:'pointer',
                overflow:'hidden', position:'relative',
              }}>
                {imageUrl ? (
                  <img src={imageUrl} alt="伝票" style={{ width:'100%', maxHeight:220, objectFit:'contain', display:'block' }} />
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:140, gap:8 }}>
                    <span style={{ fontSize:36 }}>📷</span>
                    <span style={{ fontSize:13, color:'var(--text-2)', textAlign:'center', padding:'0 20px' }}>{l('aiHint')}</span>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="file" accept="image/*" capture="environment"
                  onChange={handleFileChange}
                  style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }}
                />
              </label>

              {imageUrl && step === 'capture' && (
                <button
                  onClick={analyze}
                  disabled={analyzing}
                  style={{
                    width:'100%', marginTop:12, padding:'14px 0', borderRadius:12, border:'none',
                    background: analyzing ? 'var(--bg-2)' : '#D85A30',
                    color: analyzing ? 'var(--text-2)' : 'white',
                    fontSize:15, fontWeight:600, cursor: analyzing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {analyzing ? l('analyzing') : l('analyze')}
                </button>
              )}
            </div>
          )}

          {/* Step: review — 編集テーブル */}
          {step === 'review' && rows.length > 0 && (
            <div>
              <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:600 }}>
                  <thead>
                    <tr style={{ background:'var(--bg-2)', color:'var(--text-2)' }}>
                      {[l('date'), l('vendor'), l('itemName'), l('itemCode'), l('unitPrice'), l('quantity'), l('note'), ''].map((h,i) => (
                        <th key={i} style={{ padding:'8px 6px', textAlign:'left', fontWeight:500, whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id} style={{ borderBottom:'1px solid var(--border)' }}>
                        {/* 日付 */}
                        <td style={{ padding:'6px 4px' }}>
                          <input type="date" value={row.delivered_date}
                            onChange={e => updateRow(row.id, 'delivered_date', e.target.value)}
                            style={inputStyle} />
                        </td>
                        {/* 業者 */}
                        <td style={{ padding:'6px 4px' }}>
                          <select value={row.vendor} onChange={e => updateRow(row.id, 'vendor', e.target.value)} style={inputStyle}>
                            <option value="">--</option>
                            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </td>
                        {/* 品名 */}
                        <td style={{ padding:'6px 4px' }}>
                          <input value={row.item_name} onChange={e => updateRow(row.id, 'item_name', e.target.value)} style={{...inputStyle, minWidth:100}} />
                        </td>
                        {/* 品番 */}
                        <td style={{ padding:'6px 4px' }}>
                          <input value={row.item_code} onChange={e => updateRow(row.id, 'item_code', e.target.value)} style={{...inputStyle, minWidth:70}} />
                        </td>
                        {/* 単価 */}
                        <td style={{ padding:'6px 4px' }}>
                          <input type="number" value={row.unit_price} onChange={e => updateRow(row.id, 'unit_price', e.target.value)} style={{...inputStyle, minWidth:70}} />
                        </td>
                        {/* 数量 */}
                        <td style={{ padding:'6px 4px' }}>
                          <input type="number" value={row.quantity} onChange={e => updateRow(row.id, 'quantity', e.target.value)} style={{...inputStyle, minWidth:60}} />
                        </td>
                        {/* 備考 */}
                        <td style={{ padding:'6px 4px' }}>
                          <input value={row.note} onChange={e => updateRow(row.id, 'note', e.target.value)} style={{...inputStyle, minWidth:80}} />
                        </td>
                        {/* 削除 */}
                        <td style={{ padding:'6px 4px' }}>
                          <button onClick={() => deleteRow(row.id)}
                            style={{ padding:'4px 8px', fontSize:11, border:'1px solid var(--border)', borderRadius:6, background:'transparent', color:'#e55', cursor:'pointer' }}>
                            {l('deleteRow')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 合計 */}
              {total > 0 && (
                <div style={{ textAlign:'right', padding:'10px 4px', fontSize:14, color:'var(--text-1)', fontWeight:600 }}>
                  {l('total')}: ${total.toFixed(2)}
                </div>
              )}

              {/* 伝票フッター */}
              <div style={{ marginTop:12, padding:'12px 14px', background:'var(--bg-2)', borderRadius:10, border:'1px solid var(--border)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
                  {[
                    { key:'invoice_no', label: lang==='en'?'Invoice #':lang==='zh'?'发票号':'請求書No.' },
                    { key:'subtotal',   label: lang==='en'?'Subtotal':lang==='zh'?'小计':'小計' },
                    { key:'tax_amount', label: lang==='en'?'Tax':lang==='zh'?'税额':'税額' },
                    { key:'total',      label: lang==='en'?'Total':lang==='zh'?'合计':'合計' },
                  ].map(({key, label}) => (
                    <div key={key}>
                      <div style={{ fontSize:11, color:'var(--text-2)', marginBottom:4 }}>{label}</div>
                      <input
                        type={key === 'invoice_no' ? 'text' : 'number'}
                        value={footer[key]}
                        onChange={e => setFooter(prev => ({...prev, [key]: e.target.value}))}
                        placeholder={key === 'invoice_no' ? 'INV-XXXX' : '0.00'}
                        style={{...inputStyle, width:'100%', fontSize:14, padding:'6px 8px'}}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 行追加 + 保存 */}
              <div style={{ display:'flex', gap:10, marginTop:12 }}>
                <button onClick={addRow}
                  style={{ flex:1, padding:'12px 0', borderRadius:10, border:'1px dashed var(--border)', background:'transparent', color:'var(--text-2)', fontSize:14, cursor:'pointer' }}>
                  {l('addRow')}
                </button>
                <button onClick={saveAll} disabled={saving}
                  style={{ flex:2, padding:'12px 0', borderRadius:10, border:'none', background: saving ? 'var(--bg-2)' : '#D85A30', color: saving ? 'var(--text-2)' : 'white', fontSize:14, fontWeight:600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? l('saving') : l('save')}
                </button>
              </div>

              {/* 別の伝票 */}
              <button onClick={() => { setStep('capture'); setImageUrl(''); setImageFile(null); setRows([]); setFooter({ invoice_no: '', subtotal: '', tax_amount: '', total: '' }); }}
                style={{ width:'100%', marginTop:10, padding:'10px 0', borderRadius:10, border:'1px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer' }}>
                {l('retry')}
              </button>
            </div>
          )}

          {/* Step: saved */}
          {step === 'saved' && (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', marginBottom:24 }}>{l('saved')}</div>
              <button onClick={() => { setStep('capture'); setImageUrl(''); setImageFile(null); setRows([]); setFooter({ invoice_no: '', subtotal: '', tax_amount: '', total: '' }); }}
                style={{ padding:'12px 32px', borderRadius:10, border:'none', background:'#D85A30', color:'white', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                {l('retry')}
              </button>
            </div>
          )}

          {/* 手動入力ボタン（画像なしでも入力できる） */}
          {step === 'capture' && !imageUrl && (
            <button onClick={() => { setRows([emptyRow()]); setStep('review'); }}
              style={{ width:'100%', marginTop:10, padding:'12px 0', borderRadius:10, border:'1px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer' }}>
              ✏️ {lang==='en'?'Enter Manually':lang==='zh'?'手动输入':'手動で入力'}
            </button>
          )}
        </>
      )}

      {/* ── 月次集計タブ ── */}
      {historyTab === 'monthly' && (
        <MonthlyTab history={history} lang={lang} l={l} />
      )}

      {/* ── 履歴タブ ── */}
      {historyTab === 'history' && (
        <DeliveryHistory history={history} deleteItem={deleteItem} deleteGroup={deleteGroup} />
      )}
    </div>
  );
}

// ── ヘルパー ──────────────────────────────────────────
const inputStyle = {
  width:'100%', padding:'5px 6px', fontSize:12,
  border:'1px solid var(--border)', borderRadius:6,
  background:'var(--bg)', color:'var(--text-1)',
  outline:'none',
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToBase64Resized(file, maxWidth = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}



// ── OrderTab ──────────────────────────────────────────
// ── テストモード（6月1日以降はfalseに変更）──
const TEST_MODE = true;
const TEST_EMAIL = 'sales@tanto-otabe.com';

const VENDOR_MASTER = {
  'JFC International INC.': {
    email: 'Wnakai@jfc.com',
    cc: 'master@tanto-otabe.com,sales@tanto-otabe.com',
    days: '月〜金（土日定休）',
    cutoff: '前日14時まで',
  },
  'The Cherry Co., Ltd.': {
    email: 'ikko@mutual.us',
    cc: 'master@tanto-otabe.com,sales@tanto-otabe.com',
    days: '月〜土',
    cutoff: '前日まで',
  },
  'Wismettac Asian Foods, Inc.': {
    email: 'yoshihiro.hotsuki@wismettacusa.com',
    cc: 'master@tanto-otabe.com,sales@tanto-otabe.com',
    days: '月・木',
    cutoff: '前日まで',
  },
  'KUKUI FOOD': {
    email: 'Jona1331@hotmail.com,dbfujii@gmail.com',
    cc: 'master@tanto-otabe.com,sales@tanto-otabe.com',
    days: '月〜土（日定休）',
    cutoff: '前日まで',
  },
  'Fukuoka Package USA, Inc.': {
    email: 'hi-sales@fukupa.com',
    cc: 'master@tanto-otabe.com,sales@tanto-otabe.com',
    days: '月〜金',
    cutoff: '15時まで',
  },
};

const VENDOR_ITEMS = {
  'JFC International INC.': [
    {name:'料理酒',unit:'箱'},{name:'本みりん',unit:'箱'},{name:'醤油',unit:'箱'},
    {name:'片栗粉',unit:'袋'},{name:'マヨネーズ（大）',unit:'本'},{name:'チキンパウダーEX',unit:'袋'},
    {name:'豆腐',unit:'丁'},{name:'オニオンフライ',unit:'袋'},{name:'シラチャソース',unit:'本'},
    {name:'味の素',unit:'袋'},{name:'たこ焼き',unit:'袋'},{name:'サーモン',unit:'袋'},
    {name:'アサリ',unit:'袋'},{name:'たい焼き',unit:'袋'},{name:'ごま油',unit:'本'},
    {name:'椎茸',unit:'袋'},{name:'昆布だし',unit:'袋'},{name:'板のり',unit:'袋'},
    {name:'刻みのり',unit:'袋'},{name:'アイスクリーム',unit:'個'},
    {name:'サッポロビール',unit:'樽'},{name:'獺祭',unit:'本'},{name:'樽回収',unit:'本'},
  ],
  'The Cherry Co., Ltd.': [
    {name:'メンマ',unit:'袋'},{name:'紅生姜',unit:'袋'},{name:'コーン',unit:'缶'},
    {name:'枝豆',unit:'袋'},{name:'フレンチフライ',unit:'箱'},{name:'たこわさ',unit:'袋'},
    {name:'三温糖',unit:'袋'},{name:'一味',unit:'袋'},{name:'七味',unit:'袋'},
    {name:'輪切り唐辛子',unit:'袋'},{name:'わかめ',unit:'袋'},{name:'キクラゲ',unit:'袋'},
    {name:'糸削り節',unit:'袋'},{name:'胡麻ドレ',unit:'本'},{name:'ごまペースト',unit:'袋'},
    {name:'いりごま',unit:'袋'},{name:'すりごま',unit:'袋'},{name:'合わせ味噌',unit:'袋'},
    {name:'赤味噌',unit:'個'},{name:'おろし生姜',unit:'個'},{name:'ニンニクおろし',unit:'個'},
    {name:'明太子チューブ',unit:'個'},{name:'バター',unit:'箱'},{name:'お好みソース',unit:'本'},
    {name:'豆板醤',unit:'個'},{name:'精製塩',unit:'袋'},{name:'ホワイトペッパー',unit:'缶'},
    {name:'昆布茶',unit:'袋'},{name:'ラー油',unit:'本'},{name:'山椒',unit:'袋'},
    {name:'カレーフレーク',unit:'袋'},{name:'柚子胡椒',unit:'個'},{name:'アサリ',unit:'袋'},
    {name:'サラダ油',unit:'本'},{name:'シャンタンベース',unit:'個'},{name:'フライドオニオン',unit:'袋'},
    {name:'フライドガーリック',unit:'袋'},{name:'小麦粉',unit:'袋'},{name:'オニオンドレッシング',unit:'本'},
    {name:'豚バラ串',unit:'箱'},{name:'むき海老',unit:'袋'},{name:'板のり',unit:'袋'},
    {name:'板のり 1/3',unit:'袋'},{name:'椎茸 5LB',unit:'袋'},{name:'ゆかり',unit:'袋'},
    {name:'八海山',unit:'本'},{name:'久保田',unit:'本'},{name:'松竹梅 超辛',unit:'6本'},
    {name:'いいちこ瓶',unit:'本'},{name:'抹茶ビール',unit:'箱'},
  ],
  'Wismettac Asian Foods, Inc.': [
    {name:'ブラックガーリックオイル',unit:'袋'},{name:'お米',unit:'袋'},
    {name:'リッキー',unit:'箱'},{name:'出汁パック',unit:'袋'},
    {name:'黒霧島',unit:'本'},{name:'ゆずぽん',unit:'本'},
    {name:'酢',unit:'箱'},{name:'鶏油',unit:'袋'},
  ],
  'KUKUI FOOD': [
    {name:'Pork Ground',unit:'LB'},{name:'Boneless Pork Butt Whole',unit:'LB'},
    {name:'Pork Belly Slice 1.5mm',unit:'LB'},{name:'Pork Fat No Skin',unit:'LB'},
    {name:'Boneless Chicken Thigh',unit:'LB'},{name:'Chicken Bone 10LB Cut',unit:'LB'},
    {name:'Chicken Paws',unit:'LB'},
  ],
  'Fukuoka Package USA, Inc.': [
    {name:'FP16-11 White Paper Box',unit:'CS'},{name:'FP21-14 White Paper Box',unit:'CS'},
    {name:'9" Full Wrapped Bamboo Chopsticks',unit:'CS'},{name:'1-Ply Dinner Napkin',unit:'CS'},
    {name:'Multifold Paper Towel',unit:'CS'},
  ],
};

function OrderTab({ lang, t, items, showToast, location, sessions }) {
  const today = new Date().toISOString().slice(0,10);
  const [step, setStep]             = useState('form'); // form | confirm | sent
  const [vendor, setVendor]         = useState('');
  const [orderDate, setOrderDate]   = useState(today);
  const [deliveryDate, setDelivDate]= useState('');
  const [person, setPerson]         = useState('');
  const [memo, setMemo]             = useState('');
  const [quantities, setQuantities] = useState({});
  const [sending, setSending]       = useState(false);
  const [orders, setOrders]         = useState([]);
  const [orderSubTab, setOrderSubTab] = useState('new'); // new | history

  const vendors = Object.keys(VENDOR_MASTER);
  const vendorItems = vendor ? (VENDOR_ITEMS[vendor] || []) : [];
  const orderedItems = vendorItems.filter(it => quantities[it.name] > 0);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch(e) { console.error(e); }
  };

  const updateQty = (name, val) => {
    setQuantities(prev => ({ ...prev, [name]: val === '' ? '' : parseFloat(val) || 0 }));
  };

  const resetForm = () => {
    setVendor(''); setOrderDate(today); setDelivDate('');
    setPerson(''); setMemo(''); setQuantities({});
    setStep('form');
  };

  const sendOrder = async () => {
    setSending(true);
    try {
      const payload = {
        vendor,
        location: location || 'Piikoi',
        order_date: orderDate,
        delivery_date: deliveryDate || null,
        person,
        memo,
        items: orderedItems.map(it => ({
          item_name: it.name,
          unit: it.unit,
          quantity: quantities[it.name],
          note: '',
        })),
      };
      const order = await api.postOrder(payload);

      // Gmail送信
      const vm = VENDOR_MASTER[vendor];
      const subject = `TANTO Order [${location}] - ${vendor} - ${orderDate}`;
      const colW = 28;
      const pad = (s, w) => String(s).padEnd(w);
      const itemLines = [
        pad('品目 / Item', colW) + pad('単位 / Unit', 12) + '数量 / Qty',
        '─'.repeat(colW + 12 + 10),
        ...orderedItems.map(it =>
          pad(it.name, colW) + pad(it.unit, 12) + quantities[it.name]
        )
      ].join('\n');
      let body = `TANTO Gyoza & Ramen Bar - Purchase Order\n`;
      body += `Store: ${location}\n`;
      body += `PO#: ${order.po_number}\n`;
      body += `Order Date: ${orderDate}\n`;
      if (deliveryDate) body += `Delivery Date: ${deliveryDate}\n`;
      if (person) body += `Person In Charge: ${person}\n`;
      if (memo) body += `Memo: ${memo}\n`;
      body += `\n${'='.repeat(50)}\n\n`;
      body += itemLines;
      body += `\n\n${'='.repeat(50)}\nThank you,\nTanto Gyoza & Ramen Bar\n1232 Waimanu St STE105, Honolulu, HI 96814\nTel: 808-888-0292`;

      // Resendでメール送信（PDF添付）
      const _BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const sendRes = await fetch(`${_BASE}/api/orders/${order.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: vm.email, cc: vm.cc, test_mode: TEST_MODE }),
      });
      if (!sendRes.ok) throw new Error(await sendRes.text());
      if (TEST_MODE) {
        showToast(`🧪 テスト送信完了: ${order.po_number} → ${TEST_EMAIL}`);
      } else {
        showToast(`✅ 発注メール送信完了: ${order.po_number}`);
      }
      showToast(`✅ ${order.po_number} を保存しました`);
      setStep('sent');
      loadOrders();
    } catch(e) {
      showToast('❌ エラー: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const L = {
    newOrder:   { ja:'新規発注',    en:'New Order',    zh:'新建订单' },
    history:    { ja:'発注履歴',    en:'Order History', zh:'发单历史' },
    vendor:     { ja:'業者',        en:'Vendor',        zh:'供应商' },
    orderDate:  { ja:'発注日',      en:'Order Date',    zh:'订货日' },
    delivDate:  { ja:'納品希望日',  en:'Delivery Date', zh:'希望收货日' },
    person:     { ja:'担当者',      en:'Person',        zh:'负责人' },
    memo:       { ja:'メモ',        en:'Memo',          zh:'备注' },
    next:       { ja:'確認へ',      en:'Review',        zh:'确认' },
    back:       { ja:'戻る',        en:'Back',          zh:'返回' },
    send:       { ja:'発注・Gmail送信', en:'Order & Send Gmail', zh:'下单' },
    sending:    { ja:'送信中...',   en:'Sending...',    zh:'发送中...' },
    newAnother: { ja:'次の発注',    en:'New Order',     zh:'再次发单' },
    noItems:    { ja:'数量を入力してください', en:'Enter quantities', zh:'请输入数量' },
    qty:        { ja:'数量',        en:'Qty',           zh:'数量' },
    unit:       { ja:'単位',        en:'Unit',          zh:'单位' },
    item:       { ja:'品目',        en:'Item',          zh:'品目' },
    cutoff:     { ja:'締切',        en:'Cutoff',        zh:'截止' },
    deliv:      { ja:'納品',        en:'Delivery',      zh:'配送' },
  };
  const l = k => L[k]?.[lang] || L[k]?.ja || k;

  return (
    <div style={{ paddingBottom:80 }}>
      {/* サブタブ */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--bg-2)', padding:4, borderRadius:10 }}>
        {['new','history'].map(tt => (
          <button key={tt} onClick={() => setOrderSubTab(tt)}
            style={{
              flex:1, padding:'8px 0', fontSize:13, border:'none', borderRadius:8, cursor:'pointer',
              background: orderSubTab===tt ? 'var(--bg)' : 'transparent',
              color: orderSubTab===tt ? 'var(--text-1)' : 'var(--text-2)',
              fontWeight: orderSubTab===tt ? 600 : 400,
              boxShadow: orderSubTab===tt ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {tt==='new' ? l('newOrder') : l('history')}
          </button>
        ))}
      </div>

      {/* 新規発注 */}
      {orderSubTab === 'new' && (
        <>
          {/* Step: form */}
          {step === 'form' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* 棚卸し推奨発注 */}
              {sessions && sessions.length > 0 && (
                <div style={{ background:'rgba(216,90,48,0.06)', border:'1px solid rgba(216,90,48,0.3)', borderRadius:10, padding:'12px 14px', marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#D85A30', marginBottom:8 }}>📦 棚卸しから推奨発注</div>
                  <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:10 }}>
                    最新棚卸し: {sessions[0]?.date} {sessions[0]?.time} — {sessions[0]?.staff_name}
                  </div>
                  <div style={{ display:'flex', gap:8', flexWrap:'wrap' }}>
                    {Object.keys(VENDOR_ITEMS).map(v => {
                      const sessionItems = sessions[0]?.items || [];
                      const vendorMasterItems = items.filter(it => {
                        const vName = it.vendor?.toLowerCase() || '';
                        const vKey = v.toLowerCase();
                        return vKey.includes(vName.split(' ')[0]?.toLowerCase()) ||
                               vName.includes(v.split(' ')[0]?.toLowerCase());
                      });
                      const needed = vendorMasterItems.filter(it => {
                        const si = sessionItems.find(s => s.item_id === it.id);
                        const cur = si ? (si.current_stock || 0) : 0;
                        return it.min_stock > 0 && cur < it.min_stock;
                      });
                      if (needed.length === 0) return null;
                      return (
                        <button key={v} onClick={() => {
                          setVendor(v);
                          const newQtys = {};
                          needed.forEach(it => {
                            const si = sessionItems.find(s => s.item_id === it.id);
                            const cur = si ? (si.current_stock || 0) : 0;
                            const shortage = it.min_stock - cur;
                            const vItem = VENDOR_ITEMS[v]?.find(vi => vi.name === it.name_ja);
                            if (vItem) newQtys[vItem.name] = shortage;
                          });
                          setQuantities(newQtys);
                        }}
                          style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #D85A30', background:'white', color:'#D85A30', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                          {v.split(' ')[0]} ({needed.length}品目)
                        </button>
                      );
                    }).filter(Boolean)}
                  </div>
                </div>
              )}

              {/* 業者選択 */}
              <div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:6 }}>{l('vendor')}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {vendors.map(v => {
                    const vm = VENDOR_MASTER[v];
                    const selected = vendor === v;
                    return (
                      <button key={v} onClick={() => { setVendor(v); setQuantities({}); }}
                        style={{
                          padding:'12px 14px', borderRadius:10, border: selected ? '2px solid #D85A30' : '1px solid var(--border)',
                          background: selected ? 'rgba(216,90,48,0.06)' : 'var(--bg-2)',
                          cursor:'pointer', textAlign:'left',
                        }}>
                        <div style={{ fontWeight:600, fontSize:14, color: selected ? '#D85A30' : 'var(--text-1)' }}>{v}</div>
                        <div style={{ fontSize:11, color:'var(--text-2)', marginTop:3 }}>
                          {l('deliv')}: {vm.days}　{l('cutoff')}: {vm.cutoff}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {vendor && (
                <>
                  {/* 日付・担当者 */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    {[
                      { label:l('orderDate'), val:orderDate, set:setOrderDate, type:'date' },
                      { label:l('delivDate'), val:deliveryDate, set:setDelivDate, type:'date' },
                    ].map(({label,val,set,type}) => (
                      <div key={label}>
                        <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:4 }}>{label}</div>
                        <input type={type} value={val} onChange={e=>set(e.target.value)}
                          style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-1)', fontSize:13 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:4 }}>{l('person')}</div>
                      <input value={person} onChange={e=>setPerson(e.target.value)} placeholder="Kevin"
                        style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-1)', fontSize:13 }} />
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:4 }}>{l('memo')}</div>
                      <input value={memo} onChange={e=>setMemo(e.target.value)}
                        style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-1)', fontSize:13 }} />
                    </div>
                  </div>

                  {/* 品目リスト */}
                  <div>
                    <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:8 }}>品目・数量入力</div>
                    <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 60px 90px', background:'var(--bg-2)', padding:'8px 12px', fontSize:12, color:'var(--text-2)', fontWeight:500 }}>
                        <span>{l('item')}</span><span style={{textAlign:'center'}}>{l('unit')}</span><span style={{textAlign:'center'}}>{l('qty')}</span>
                      </div>
                      {vendorItems.map((it, i) => (
                        <div key={it.name} style={{ display:'grid', gridTemplateColumns:'1fr 60px 90px', padding:'7px 12px', borderTop:'1px solid var(--border)', background: i%2===0?'var(--bg)':'var(--bg-2)', alignItems:'center' }}>
                          <span style={{ fontSize:13, color:'var(--text-1)' }}>{it.name}</span>
                          <span style={{ fontSize:12, color:'var(--text-2)', textAlign:'center' }}>{it.unit}</span>
                          <input
                            type="number" min="0"
                            value={quantities[it.name] || ''}
                            onChange={e => updateQty(it.name, e.target.value)}
                            placeholder="0"
                            style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-1)', fontSize:13, textAlign:'center' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => { if(orderedItems.length===0){showToast(l('noItems'));return;} setStep('confirm'); }}
                    style={{ width:'100%', padding:'14px 0', borderRadius:12, border:'none', background:'#D85A30', color:'white', fontSize:15, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                    {l('next')} ({orderedItems.length}品目)
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step: confirm */}
          {step === 'confirm' && (
            <div>
              <div style={{ background:'var(--bg-2)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:15, color:'var(--text-1)', marginBottom:10 }}>{vendor}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:13, color:'var(--text-2)' }}>
                  <div>{l('orderDate')}: <strong style={{color:'var(--text-1)'}}>{orderDate}</strong></div>
                  {deliveryDate && <div>{l('delivDate')}: <strong style={{color:'var(--text-1)'}}>{deliveryDate}</strong></div>}
                  {person && <div>{l('person')}: <strong style={{color:'var(--text-1)'}}>{person}</strong></div>}
                  {memo && <div>{l('memo')}: <strong style={{color:'var(--text-1)'}}>{memo}</strong></div>}
                </div>
              </div>

              <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 60px 70px', background:'var(--bg-2)', padding:'8px 12px', fontSize:12, color:'var(--text-2)', fontWeight:500 }}>
                  <span>{l('item')}</span><span style={{textAlign:'center'}}>{l('unit')}</span><span style={{textAlign:'center'}}>{l('qty')}</span>
                </div>
                {orderedItems.map((it, i) => (
                  <div key={it.name} style={{ display:'grid', gridTemplateColumns:'1fr 60px 70px', padding:'8px 12px', borderTop:'1px solid var(--border)', background: i%2===0?'var(--bg)':'var(--bg-2)' }}>
                    <span style={{ fontSize:13, color:'var(--text-1)' }}>{it.name}</span>
                    <span style={{ fontSize:12, color:'var(--text-2)', textAlign:'center' }}>{it.unit}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#D85A30', textAlign:'center' }}>{quantities[it.name]}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:12, padding:'10px 14px', background:'rgba(216,90,48,0.06)', borderRadius:8, border:'1px solid rgba(216,90,48,0.2)' }}>
                📧 送信先: {TEST_MODE ? `[TEST] ${TEST_EMAIL}` : VENDOR_MASTER[vendor]?.email}
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setStep('form')}
                  style={{ flex:1, padding:'13px 0', borderRadius:12, border:'1px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:14, cursor:'pointer' }}>
                  {l('back')}
                </button>
                <button onClick={sendOrder} disabled={sending}
                  style={{ flex:2, padding:'13px 0', borderRadius:12, border:'none', background: sending?'var(--bg-2)':'#D85A30', color: sending?'var(--text-2)':'white', fontSize:14, fontWeight:600, cursor: sending?'not-allowed':'pointer' }}>
                  {sending ? l('sending') : l('send')}
                </button>
              </div>
            </div>
          )}

          {/* Step: sent */}
          {step === 'sent' && (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', marginBottom:8 }}>発注完了</div>
              <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:24 }}>Gmailが開きました。送信を確認してください。</div>
              <button onClick={resetForm}
                style={{ padding:'12px 32px', borderRadius:10, border:'none', background:'#D85A30', color:'white', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                {l('newAnother')}
              </button>
            </div>
          )}
        </>
      )}

      {/* 発注履歴 */}
      {orderSubTab === 'history' && (
        <OrderHistory orders={orders} lang={lang} />
      )}
    </div>
  );
}


function OrderHistory({ orders, lang }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [viewMode, setViewMode] = useState('log'); // log | summary

  // 月リスト
  const months = [...new Set(orders.map(o => (o.order_date||'').slice(0,7)))].filter(Boolean).sort().reverse();
  
  // 業者リスト
  const vendors = [...new Set(orders.map(o => o.vendor))].filter(Boolean).sort();

  // フィルター適用
  const filtered = orders.filter(o => {
    const matchMonth = !selectedMonth || (o.order_date||'').startsWith(selectedMonth);
    const matchVendor = !selectedVendor || o.vendor === selectedVendor;
    return matchMonth && matchVendor;
  });

  const formatMonth = (m) => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return `${y}年${parseInt(mo)}月`;
  };

  // CSV出力（集計型：縦アイテム×横日付）
  const exportCSV = () => {
    if (filtered.length === 0) return;
    
    // 全品目と日付を収集
    const allItems = {};
    const allDates = [...new Set(filtered.map(o => (o.order_date||'').slice(0,10)))].sort();
    
    filtered.forEach(order => {
      const date = (order.order_date||'').slice(0,10);
      (order.items||[]).filter(it=>it.item_name).forEach(it => {
        const key = `${it.item_name}__${it.unit}`;
        if (!allItems[key]) allItems[key] = { name: it.item_name, unit: it.unit, dates: {} };
        allItems[key].dates[date] = (allItems[key].dates[date] || 0) + parseFloat(it.quantity || 0);
      });
    });

    // CSV生成
    const header = ['品目', '単位', ...allDates, '合計'];
    const rows = Object.values(allItems).map(item => {
      const qtys = allDates.map(d => item.dates[d] || '');
      const total = allDates.reduce((s, d) => s + (item.dates[d] || 0), 0);
      return [item.name, item.unit, ...qtys, total];
    });

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label = `${selectedMonth || 'all'}_${selectedVendor || 'all'}`;
    a.href = url;
    a.download = `tanto_order_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* フィルター */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
        {/* 月選択 */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
          <button onClick={() => setSelectedMonth('')}
            style={{ padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:12, cursor:'pointer',
              background: !selectedMonth ? '#D85A30' : 'var(--bg-2)', color: !selectedMonth ? 'white' : 'var(--text-2)' }}>
            全期間
          </button>
          {months.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              style={{ padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:12, cursor:'pointer',
                background: selectedMonth===m ? '#D85A30' : 'var(--bg-2)', color: selectedMonth===m ? 'white' : 'var(--text-2)' }}>
              {formatMonth(m)}
            </button>
          ))}
        </div>

        {/* 業者選択 */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
          <button onClick={() => setSelectedVendor('')}
            style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11, cursor:'pointer',
              background: !selectedVendor ? '#2C3E50' : 'var(--bg-2)', color: !selectedVendor ? 'white' : 'var(--text-2)' }}>
            全業者
          </button>
          {vendors.map(v => (
            <button key={v} onClick={() => setSelectedVendor(v)}
              style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11, cursor:'pointer',
                background: selectedVendor===v ? '#2C3E50' : 'var(--bg-2)', color: selectedVendor===v ? 'white' : 'var(--text-2)' }}>
              {v.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* 表示切替 + CSV出力 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:4, background:'var(--bg-2)', padding:3, borderRadius:8 }}>
            {[{key:'log',label:'ログ'},{key:'summary',label:'集計'}].map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                style={{ padding:'5px 14px', borderRadius:6, border:'none', fontSize:12, cursor:'pointer',
                  background: viewMode===v.key ? 'var(--bg)' : 'transparent',
                  color: viewMode===v.key ? 'var(--text-1)' : 'var(--text-2)',
                  fontWeight: viewMode===v.key ? 600 : 400 }}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV}
            style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', fontSize:12, cursor:'pointer', color:'var(--text-1)', display:'flex', alignItems:'center', gap:6 }}>
            📥 CSV出力
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-2)', fontSize:14 }}>発注履歴なし</div>
      ) : viewMode === 'log' ? (
        /* ── ログ表示 ── */
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(order => (
            <div key={order.id} style={{ background:'var(--bg-2)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
              <div style={{ padding:'10px 14px', background:'var(--bg)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:14, color:'var(--text-1)' }}>{order.vendor}</span>
                  <span style={{ fontSize:11, color:'var(--text-2)', background:'var(--bg-2)', padding:'2px 7px', borderRadius:6, border:'1px solid var(--border)' }}>{order.po_number}</span>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {order.delivery_date && <span style={{ fontSize:11, color:'var(--text-2)' }}>納品: {(order.delivery_date||'').slice(0,10)}</span>}
                  <span style={{ fontSize:12, color:'var(--text-2)' }}>{(order.order_date||'').slice(0,10)}</span>
                </div>
              </div>
              <div style={{ padding:'8px 14px' }}>
                {(order.items||[]).filter(it=>it.item_name).sort((a,b) => {
                    const vItems = VENDOR_ITEMS[order.vendor] || [];
                    const ai = vItems.findIndex(v=>v.name===a.item_name);
                    const bi = vItems.findIndex(v=>v.name===b.item_name);
                    return (ai===-1?999:ai) - (bi===-1?999:bi);
                  }).map((it,i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 60px 60px', fontSize:13, padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text-1)' }}>{it.item_name}</span>
                    <span style={{ color:'var(--text-2)', textAlign:'center' }}>{it.unit}</span>
                    <span style={{ fontWeight:600, color:'#D85A30', textAlign:'right' }}>{it.quantity}</span>
                  </div>
                ))}
                <div style={{ display:'flex', gap:12, marginTop:8, fontSize:11, color:'var(--text-2)' }}>
                  {order.person && <span>担当: {order.person}</span>}
                  {order.memo && <span>メモ: {order.memo}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── 集計表示 ── */
        <SummaryView orders={filtered} />
      )}
    </div>
  );
}

function SummaryView({ orders }) {
  // 業者別グループ
  const vendorMap = {};
  orders.forEach(order => {
    const v = order.vendor;
    if (!vendorMap[v]) vendorMap[v] = [];
    vendorMap[v].push(order);
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {Object.entries(vendorMap).map(([vendor, vOrders]) => {
        const allDates = [...new Set(vOrders.map(o => (o.order_date||'').slice(0,10)))].sort();
        const allItems = {};
        vOrders.forEach(order => {
          const date = (order.order_date||'').slice(0,10);
          (order.items||[]).filter(it=>it.item_name).forEach(it => {
            const key = `${it.item_name}__${it.unit}`;
            if (!allItems[key]) allItems[key] = { name: it.item_name, unit: it.unit, dates: {} };
            allItems[key].dates[date] = (allItems[key].dates[date] || 0) + parseFloat(it.quantity || 0);
          });
        });

        // VENDOR_ITEMSの順番に並び替え
        const vItemOrder = (VENDOR_ITEMS[vendor] || []).map(v => v.name);
        const sortedItems = Object.values(allItems).sort((a,b) => {
          const ai = vItemOrder.indexOf(a.name);
          const bi = vItemOrder.indexOf(b.name);
          return (ai===-1?999:ai) - (bi===-1?999:bi);
        });

        return (
          <div key={vendor} style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
            <div style={{ padding:'10px 14px', background:'#2C3E50', color:'white', fontWeight:600, fontSize:14 }}>
              {vendor}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg-2)' }}>
                    <th style={{ padding:'7px 12px', textAlign:'left', border:'1px solid var(--border)', whiteSpace:'nowrap', minWidth:120 }}>品目</th>
                    <th style={{ padding:'7px 8px', textAlign:'center', border:'1px solid var(--border)', whiteSpace:'nowrap' }}>単位</th>
                    {allDates.map(d => (
                      <th key={d} style={{ padding:'7px 8px', textAlign:'center', border:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                        {d.slice(5)}
                      </th>
                    ))}
                    <th style={{ padding:'7px 8px', textAlign:'center', border:'1px solid var(--border)', background:'#FFF3E0', whiteSpace:'nowrap' }}>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, i) => {
                    const total = allDates.reduce((s,d) => s + (item.dates[d]||0), 0);
                    return (
                      <tr key={i} style={{ background: i%2===0 ? 'var(--bg)' : 'var(--bg-2)' }}>
                        <td style={{ padding:'6px 12px', border:'1px solid var(--border)', color:'var(--text-1)' }}>{item.name}</td>
                        <td style={{ padding:'6px 8px', border:'1px solid var(--border)', textAlign:'center', color:'var(--text-2)' }}>{item.unit}</td>
                        {allDates.map(d => (
                          <td key={d} style={{ padding:'6px 8px', border:'1px solid var(--border)', textAlign:'center', color: item.dates[d] ? '#D85A30' : 'var(--text-2)', fontWeight: item.dates[d] ? 600 : 400 }}>
                            {item.dates[d] || ''}
                          </td>
                        ))}
                        <td style={{ padding:'6px 8px', border:'1px solid var(--border)', textAlign:'center', fontWeight:700, color:'var(--text-1)', background:'#FFF3E0' }}>{total}</td>
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
  );
}

function MonthlyTab({ history, lang, l }) {
  const months = [...new Set(history.map(h => (h.delivered_date || '').slice(0,7)))].filter(Boolean).sort().reverse();
  const [selectedMonth, setSelectedMonth] = useState(months[0] || '');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const locations = [...new Set(history.map(h => h.location).filter(Boolean))].sort();

  const filtered = history.filter(h => {
    const matchMonth = (h.delivered_date || '').startsWith(selectedMonth);
    const matchLocation = !selectedLocation || h.location === selectedLocation;
    return matchMonth && matchLocation;
  });

  // ベンダー別集計
  const vendorMap = {};
  const taxCounted = new Set();
  for (const it of filtered) {
    const v = it.vendor || '不明';
    if (!vendorMap[v]) vendorMap[v] = { subtotal: 0, tax: 0, items: [] };
    const price = (parseFloat(it.unit_price) || 0) * (parseFloat(it.quantity) || 0);
    vendorMap[v].subtotal += price;
    vendorMap[v].items.push(it);
    const taxKey = `${v}_${(it.delivered_date||'').slice(0,10)}`;
    if (!taxCounted.has(taxKey)) {
      vendorMap[v].tax += parseFloat(it.tax_amount) || 0;
      taxCounted.add(taxKey);
    }
  }
  const vendors = Object.entries(vendorMap).sort((a,b) => b[1].subtotal - a[1].subtotal);
  const grandTotal = vendors.reduce((s, [,v]) => s + v.subtotal, 0);
  const grandTax = vendors.reduce((s, [,v]) => s + v.tax, 0);

  const formatMonth = (m) => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return lang === 'en' ? `${new Date(y, mo-1).toLocaleString('en', {month:'long'})} ${y}` : `${y}年${parseInt(mo)}月`;
  };

  // 選択業者の納品日別グループ
  const vendorDetail = selectedVendor ? groupByVendorDate(vendorMap[selectedVendor]?.items || []) : [];

  return (
    <div>
      {/* 店舗選択 */}
      {locations.length > 1 && (
        <div style={{ display:'flex', gap:6, marginBottom:10, overflowX:'auto', paddingBottom:4 }}>
          <button onClick={() => setSelectedLocation('')}
            style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11, cursor:'pointer',
              background: !selectedLocation ? '#D85A30' : 'var(--bg-2)', color: !selectedLocation ? 'white' : 'var(--text-2)' }}>
            全店舗
          </button>
          {locations.map(loc => (
            <button key={loc} onClick={() => { setSelectedLocation(loc); setSelectedVendor(null); }}
              style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11, cursor:'pointer',
                background: selectedLocation===loc ? '#D85A30' : 'var(--bg-2)', color: selectedLocation===loc ? 'white' : 'var(--text-2)' }}>
              {loc}店
            </button>
          ))}
        </div>
      )}

      {/* 月選択 */}
      <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
        {months.map(m => (
          <button key={m} onClick={() => { setSelectedMonth(m); setSelectedVendor(null); }}
            style={{
              padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap',
              background: selectedMonth===m ? '#D85A30' : 'var(--bg-2)',
              color: selectedMonth===m ? 'white' : 'var(--text-2)',
              fontSize:13, cursor:'pointer', fontWeight: selectedMonth===m ? 600 : 400,
            }}>
            {formatMonth(m)}
          </button>
        ))}
      </div>

      {/* 業者詳細パネル */}
      {selectedVendor && (
        <div style={{ marginBottom:16, borderRadius:12, overflow:'hidden', border:'1px solid #D85A30' }}>
          <div style={{ padding:'10px 14px', background:'#D85A30', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:600, fontSize:14, color:'white' }}>{selectedVendor}</span>
            <button onClick={() => setSelectedVendor(null)}
              style={{ background:'transparent', border:'none', color:'white', fontSize:18, cursor:'pointer', lineHeight:1 }}>×</button>
          </div>
          {vendorDetail.map(group => (
            <div key={group.key}>
              <div style={{ padding:'8px 14px', background:'var(--bg-2)', borderTop:'1px solid var(--border)', fontSize:12, color:'var(--text-2)', fontWeight:500, display:'flex', justifyContent:'space-between' }}>
                <span>{group.date} · {group.items.length}品目</span>
                {group.items[0]?.invoice_no && (
                  <span style={{ background:'var(--bg)', padding:'1px 7px', borderRadius:6, border:'1px solid var(--border)' }}>
                    # {group.items[0].invoice_no}
                  </span>
                )}
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <tbody>
                  {group.items.sort((a,b) => (a.delivered_date||'').localeCompare(b.delivered_date||'')).map(it => (
                    <tr key={it.id} style={{ borderTop:'1px solid var(--border)' }}>
                      <td style={{ padding:'7px 14px', color:'var(--text-1)' }}>
                        {it.item_name}
                        {it.item_code ? <span style={{ color:'var(--text-2)', marginLeft:6, fontSize:11 }}>#{it.item_code}</span> : ''}
                      </td>
                      <td style={{ padding:'7px 14px', color:'var(--text-2)', textAlign:'right', whiteSpace:'nowrap' }}>
                        {it.unit_price != null ? `$${parseFloat(it.unit_price).toFixed(2)}` : '—'} × {it.quantity != null ? it.quantity : '—'}
                      </td>
                      <td style={{ padding:'7px 14px', fontWeight:600, color:'var(--text-1)', textAlign:'right', whiteSpace:'nowrap' }}>
                        {it.unit_price != null && it.quantity != null
                          ? `$${(parseFloat(it.unit_price) * parseFloat(it.quantity)).toFixed(2)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {vendors.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-2)', fontSize:14 }}>{l('noHistory')}</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:1, borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
          {/* ヘッダー */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:16, padding:'10px 16px', background:'var(--bg-2)', fontSize:12, color:'var(--text-2)', fontWeight:500 }}>
            <span>{lang==='en'?'Vendor':lang==='zh'?'供应商':'業者'}</span>
            <span style={{ textAlign:'right' }}>{lang==='en'?'Tax':lang==='zh'?'税额':'税額'}</span>
            <span style={{ textAlign:'right', minWidth:90 }}>{lang==='en'?'Subtotal':lang==='zh'?'小计':'小計'}</span>
          </div>
          {/* ベンダー行 */}
          {vendors.map(([vendor, data]) => (
            <div key={vendor}
              onClick={() => setSelectedVendor(selectedVendor===vendor ? null : vendor)}
              style={{
                display:'grid', gridTemplateColumns:'1fr auto auto', gap:16, padding:'12px 16px',
                background: selectedVendor===vendor ? 'rgba(216,90,48,0.06)' : 'var(--bg)',
                borderTop:'1px solid var(--border)', cursor:'pointer',
                borderLeft: selectedVendor===vendor ? '3px solid #D85A30' : '3px solid transparent',
              }}>
              <span style={{ fontSize:14, color: selectedVendor===vendor ? '#D85A30' : 'var(--text-1)', fontWeight:600 }}>
                {vendor} <span style={{ fontSize:11, fontWeight:400, color:'var(--text-2)' }}>▶ 詳細</span>
              </span>
              <span style={{ fontSize:13, color:'var(--text-2)', textAlign:'right' }}>
                {data.tax > 0 ? `$${data.tax.toFixed(2)}` : '—'}
              </span>
              <span style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', textAlign:'right', minWidth:90 }}>
                ${data.subtotal.toFixed(2)}
              </span>
            </div>
          ))}
          {/* 合計行 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:16, padding:'12px 16px', background:'var(--bg-2)', borderTop:'2px solid var(--border)' }}>
            <span style={{ fontSize:14, fontWeight:700, color:'var(--text-1)' }}>{lang==='en'?'Grand Total':lang==='zh'?'总计':'総計'}</span>
            <span style={{ fontSize:13, color:'var(--text-2)', textAlign:'right' }}>
              {grandTax > 0 ? `$${grandTax.toFixed(2)}` : '—'}
            </span>
            <span style={{ fontSize:15, fontWeight:700, color:'#D85A30', textAlign:'right', minWidth:90 }}>
              ${grandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


function DeliveryHistory({ history, deleteItem, deleteGroup }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [viewMode, setViewMode] = useState('log'); // log | summary

  const months = [...new Set(history.map(h => (h.delivered_date||'').slice(0,7)))].filter(Boolean).sort().reverse();
  const vendors = [...new Set(history.map(h => h.vendor))].filter(Boolean).sort();
  const locations = [...new Set(history.map(h => h.location).filter(Boolean))].sort();
  const [selectedLocation, setSelectedLocation] = useState('');

  const filtered = history.filter(h => {
    const matchMonth = !selectedMonth || (h.delivered_date||'').startsWith(selectedMonth);
    const matchVendor = !selectedVendor || h.vendor === selectedVendor;
    const matchLocation = !selectedLocation || h.location === selectedLocation;
    return matchMonth && matchVendor && matchLocation;
  });

  const formatMonth = (m) => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return `${y}年${parseInt(mo)}月`;
  };

  // CSV出力（ログ型）
  const exportLogCSV = () => {
    if (filtered.length === 0) return;
    const header = ['納品日', '業者', 'Invoice No.', '品目', '品番', '単価', '数量', '金額'];
    const rows = filtered.map(it => [
      (it.delivered_date||'').slice(0,10),
      it.vendor || '',
      it.invoice_no || '',
      it.item_name || '',
      it.item_code || '',
      it.unit_price != null ? parseFloat(it.unit_price).toFixed(2) : '',
      it.quantity != null ? it.quantity : '',
      it.unit_price != null && it.quantity != null
        ? (parseFloat(it.unit_price) * parseFloat(it.quantity)).toFixed(2) : '',
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tanto_delivery_log_${selectedMonth||'all'}_${selectedVendor||'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV出力（集計型：縦アイテム×横日付）
  const exportSummaryCSV = () => {
    if (filtered.length === 0) return;
    const allDates = [...new Set(filtered.map(h => (h.delivered_date||'').slice(0,10)))].filter(Boolean).sort();
    const allItems = {};
    filtered.forEach(it => {
      const date = (it.delivered_date||'').slice(0,10);
      const key = `${it.vendor}__${it.item_name}`;
      if (!allItems[key]) allItems[key] = { vendor: it.vendor, name: it.item_name, code: it.item_code||'', dates: {} };
      allItems[key].dates[date] = (allItems[key].dates[date] || 0) + parseFloat(it.quantity || 0);
    });

    // VENDOR_ITEMSの順番でソート
    const sortedItems = Object.values(allItems).sort((a, b) => {
      const aVItems = VENDOR_ITEMS[a.vendor] || [];
      const bVItems = VENDOR_ITEMS[b.vendor] || [];
      const ai = aVItems.findIndex(v => v.name === a.name);
      const bi = bVItems.findIndex(v => v.name === b.name);
      if (a.vendor !== b.vendor) return a.vendor.localeCompare(b.vendor);
      return (ai===-1?999:ai) - (bi===-1?999:bi);
    });

    const header = ['業者', '品目', '品番', ...allDates.map(d=>d.slice(5)), '合計'];
    const rows = sortedItems.map(item => {
      const qtys = allDates.map(d => item.dates[d] || '');
      const total = allDates.reduce((s,d) => s + (item.dates[d]||0), 0);
      return [item.vendor, item.name, item.code, ...qtys, total];
    });
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tanto_delivery_summary_${selectedMonth||'all'}_${selectedVendor||'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groups = groupByVendorDate(filtered);

  return (
    <div>
      {/* 月選択 */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:8 }}>
        <button onClick={() => setSelectedMonth('')}
          style={{ padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:12, cursor:'pointer',
            background: !selectedMonth ? '#D85A30' : 'var(--bg-2)', color: !selectedMonth ? 'white' : 'var(--text-2)' }}>
          全期間
        </button>
        {months.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            style={{ padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:12, cursor:'pointer',
              background: selectedMonth===m ? '#D85A30' : 'var(--bg-2)', color: selectedMonth===m ? 'white' : 'var(--text-2)' }}>
            {formatMonth(m)}
          </button>
        ))}
      </div>

      {/* 店舗選択 */}
      {locations.length > 1 && (
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:8 }}>
          <button onClick={() => setSelectedLocation('')}
            style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11, cursor:'pointer',
              background: !selectedLocation ? '#D85A30' : 'var(--bg-2)', color: !selectedLocation ? 'white' : 'var(--text-2)' }}>
            全店舗
          </button>
          {locations.map(loc => (
            <button key={loc} onClick={() => setSelectedLocation(loc)}
              style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11, cursor:'pointer',
                background: selectedLocation===loc ? '#D85A30' : 'var(--bg-2)', color: selectedLocation===loc ? 'white' : 'var(--text-2)' }}>
              {loc}店
            </button>
          ))}
        </div>
      )}

      {/* 業者選択 */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:10 }}>
        <button onClick={() => setSelectedVendor('')}
          style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11, cursor:'pointer',
            background: !selectedVendor ? '#2C3E50' : 'var(--bg-2)', color: !selectedVendor ? 'white' : 'var(--text-2)' }}>
          全業者
        </button>
        {vendors.map(v => (
          <button key={v} onClick={() => setSelectedVendor(v)}
            style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11, cursor:'pointer',
              background: selectedVendor===v ? '#2C3E50' : 'var(--bg-2)', color: selectedVendor===v ? 'white' : 'var(--text-2)' }}>
            {v.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* 表示切替 + CSV出力 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ display:'flex', gap:4, background:'var(--bg-2)', padding:3, borderRadius:8 }}>
          {[{key:'log',label:'ログ'},{key:'summary',label:'集計'}].map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key)}
              style={{ padding:'5px 14px', borderRadius:6, border:'none', fontSize:12, cursor:'pointer',
                background: viewMode===v.key ? 'var(--bg)' : 'transparent',
                color: viewMode===v.key ? 'var(--text-1)' : 'var(--text-2)',
                fontWeight: viewMode===v.key ? 600 : 400 }}>
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={viewMode==='log' ? exportLogCSV : exportSummaryCSV}
          style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', fontSize:12, cursor:'pointer', color:'var(--text-1)', display:'flex', alignItems:'center', gap:6 }}>
          📥 CSV出力
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-2)', fontSize:14 }}>履歴なし</div>
      ) : viewMode === 'log' ? (
        /* ── ログ表示 ── */
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {groups.map(group => {
            const vItems = VENDOR_ITEMS[group.vendor] || [];
            const sortedItems = [...group.items].sort((a,b) => {
              const ai = vItems.findIndex(v=>v.name===a.item_name);
              const bi = vItems.findIndex(v=>v.name===b.item_name);
              return (ai===-1?999:ai) - (bi===-1?999:bi);
            });
            return (
              <div key={group.key} style={{ background:'var(--bg-2)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
                <div style={{ padding:'10px 14px', background:'var(--bg)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ fontWeight:600, fontSize:14, color:'var(--text-1)' }}>{group.vendor}</span>
                    <span style={{ fontSize:12, color:'var(--text-2)', marginLeft:10 }}>{group.date} · {group.items.length}品目</span>
                    {group.items[0]?.invoice_no && (
                      <span style={{ fontSize:11, color:'var(--text-2)', marginLeft:8, background:'var(--bg-2)', padding:'2px 7px', borderRadius:6, border:'1px solid var(--border)' }}>
                        # {group.items[0].invoice_no}
                      </span>
                    )}
                    {group.items[0]?.location && (
                      <span style={{ fontSize:11, color:'white', marginLeft:6, background:'#D85A30', padding:'2px 7px', borderRadius:6 }}>
                        {group.items[0].location}店
                      </span>
                    )}
                  </div>
                  <button onClick={() => deleteGroup(group.items.map(i => i.id))}
                    style={{ padding:'4px 10px', fontSize:11, border:'1px solid #e55', borderRadius:6, background:'transparent', color:'#e55', cursor:'pointer', whiteSpace:'nowrap' }}>
                    グループ削除
                  </button>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <tbody>
                    {sortedItems.map(it => (
                      <tr key={it.id} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 14px', color:'var(--text-1)' }}>
                          {it.item_name}{it.item_code ? <span style={{ color:'var(--text-2)', marginLeft:6 }}>#{it.item_code}</span> : ''}
                        </td>
                        <td style={{ padding:'8px 14px', color:'var(--text-2)', textAlign:'right', whiteSpace:'nowrap' }}>
                          {it.unit_price != null ? `$${parseFloat(it.unit_price).toFixed(2)}` : '—'} × {it.quantity != null ? it.quantity : '—'}
                        </td>
                        <td style={{ padding:'8px 14px', fontWeight:600, color:'var(--text-1)', textAlign:'right', whiteSpace:'nowrap' }}>
                          {it.unit_price != null && it.quantity != null
                            ? `$${(parseFloat(it.unit_price) * parseFloat(it.quantity)).toFixed(2)}`
                            : '—'}
                        </td>
                        <td style={{ padding:'8px 6px', textAlign:'right' }}>
                          <button onClick={() => deleteItem(it.id)}
                            style={{ padding:'3px 8px', fontSize:11, border:'1px solid #e55', borderRadius:6, background:'transparent', color:'#e55', cursor:'pointer' }}>
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── 集計表示 ── */
        <DeliverySummaryView history={filtered} />
      )}
    </div>
  );
}

function DeliverySummaryView({ history }) {
  const vendorMap = {};
  history.forEach(it => {
    const v = it.vendor || '不明';
    if (!vendorMap[v]) vendorMap[v] = [];
    vendorMap[v].push(it);
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {Object.entries(vendorMap).map(([vendor, items]) => {
        const allDates = [...new Set(items.map(it => (it.delivered_date||'').slice(0,10)))].filter(Boolean).sort();
        const allItems = {};
        items.forEach(it => {
          const date = (it.delivered_date||'').slice(0,10);
          const key = it.item_name;
          if (!allItems[key]) allItems[key] = { name: it.item_name, code: it.item_code||'', dates: {} };
          allItems[key].dates[date] = (allItems[key].dates[date] || 0) + parseFloat(it.quantity || 0);
        });

        // VENDOR_ITEMSの順番でソート
        const vItemOrder = (VENDOR_ITEMS[vendor] || []).map(v => v.name);
        const sortedItems = Object.values(allItems).sort((a,b) => {
          const ai = vItemOrder.indexOf(a.name);
          const bi = vItemOrder.indexOf(b.name);
          return (ai===-1?999:ai) - (bi===-1?999:bi);
        });

        return (
          <div key={vendor} style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
            <div style={{ padding:'10px 14px', background:'#2C3E50', color:'white', fontWeight:600, fontSize:14 }}>
              {vendor}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg-2)' }}>
                    <th style={{ padding:'7px 12px', textAlign:'left', border:'1px solid var(--border)', whiteSpace:'nowrap', minWidth:120 }}>品目</th>
                    {allDates.map(d => (
                      <th key={d} style={{ padding:'7px 8px', textAlign:'center', border:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                        {d.slice(5)}
                      </th>
                    ))}
                    <th style={{ padding:'7px 8px', textAlign:'center', border:'1px solid var(--border)', background:'#FFF3E0', whiteSpace:'nowrap' }}>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, i) => {
                    const total = allDates.reduce((s,d) => s + (item.dates[d]||0), 0);
                    return (
                      <tr key={i} style={{ background: i%2===0 ? 'var(--bg)' : 'var(--bg-2)' }}>
                        <td style={{ padding:'6px 12px', border:'1px solid var(--border)', color:'var(--text-1)' }}>
                          {item.name}
                          {item.code && <span style={{ color:'var(--text-2)', fontSize:10, marginLeft:4 }}>#{item.code}</span>}
                        </td>
                        {allDates.map(d => (
                          <td key={d} style={{ padding:'6px 8px', border:'1px solid var(--border)', textAlign:'center',
                            color: item.dates[d] ? '#D85A30' : 'var(--text-2)',
                            fontWeight: item.dates[d] ? 600 : 400 }}>
                            {item.dates[d] || ''}
                          </td>
                        ))}
                        <td style={{ padding:'6px 8px', border:'1px solid var(--border)', textAlign:'center', fontWeight:700, color:'var(--text-1)', background:'#FFF3E0' }}>
                          {total}
                        </td>
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
  );
}

function groupByVendorDate(items) {
  const map = {};
  for (const it of items) {
    const date = it.delivered_date ? it.delivered_date.slice(0,10) : '不明';
    const key = `${it.vendor || '不明'}_${date}`;
    if (!map[key]) map[key] = { key, vendor: it.vendor || '不明', date, items: [] };
    map[key].items.push(it);
  }
  return Object.values(map).sort((a,b) => b.date.localeCompare(a.date));
}
