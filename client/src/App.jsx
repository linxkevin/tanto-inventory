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
  const [items, setItems]     = useState([]);
  const [sessions, setSessions] = useState([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [toastMsg, showToast] = useToast();

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

  const refreshSessions = () => api.getSessions().then(setSessions).catch(console.error);

  if (loading) return (
    <div className="app" style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
      <div style={{color:'var(--text-2)',fontSize:14}}>{t('loading')}</div>
    </div>
  );

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="logo"><span>Tanto</span> Gyoza &amp; Ramen Bar</div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className="lang-switcher">
            {['ja','en','zh'].map(l => (
              <button key={l} className={`lang-btn${lang===l?' active':''}`} onClick={()=>setLang(l)}>
                {l==='ja'?'日本語':l==='en'?'English':'中文'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {['staff','admin','history','settings'].map((tabKey,i) => (
          <button key={tabKey} className={`tab${tab===tabKey?' active':''}`} onClick={()=>setTab(tabKey)}>
            {t(['tabStaff','tabAdmin','tabHistory','tabSettings'][i])}
          </button>
        ))}
      </div>

      {/* Views */}
      {tab === 'staff' && (
        <StaffTab
          lang={lang} t={t} items={items}
          onComplete={(rec) => {
            showToast(t('toastSubmit'));
            refreshSessions();
            setTab('admin');
          }}
          showToast={showToast}
        />
      )}
      {tab === 'admin' && (
        <AdminTab
          lang={lang} t={t} items={items} sessions={sessions}
          adminEmail={adminEmail} setAdminEmail={setAdminEmail}
          showToast={showToast}
        />
      )}
      {tab === 'history' && (
        <HistoryTab lang={lang} t={t} sessions={sessions} showToast={showToast} />
      )}
      {tab === 'settings' && (
        <SettingsTab
          lang={lang} t={t} items={items} setItems={setItems}
          adminEmail={adminEmail} setAdminEmail={setAdminEmail}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toastMsg && <div className="toast show">{toastMsg}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// STAFF TAB
// ─────────────────────────────────────────────────────
function StaffTab({ lang, t, items, onComplete, showToast }) {
  const [screen, setScreen]           = useState('top'); // 'top' | 'count'
  const [staffName, setStaffName]     = useState('');
  const [selected, setSelected]       = useState([]);
  const [activeVendor, setActiveVendor] = useState(null);
  const [savedVendors, setSavedVendors] = useState({});
  const [counts, setCounts]           = useState({}); // { itemId: value }

  const allVendors = ALL_VENDORS;

  function toggleVendor(v) {
    setSelected(s => s.includes(v) ? s.filter(x=>x!==v) : [...s, v]);
  }
  function toggleAll() {
    setSelected(s => s.length === allVendors.length ? [] : [...allVendors]);
  }

  function startCounting() {
    if (!staffName.trim()) { showToast(t('toastEnterName')); return; }
    if (!selected.length)  { showToast(t('toastSelectVendor')); return; }
    setActiveVendor(selected[0]);
    setScreen('count');
  }

  function backToTop() { setScreen('top'); }

  function getVendorItems(v) {
    return items.filter(i => i.vendor === v);
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

    // 選択したベンダーのアイテムのみ送信（未選択ベンダーは含めない）
    const sessionItems = items
      .filter(item => selected.includes(item.vendor))
      .map(item => ({
        id: item.id,
        current: counts[item.id] !== undefined && counts[item.id] !== '' ? parseInt(counts[item.id]) : null,
        staffStamp: finalStamps[item.vendor]?.staff || staffName,
        stampTime:  finalStamps[item.vendor]?.time  || timeStr,
      }));

    try {
      await api.postSession({
        date: dateKey, month: dateKey.slice(0,7), time: timeStr,
        staffName, vendorStamps: finalStamps, items: sessionItems,
      });
      // Reset
      setCounts({}); setSavedVendors({}); setSelected([]); setStaffName('');
      setScreen('top');
      onComplete();
    } catch(e) {
      showToast(t('toastError'));
    }
  }

  const { filled, total } = totalProgress();

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
        {allVendors.map(v => {
          const its = getVendorItems(v);
          const isSel = selected.includes(v);
          const isDone = !!savedVendors[v];
          const isServer = v === SERVER_VENDOR;
          return (
            <div
              key={v}
              className={`vendor-tile${isSel?' selected':''}${isDone?' done':''}`}
              onClick={() => toggleVendor(v)}
            >
              <div className="vt-dot" style={{background: vcolor(v,0)}} />
              <div className="vt-info">
                <div className="vt-name">{isServer ? t('serverLabel') : v}</div>
                <div className="vt-count">{its.length}{t('itemsLabel')}</div>
              </div>
              {isDone
                ? <span className="vt-done-badge">✓ {savedVendors[v].staff}</span>
                : isSel ? <span style={{fontSize:18,color:'var(--accent)'}}>✓</span> : null
              }
            </div>
          );
        })}
      </div>

      <button className="select-all-btn" onClick={toggleAll}>
        {selected.length === allVendors.length ? t('deselectAll') : t('selectAll')}
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
  const isServer = activeVendor === SERVER_VENDOR;

  return (
    <div>
      {/* Counting header */}
      <div className="counting-header">
        <span className="staff-badge">{staffName}</span>
        <span className="vendor-info">— {isServer ? t('serverLabel') : activeVendor} ({activeItems.length}{t('itemsLabel')})</span>
        <button className="btn-outline" style={{marginLeft:'auto',fontSize:12,padding:'5px 10px'}} onClick={backToTop}>
          ← {t('backBtn')}
        </button>
      </div>

      {/* Vendor tabs */}
      <div className="vendor-tabs">
        {selected.map(v => {
          const isDone = !!savedVendors[v];
          const isActive = v === activeVendor;
          return (
            <button
              key={v}
              className={`vtab${isActive?' active':''}${isDone?' completed':''}`}
              style={isActive ? {background:vcolor(v,0),color:'white',borderColor:vcolor(v,0)} : {}}
              onClick={() => setActiveVendor(v)}
            >
              {isDone && <span className="vtab-dot" />}
              {v === SERVER_VENDOR ? t('serverLabel') : v}
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
                  <div className="item-unit">{t('scardUnit')}: {item.unit} | {t('scardMin')}: {item.min_stock}</div>
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
function AdminTab({ lang, t, items, sessions, adminEmail, setAdminEmail, showToast }) {
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
    let txt = `Tanto Gyoza and Ramen Bar — 発注リスト\n日付: ${session.date} ${session.time}\n`;
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
    setMailSubject(`【Tanto発注】${latestSession.date} 棚卸し結果`);
    setMailBody(buildOrderJa(latestSession));
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
        <div className="section-title">{t('adminTitle')}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
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
const ADMIN_PASSWORD = 'tanto1109';

function SettingsTab({ lang, t, items, setItems, adminEmail, setAdminEmail, showToast }) {
  const [email, setEmail] = useState(adminEmail);
  const [saving, setSaving] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput]   = useState('');
  const [pwError, setPwError]   = useState(false);

  function tryUnlock() {
    if (pwInput === ADMIN_PASSWORD) {
      setUnlocked(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPwInput('');
    }
  }

  // Password gate
  if (!unlocked) return (
    <div style={{maxWidth:360,margin:'4rem auto',textAlign:'center'}}>
      <div style={{fontSize:40,marginBottom:'1rem'}}>🔒</div>
      <div style={{fontSize:16,fontWeight:500,marginBottom:8}}>
        {lang==='en' ? 'Admin Access Required' : lang==='zh' ? '需要管理员权限' : '管理者専用エリア'}
      </div>
      <div style={{fontSize:13,color:'var(--text-2)',marginBottom:'1.5rem'}}>
        {lang==='en' ? 'Enter the admin password to continue.' : lang==='zh' ? '请输入管理员密码。' : 'パスワードを入力してください。'}
      </div>
      <input
        className="form-input"
        type="password"
        placeholder={lang==='en' ? 'Password' : lang==='zh' ? '密码' : 'パスワード'}
        value={pwInput}
        onChange={e => { setPwInput(e.target.value); setPwError(false); }}
        onKeyDown={e => e.key === 'Enter' && tryUnlock()}
        style={{marginBottom:8,textAlign:'center',fontSize:16,letterSpacing:4}}
        autoFocus
      />
      {pwError && (
        <div style={{fontSize:12,color:'#A32D2D',marginBottom:8}}>
          {lang==='en' ? 'Incorrect password.' : lang==='zh' ? '密码错误。' : 'パスワードが違います。'}
        </div>
      )}
      <button className="btn-primary" style={{width:'100%'}} onClick={tryUnlock}>
        {lang==='en' ? 'Unlock' : lang==='zh' ? '解锁' : 'ロック解除'}
      </button>
    </div>
  );

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

  async function patchItem(item, field, value) {
    const updated = { unit: item.unit, min_stock: item.min_stock, [field]: value };
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
                {isServer && <span className="server-mini-badge">サーバー</span>}
                {item.name_ja}
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
          <input className="form-input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="manager@tanto-hi.com" />
        </div>
      </div>
    </div>
  );
}
