// Optional private "I applied" / "Closed" marks, stored in Firestore under
// privateApplications/<sha256(posting URL)> (same keys as the previous page, so
// older marks still count). Only Mohssine's GitHub account can read or write
// them (Firestore rules). Nothing here sends anything to an employer.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth, GithubAuthProvider, signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore, doc, getDoc, collection, onSnapshot, setDoc, serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyDPW8FELdI5M8dSInZbFAYECwv9ouxpTfY',
  authDomain: 'pfe-dashboard-169c9.firebaseapp.com',
  projectId: 'pfe-dashboard-169c9',
  appId: '1:972061652457:web:75508aeea582bb758e8778'
});
const auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
const statusEl = $('privStatus'), inBtn = $('privIn'), outBtn = $('privOut');
let unsub = null, ready = false;

const sha = async u => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(u || '').trim())))].map(n => n.toString(16).padStart(2, '0')).join('');
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Casablanca'}).format(new Date());
const push = (map, signed) => window.dashSetPrivate ? window.dashSetPrivate(map, signed) : null;

setPersistence(auth, browserLocalPersistence).catch(() => {});
inBtn.addEventListener('click', async () => {
  inBtn.disabled = true; statusEl.textContent = 'Opening GitHub sign-in…';
  try { await signInWithPopup(auth, new GithubAuthProvider()); }
  catch (e) { statusEl.textContent = 'Sign-in failed: ' + (e.code || 'unknown'); }
  finally { inBtn.disabled = false; }
});
outBtn.addEventListener('click', () => signOut(auth).catch(() => {}));

onAuthStateChanged(auth, async user => {
  if (unsub) { unsub(); unsub = null; }
  ready = false;
  inBtn.hidden = !!user; outBtn.hidden = !user;
  if (!user) { statusEl.textContent = 'Private applied marks: not signed in. The lists use the tracker data only.'; push(new Map(), false); return; }
  statusEl.textContent = 'Checking access…';
  try {
    await getDoc(doc(db, 'privateApplications', 'admin-access-probe')); // allowed only for the owner
    ready = true;
    unsub = onSnapshot(collection(db, 'privateApplications'), snap => {
      const map = new Map();
      snap.forEach(d => { if (d.id !== 'admin-access-probe') map.set(d.id, d.data()); });
      const n = [...map.values()].filter(v => v.status === 'applied').length;
      statusEl.textContent = `Private marks loaded: ${n} offers marked applied. Use “I applied” on an offer to move it down.`;
      push(map, true);
    }, e => { statusEl.textContent = 'Could not read private marks: ' + (e.code || 'unknown'); push(new Map(), false); });
  } catch (e) {
    statusEl.textContent = 'This account cannot read the private marks.';
    push(new Map(), false);
  }
});

document.addEventListener('click', async ev => {
  const b = ev.target.closest('button[data-mark]');
  if (!b || !ready) return;
  const card = b.closest('article[data-url]');
  const url = card && card.dataset.url;
  if (!url) { b.textContent = 'No listing URL'; return; }
  const next = b.dataset.mark;
  b.disabled = true; b.textContent = 'Saving…';
  try {
    const data = {postingUrl: url, company: card.dataset.company || '', role: card.dataset.title || '', status: next, updatedAt: serverTimestamp()};
    if (next === 'applied') Object.assign(data, {submittedOn: today(), expiredOn: null, evidence: 'self-report', evidenceSource: 'Marked applied on the dashboard; platform confirmation not checked'});
    else Object.assign(data, {expiredOn: today(), submittedOn: null, evidence: 'self-report', evidenceSource: 'Marked closed on the dashboard'});
    await setDoc(doc(db, 'privateApplications', await sha(url)), data, {merge: true});
  } catch (e) { b.disabled = false; b.textContent = 'Save failed'; }
});
