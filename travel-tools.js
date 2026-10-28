'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const KEY = { pack: 'tokyoDec.packing.v1', memo: 'tokyoDec.memos.v1', fx: 'tokyoDec.fx.v1' };

  // ---------- storage (fails soft: private mode / quota / disabled) ----------
  let storageOk = true;
  function load(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { storageOk = false; return null; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { storageOk = false; }
    $('storage-warning').hidden = storageOk;
  }
  try { localStorage.setItem('tokyoDec.probe', '1'); localStorage.removeItem('tokyoDec.probe'); }
  catch (e) { storageOk = false; }
  $('storage-warning').hidden = storageOk;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const el = (tag, props, ...kids) => {
    const n = document.createElement(tag);
    if (props) Object.assign(n, props);
    kids.forEach((k) => n.append(k)); // append() treats strings as text — no HTML parsing
    return n;
  };

  // ---------- tabs ----------
  const tabs = [...document.querySelectorAll('[role=tab]')];
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    history.replaceState(null, '', '#' + tab.getAttribute('aria-controls').slice(2));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  const fromHash = tabs.find((t) => t.getAttribute('aria-controls') === 'p-' + location.hash.slice(1));
  if (fromHash) selectTab(fromHash);

  // ---------- packing list ----------
  const CATS = ['證件', '交通住宿', '付款', '冬季衣物', '滑雪', '3C盥洗'];
  const DEFAULTS = {
    '證件': ['護照（確認效期）', '台灣駕照正本', '駕照日文譯本'],
    '交通住宿': ['機票訂單 MM620／MM627', '東京住宿 12/3–12/9 訂房', '東京住宿 12/11–12/13 訂房', 'Skyliner 車票', '野澤租車確認', 'Visit Japan Web 登錄'],
    '付款': ['信用卡（兩張以上）', '日圓現金', '交通 IC 卡'],
    '冬季衣物': ['保暖外套', '發熱衣', '毛帽・圍巾・手套', '防滑好走的鞋'],
    '滑雪': ['雪鏡', '滑雪手套', '中層保暖衣', '滑雪襪'],
    '3C盥洗': ['手機充電線', '行動電源', '盥洗包', '常備藥'],
  };
  const defaultPack = () => CATS.flatMap((c) => DEFAULTS[c].map((text) => ({ id: uid(), cat: c, text, done: false })));

  function validPackItem(x) {
    return x && typeof x === 'object' && CATS.includes(x.cat) && typeof x.text === 'string' &&
      x.text.trim().length > 0 && x.text.length <= 120 && typeof x.done === 'boolean';
  }
  function validMemo(x) {
    return x && typeof x === 'object' && typeof x.title === 'string' && x.title.trim().length > 0 &&
      x.title.length <= 60 && typeof x.body === 'string' && x.body.length <= 2000;
  }
  const cleanPack = (arr) => arr.map((x) => ({ id: uid(), cat: x.cat, text: x.text.trim(), done: x.done }));
  const cleanMemos = (arr) => arr.map((x) => ({ id: uid(), title: x.title.trim(), body: x.body,
    updated: typeof x.updated === 'string' ? x.updated.slice(0, 40) : '' }));

  let pack = load(KEY.pack);
  pack = Array.isArray(pack) && pack.every(validPackItem) ? cleanPack(pack) : defaultPack();

  $('pack-cat').append(...CATS.map((c) => el('option', { value: c, textContent: c })));

  function renderPack() {
    const done = pack.filter((x) => x.done).length;
    $('pack-total').textContent = `已完成 ${done} / ${pack.length}`;
    $('pack-bar').value = pack.length ? done / pack.length : 0;
    $('pack-cats').replaceChildren(...CATS.map((c) => {
      const items = pack.filter((x) => x.cat === c);
      const d = items.filter((x) => x.done).length;
      return el('li', { className: items.length && d === items.length ? 'done' : '', textContent: `${c} ${d}/${items.length}` });
    }));
    $('pack-list').replaceChildren(...CATS.map((c) => {
      const items = pack.filter((x) => x.cat === c);
      const list = el('ul');
      items.forEach((item) => {
        const box = el('input', { type: 'checkbox', checked: item.done });
        box.addEventListener('change', () => { item.done = box.checked; save(KEY.pack, pack); renderPack(); });
        const del = el('button', { type: 'button', className: 'icon', textContent: '刪除' });
        del.setAttribute('aria-label', '刪除 ' + item.text);
        del.addEventListener('click', () => { pack = pack.filter((x) => x !== item); save(KEY.pack, pack); renderPack(); });
        list.append(el('li', { className: 'pack-item' + (item.done ? ' checked' : '') }, el('label', null, box, el('span', { textContent: item.text })), del));
      });
      if (!items.length) list.append(el('li', { className: 'hint', textContent: '（此分類沒有項目）' }));
      return el('div', { className: 'pack-group' }, el('h3', { textContent: c }), list);
    }));
  }
  $('pack-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('pack-text').value.trim();
    if (!text || text.length > 120) { $('pack-error').textContent = '請輸入 1–120 字的項目。'; return; }
    $('pack-error').textContent = '';
    pack.push({ id: uid(), cat: $('pack-cat').value, text, done: false });
    save(KEY.pack, pack); renderPack();
    $('pack-text').value = '';
  });
  $('pack-reset').addEventListener('click', () => {
    if (!confirm('恢復預設清單？目前的勾選與自訂項目會被清除。')) return;
    pack = defaultPack(); save(KEY.pack, pack); renderPack();
  });
  renderPack();

  // ---------- memos ----------
  let memos = load(KEY.memo);
  memos = Array.isArray(memos) && memos.every(validMemo) ? cleanMemos(memos) : [];

  function resetMemoForm() {
    $('memo-form').reset(); $('memo-id').value = '';
    $('memo-save').textContent = '新增備忘'; $('memo-cancel').hidden = true;
  }
  function renderMemos() {
    if (!memos.length) { $('memo-list').replaceChildren(el('p', { className: 'hint', textContent: '還沒有備忘。' })); return; }
    $('memo-list').replaceChildren(...memos.map((m) => {
      const edit = el('button', { type: 'button', className: 'icon', textContent: '編輯' });
      edit.addEventListener('click', () => {
        $('memo-id').value = m.id; $('memo-title').value = m.title; $('memo-body').value = m.body;
        $('memo-save').textContent = '儲存修改'; $('memo-cancel').hidden = false; $('memo-title').focus();
      });
      const del = el('button', { type: 'button', className: 'icon', textContent: '刪除' });
      del.addEventListener('click', () => {
        if (!confirm(`刪除「${m.title}」？`)) return;
        memos = memos.filter((x) => x !== m); save(KEY.memo, memos); renderMemos(); resetMemoForm();
      });
      return el('article', { className: 'memo' },
        el('h3', { textContent: m.title }),
        el('p', { className: 'body', textContent: m.body }),
        el('p', { className: 'meta', textContent: m.updated ? '更新於 ' + m.updated : '' }),
        el('div', { className: 'btns' }, edit, del));
    }));
  }
  $('memo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const m = { title: $('memo-title').value.trim(), body: $('memo-body').value, updated: new Date().toLocaleString('zh-TW') };
    if (!validMemo(m)) { $('memo-error').textContent = '標題 1–60 字、內容最多 2000 字。'; return; }
    $('memo-error').textContent = '';
    const existing = memos.find((x) => x.id === $('memo-id').value);
    if (existing) Object.assign(existing, m); else memos.unshift({ id: uid(), ...m });
    save(KEY.memo, memos); renderMemos(); resetMemoForm();
  });
  $('memo-cancel').addEventListener('click', resetMemoForm);
  renderMemos();

  // ---------- JSON export / import ----------
  $('export-btn').addEventListener('click', () => {
    const data = { app: 'tokyo-dec-tools', version: 1, exported: new Date().toISOString(),
      packing: pack.map(({ cat, text, done }) => ({ cat, text, done })),
      memos: memos.map(({ title, body, updated }) => ({ title, body, updated })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = el('a', { href: url, download: `tokyo-tools-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('io-msg').textContent = '已匯出到下載資料夾。檔案含備忘內容，請勿公開分享。';
  });
  $('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const fail = (msg) => { $('io-msg').textContent = '匯入失敗：' + msg + '（現有資料未變動）'; };
    if (file.size > 200 * 1024) return fail('檔案超過 200 KB。');
    let data;
    try { data = JSON.parse(await file.text()); } catch (err) { return fail('不是有效的 JSON。'); }
    if (!data || data.app !== 'tokyo-dec-tools' || data.version !== 1) return fail('不是本頁匯出的備份檔。');
    if (!Array.isArray(data.packing) || data.packing.length > 300 || !data.packing.every(validPackItem)) return fail('行李清單格式不符。');
    if (!Array.isArray(data.memos) || data.memos.length > 200 || !data.memos.every(validMemo)) return fail('備忘格式不符。');
    if (!confirm(`將以備份取代目前資料：清單 ${data.packing.length} 項、備忘 ${data.memos.length} 則。確定？`)) return;
    pack = cleanPack(data.packing); memos = cleanMemos(data.memos);
    save(KEY.pack, pack); save(KEY.memo, memos);
    renderPack(); renderMemos(); resetMemoForm();
    $('io-msg').textContent = '匯入完成。';
  });

  // ---------- FX ----------
  const QUOTES = ['TWD', 'USD'];
  const DIGITS = { JPY: 0, TWD: 0, USD: 2 };
  const NAMES = { JPY: '日圓', TWD: '台幣', USD: '美元' };
  const API = 'https://api.frankfurter.dev/v2/rate/JPY/';
  // rates[q] = { rate: 1 JPY in q, date, src: 'live' | 'cache' | 'manual' }
  const rates = {};
  const validRate = (r) => typeof r === 'number' && Number.isFinite(r) && r > 0 && r < 10;
  const validDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

  const cached = load(KEY.fx);
  if (cached && typeof cached === 'object') {
    QUOTES.forEach((q) => {
      const c = cached[q];
      if (c && validRate(c.rate) && validDate(c.date)) rates[q] = { rate: c.rate, date: c.date, src: 'cache' };
    });
  }

  function setStatus(text, cls) { const s = $('fx-status'); s.textContent = text; s.className = 'fx-status ' + (cls || ''); }
  const SRC = { live: '本次取得的公告匯率', cache: '本機暫存，非本次更新', manual: '手動輸入，非即時' };

  function renderRates() {
    const rows = QUOTES.filter((q) => rates[q]).flatMap((q) => {
      const r = rates[q];
      return [el('dt', { textContent: `1 JPY → ${q}` }),
        el('dd', { textContent: `${r.rate}（${r.src === 'manual' ? '' : '資料日期 ' + r.date + '・'}${SRC[r.src]}）` })];
    });
    $('fx-rates').replaceChildren(...rows);
    convert();
  }

  async function fetchRate(q, signal) {
    const res = await fetch(API + q, { signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (!j || j.base !== 'JPY' || j.quote !== q || !validRate(j.rate) || !validDate(j.date)) throw new Error('回應格式不符');
    return { rate: j.rate, date: j.date };
  }

  $('fx-refresh').addEventListener('click', async () => {
    const btn = $('fx-refresh');
    btn.disabled = true; setStatus('更新中…');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const got = await Promise.all(QUOTES.map((q) => fetchRate(q, ctrl.signal)));
      const store = {};
      QUOTES.forEach((q, i) => { rates[q] = { ...got[i], src: 'live' }; store[q] = got[i]; });
      save(KEY.fx, store);
      setStatus(`已更新。來源 Frankfurter，資料日期 ${got[0].date}`, 'live');
    } catch (err) {
      const why = err.name === 'AbortError' ? '連線逾時（8 秒）' : (err.message || '網路錯誤');
      const has = QUOTES.some((q) => rates[q]);
      setStatus(`更新失敗：${why}。` + (has ? '下方仍是先前的匯率，並非新資料。' : '目前沒有可用匯率，可改用手動輸入。'), 'stale');
    } finally {
      clearTimeout(timer); btn.disabled = false; renderRates();
    }
  });

  function parseNum(s) {
    const t = String(s).replace(/[,\s]/g, '');
    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return Number(t);
  }
  $('fx-manual').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = { TWD: $('fx-m-twd').value.trim(), USD: $('fx-m-usd').value.trim() };
    const applied = [];
    for (const q of QUOTES) {
      if (!input[q]) continue;
      const n = parseNum(input[q]);
      if (!validRate(n)) { $('fx-error').textContent = `${q} 匯率需為大於 0、小於 10 的數字（1 日圓的價值）。`; return; }
      applied.push([q, n]);
    }
    if (!applied.length) { $('fx-error').textContent = '請至少輸入一個匯率。'; return; }
    $('fx-error').textContent = '';
    applied.forEach(([q, n]) => { rates[q] = { rate: n, date: '', src: 'manual' }; });
    setStatus('使用手動匯率：' + applied.map(([q]) => q).join('、') + '（非即時資料）', 'manual');
    renderRates();
  });

  function fmt(n, cur) {
    return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: DIGITS[cur], minimumFractionDigits: DIGITS[cur] }).format(n);
  }
  function convert() {
    const raw = $('fx-amount').value.trim();
    const cur = $('fx-cur').value;
    const out = $('fx-out');
    if (!raw) { $('fx-error').textContent = ''; out.replaceChildren(); return; }
    const amt = parseNum(raw);
    if (!Number.isFinite(amt) || amt > 1e9) { $('fx-error').textContent = '金額請輸入 0 到 10 億之間的數字。'; out.replaceChildren(); return; }
    $('fx-error').textContent = '';
    const perJpy = { JPY: 1 };
    QUOTES.forEach((q) => { if (rates[q]) perJpy[q] = rates[q].rate; });
    if (!perJpy[cur]) { out.replaceChildren(el('li', { className: 'hint', textContent: `尚無 ${cur} 匯率，請先更新或手動輸入。` })); return; }
    const jpy = amt / perJpy[cur];
    out.replaceChildren(...['JPY', 'TWD', 'USD'].filter((c) => c !== cur).map((c) => {
      if (!perJpy[c]) return el('li', { className: 'hint', textContent: `${c}：尚無匯率` });
      const manual = [c, cur].some((x) => x !== 'JPY' && rates[x].src === 'manual');
      return el('li', null, el('span', { textContent: `${fmt(amt, cur)} ${cur} ≈` }),
        el('strong', { textContent: `${fmt(jpy * perJpy[c], c)} ${c}` }),
        el('span', { className: 'hint', textContent: NAMES[c] + (manual ? '・手動匯率' : '') }));
    }));
  }
  $('fx-amount').addEventListener('input', convert);
  $('fx-cur').addEventListener('change', convert);
  $('fx-form').addEventListener('submit', (e) => e.preventDefault());
  document.querySelectorAll('[data-jpy]').forEach((b) => b.addEventListener('click', () => {
    $('fx-amount').value = b.dataset.jpy; $('fx-cur').value = 'JPY'; convert();
  }));
  if (QUOTES.some((q) => rates[q])) setStatus('顯示本機暫存匯率（非本次更新），按「更新匯率」取得最新。', 'stale');
  renderRates();
})();
