console.log('shared.js loaded');

const firebaseConfig = {
  apiKey: "AIzaSyD9kWG_RgdfBURwHafLWcN3P_qVxMvqHTE",
  authDomain: "demobarbearia-4eb73.firebaseapp.com",
  databaseURL: "https://demobarbearia-4eb73-default-rtdb.firebaseio.com",
  projectId: "demobarbearia-4eb73",
  storageBucket: "demobarbearia-4eb73.firebasestorage.app",
  messagingSenderId: "522986196174",
  appId: "1:522986196174:web:7d78eb757acf64f3ff149f"
};

let db = null;
let firebaseReady = false;

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded, using localStorage only');
    return;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebaseReady = true;
    console.log('Firebase initialized');
  } catch (e) {
    console.warn('Firebase init error:', e);
  }
}
initFirebase();

// === LOCAL STORAGE ===
function localGet(key) {
  if (key.endsWith('/')) {
    const prefix = 'ld_' + key;
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && k.length > prefix.length) {
        const subKey = k.slice(prefix.length);
        try { result[subKey] = JSON.parse(localStorage.getItem(k)); } catch (e) { }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  }
  try { return JSON.parse(localStorage.getItem('ld_' + key)); } catch (e) { return null; }
}
function localSet(key, val) { localStorage.setItem('ld_' + key, JSON.stringify(val)); }
function localDelete(key) { localStorage.removeItem('ld_' + key); }

// === UNIFIED DATA ===
async function sGet(key) {
  if (firebaseReady && db) {
    try {
      const p = db.ref(key).once('value');
      const t = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
      const snap = await Promise.race([p, t]);
      return snap.val();
    } catch (e) { return localGet(key); }
  }
  return localGet(key);
}
async function sSet(key, value) {
  localSet(key, value);
  if (firebaseReady && db) {
    try { await db.ref(key).set(value); return true; } catch (e) { return false; }
  }
  return true;
}
async function sDelete(key) {
  localDelete(key);
  if (firebaseReady && db) {
    try { await db.ref(key).remove(); } catch (e) { }
  }
}

// === CONSTANTS ===
const CONFIG_KEY = 'rdo/config';
const USERS_PREFIX = 'rdo/users/';
const RECORDS_PREFIX = 'rdo/records/';
const RECORD_KEY = id => RECORDS_PREFIX + id;

const DEFAULT_CONFIG = {
  equipes: [],
  atividades: []
};

const TL_STAGES = [
  { key: 'saidaBase', label: 'Saída Base' },
  { key: 'chegadaLocal', label: 'Chegada Local' },
  { key: 'inicioServico', label: 'Início Serviço' },
  { key: 'almoco', label: 'Almoço' },
  { key: 'retornoServico', label: 'Retorno Serviço' },
  { key: 'conclusao', label: 'Conclusão' },
  { key: 'chegadaBase', label: 'Chegada Base' }
];

const climaColors = {
  'Bom': 'badge-teal',
  'Nublado': 'badge-muted',
  'Chuvoso': 'badge-teal',
  'Impraticável': 'badge-danger'
};

// === UTILITIES ===
function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function fmtMoney(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(d) { if (!d) return ''; const p = d.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
function nowTime() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

let toastTimer = null;
function toast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2500);
}

async function ensureDefaultAdmin() {
  try {
    const existing = await sGet(USERS_PREFIX + 'admin');
    if (!existing) { await sSet(USERS_PREFIX + 'admin', { senha: 'admin123' }); }
  } catch (e) { console.error('ensureDefaultAdmin', e); }
}

async function loadConfig() {
  let c = null;
  try { c = await sGet(CONFIG_KEY); } catch (e) { }
  if (!c) {
    c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    sSet(CONFIG_KEY, c).catch(() => { });
  }
  if (c.equipes && c.equipes.length > 0 && typeof c.equipes[0] === 'string') {
    c.equipes = c.equipes.map(nome => ({ nome, pessoas: [] }));
  }
  if (!c.atividades) c.atividades = [];
  return c;
}
