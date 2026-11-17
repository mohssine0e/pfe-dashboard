// PFE dashboard, rebuilt 2026-11-17. Renders everything from shared-state.json
// (main tracker + backupSearch) and applied-evidence.json (Gmail events and the
// email tracker summary). Read-only: no send, apply or mailto controls.

const $ = id => document.getElementById(id);
// Times use the viewer's own clock and time zone.
const NOW = new Date();
const TODAY = new Intl.DateTimeFormat('en-CA').format(NOW); // local YYYY-MM-DD

// ---------- text helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clip = (s, n = 160) => { s = String(s ?? '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const safeUrl = u => /^https:\/\//i.test(String(u || '').trim()) && !/drive\.google|docs\.google\.com\/document/i.test(u) ? String(u).trim() : '';
const link = (u, label) => { const s = safeUrl(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : ''; };
const tag = (t, cls = '') => t ? `<span class="tag ${cls}">${esc(t)}</span>` : '';

const CO_STOP = new Set('maroc morocco group groupe sa sas sarl ltd limited the and de du la le les des l d consulting technologies technology solutions services company inc gmbh afrique ouest business international france maghreb africa north west'.split(' '));
const coKey = s => norm(String(s).replace(/\(.*?\)/g, ' ')).replace(/\.(com|ma|fr|net|org|io|co)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t && !CO_STOP.has(t)).join('');
function sameCompany(a, b) {
  const A = coKey(a), B = coKey(b);
  if (!A || !B) return false;
  if (A === B) return true;
  const [s, l] = A.length < B.length ? [A, B] : [B, A];
  return s.length >= 5 && l.startsWith(s);
}
const ROLE_STOP = new Set('stage stages pfe stagiaire stagiaires internship internships intern end of studies study etudes fin h f hf fh 2026 2027 de des du la le les et en d l a au aux the and for un une offre offres projet track program programme opportunity opportunities campagne campaign specific role not identified spontaneous spontanee candidature application pre embauche ingenieur engineer engineering junior'.split(' '));
const roleTokens = s => new Set(norm(s).replace(/[^a-z0-9+#]+/g, ' ').split(' ').filter(t => t.length > 1 && !ROLE_STOP.has(t)));
function roleSim(a, b) {
  const A = roleTokens(a), B = roleTokens(b);
  if (!A.size || !B.size) return null; // unknown
  let n = 0; for (const t of A) if (B.has(t)) n++;
  return n / Math.min(A.size, B.size);
}
const genericRole = r => { const t = roleTokens(r); return t.size === 0; };
const FIELD = new Set('software development developpement genie logiciel it digital informatique web full stack fullstack backend java devops cloud recrute recrutement ses nos hiring recruits'.split(' '));
// an offer that names no specific project (a company's PFE campaign or programme)
const campaignOffer = (title, company) => { const co = new Set(norm(company).replace(/[^a-z0-9]+/g, ' ').split(' ')); return [...roleTokens(title)].every(t => co.has(t) || FIELD.has(t)); };
const urlKey = u => norm(u).replace(/^https?:\/\/(www\.|[a-z]{2}\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
function samePosting(a, b) {
  if (a.postingId && b.postingId && a.postingId === b.postingId) return true;
  const ua = urlKey(a.url), ub = urlKey(b.url);
  return !!(ua && ub && ua === ub);
}

// ---------- dates ----------
const isoDay = s => { const m = String(s || '').match(/(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; };
const daysUntil = d => Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(TODAY + 'T12:00:00Z')) / 864e5);
const fmtDay = d => { if (!d) return ''; const dt = new Date(d + 'T12:00:00Z'); return dt.toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', year: dt.getUTCFullYear() !== NOW.getUTCFullYear() ? 'numeric' : undefined, timeZone: 'UTC'}); };
const fmtTime = iso => new Date(iso).toLocaleString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
const localDay = iso => new Intl.DateTimeFormat('en-CA').format(new Date(iso));
function relDays(d) {
  const n = daysUntil(d);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
}
function age(iso) {
  const t = Date.parse(iso); if (!t) return {text: 'unknown', stale: true};
  const h = (NOW - t) / 36e5;
  const text = h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
  return {text, stale: h > 36};
}

// ---------- fit, CV, deadline ----------
const FIT_RANK = {top: 0, strong: 0, high: 0, excellent: 0, good: 1, medium: 1, moderate: 1, possible: 2, check: 2, partial: 2, weak: 3, low: 3};
function fitOf(o) {
  let f = o.fit || (typeof o.compatibilityAssessment === 'object' && o.compatibilityAssessment ? o.compatibilityAssessment.level || o.compatibilityAssessment.fit : o.compatibilityAssessment);
  let m = norm(f).match(/\b(top|strong|high|excellent|good|medium|moderate|possible|partial|weak|low)\b/);
  if (!m) m = norm([o.note, o.reviewNote, o.why].join(' ')).match(/\b(top|strong|high|excellent|good|medium|moderate|weak|low)\b[ -](?:\w+[ -]){0,2}?(?:fit|match)/);
  return m ? m[1] : null;
}
const fitRank = f => f in FIT_RANK ? FIT_RANK[f] : 2.5;
// No fit recorded: estimate from the title against his target stack, and label it as an estimate.
function estFit(o) {
  const t = norm([o.title, o.role].join(' '));
  if (/audit|quant|analyst|\bhr\b|ressources humaines|talent|gps|locali[sz]ation|sap\b|commercial|marketing|finance/.test(t)) return 'weak';
  if (/java|spring|full.?stack|backend|back-end|devops|cloud|platform|react|typescript|microservice|software (engineer|develop)|genie logiciel|developpeur|developer|web/.test(t)) return 'strong';
  return 'medium';
}
const fitTag = (f, est) => !f ? '' : est ? tag('est. ' + f + ' fit (from title)', FIT_RANK[f] === 0 ? 'good' : FIT_RANK[f] >= 3 ? 'bad' : '') : tag(f + ' fit', FIT_RANK[f] === 0 ? 'good' : FIT_RANK[f] === 1 ? 'info' : FIT_RANK[f] >= 3 ? 'bad' : 'warn');
const CV_NAMES = {software: 'General', general: 'General', java: 'Java Backend', backend: 'Java Backend', cloud: 'Cloud & DevOps', devops: 'Cloud & DevOps'};
function cvOf(o) {
  if (o.recommendedCvId && CV_NAMES[o.recommendedCvId]) return CV_NAMES[o.recommendedCvId] + ' CV';
  const t = String(o.recommendedCv || o.cvSelected || o.cvLabel || '');
  if (!t) return o.cvMasterId && CV_NAMES[o.cvMasterId] ? CV_NAMES[o.cvMasterId] + ' CV' : '';
  const n = norm(t);
  const kind = /java|backend/.test(n) ? 'Java Backend' : /devops|cloud/.test(n) ? 'Cloud & DevOps' : 'General';
  const lang = /_fr|french|\bfr\b/.test(n) ? ' (FR)' : /_en|english|\ben\b/.test(n) ? ' (EN)' : '';
  return kind + ' CV' + lang;
}
function deadlineOf(o) {
  const v = isoDay(o.verifiedDeadline);
  if (v) return {day: v, verified: true};
  const u = isoDay(o.unverifiedDeadline) || isoDay(o.deadline);
  return u ? {day: u, verified: false} : null;
}

// ---------- status classification ----------
const ST = {interview: {r: 0, label: 'Interview', cls: 'good'}, assessment: {r: 1, label: 'Test to do', cls: 'warn'}, done: {r: 2, label: 'Test done', cls: 'info'}, viewed: {r: 3, label: 'Viewed', cls: 'info'}, ack: {r: 4, label: 'Confirmed received', cls: 'info'}, applied: {r: 5, label: 'Applied, no reply', cls: ''}, reported: {r: 6, label: 'You reported applying', cls: ''}, rejected: {r: 9, label: 'Rejected', cls: 'bad'}, bounced: {r: 9, label: 'Email bounced', cls: 'bad'}, incomplete: {r: 8, label: 'Not finished', cls: 'warn'}};
function classify(text) {
  const t = norm(text);
  if (/bounce|undeliver|not delivered/.test(t)) return 'bounced';
  if (/needs? completion|incomplete|not finished|complete your|completez|not submitted/.test(t)) return 'incomplete';
  if (/reject|declin|refus|not selected|not retained|pas retenu|unsuccessful|not moving forward/.test(t)) return 'rejected';
  if (/interview|entretien/.test(t)) return 'interview';
  if (/assessment completed|test completed|completed .*assessment|test done/.test(t)) return 'done';
  if (/assessment|codesignal|online test|test technique/.test(t)) return 'assessment';
  if (/viewed|vue par/.test(t)) return 'viewed';
  const t2 = t.replace(/(employer )?receipt (unverified|unconfirmed|not confirmed)|not employer acknowledg\w*|unverified|unconfirmed/g, ' ');
  if (/acknowledg|confirm|received|recu|receipt|accuse/.test(t2)) return 'ack';
  if (/user[- ]reported|you reported|self-report|reported submitted/.test(t)) return 'reported';
  return 'applied';
}
const KIND_TO_ST = {sent: 'applied', ack: 'ack', viewed: 'viewed', assessment: 'assessment', 'assessment-done': 'done', interview: 'interview', rejected: 'rejected'};

function subApplied(o) {
  const s = String((o.submission && o.submission.status) || '');
  if (!s || /^not verified$/i.test(s)) return null;
  if (/not (yet )?(applied|submitted)|needs? (completion|your)|incomplete|in progress|draft|not started|expired|closed/i.test(s)) return null;
  return s;
}
const isClosedText = s => /\b(closed|expired|filled|no longer accepting|clotur|ferm[ee])/i.test(norm(s));

// ---------- load ----------
async function getJSON(path) {
  const r = await fetch(path + '?t=' + Date.now(), {cache: 'no-store'});
  if (!r.ok) throw new Error(path + ' HTTP ' + r.status);
  return r.json();
}
let STATE = null, EVID = null, PRIVATE = new Map(); // PRIVATE: sha256(url) -> {status,...}

async function sha(u) {
  const b = new TextEncoder().encode(String(u || '').trim());
  const d = await crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(d)].map(n => n.toString(16).padStart(2, '0')).join('');
}

// ---------- model ----------
async function buildModel() {
  const S = STATE, E = EVID || {events: [], emailCampaign: [], emailOffers: []};
  const offers = [];
  const add = (o, origin) => offers.push(o);
  for (const r of S.mainOfferRegistry || []) {
    add({origin: 'main', raw: r, company: r.company, title: r.title || r.role, role: r.role && r.role !== r.title ? r.role : '', url: r.url, postingId: r.postingId,
      source: r.sourceLabel || r.discoverySource || '', location: r.location || '', fit: fitOf(r), cv: cvOf(r), deadline: deadlineOf(r),
      route: r.methodLabel || r.applicationMethod || '', official: r.officialApplicationUrl, next: r.applicationInstructions || r.reviewNote || '',
      titleVerified: !!r.verifiedTitle, verifiedNote: r.listingReviewStatus || '', submitted: subApplied(r), subText: (r.submission && r.submission.status) || '',
      closed: isClosedText(r.listingReviewStatus) || isClosedText(r.submission && r.submission.status), paid: r.remuneration && !/not verified/i.test(r.remuneration) ? r.remuneration : ''});
  }
  const backup = [];
  for (const b of (S.backupSearch && S.backupSearch.offers) || []) {
    const st = String(b.status || '');
    const o = {origin: 'backup', raw: b, company: b.company, title: b.title || b.role, role: b.role && b.role !== b.title ? b.role : '', url: b.link || b.sourceUrl, postingId: b.postingId,
      source: b.source || '', location: b.location || b.city || '', fit: fitOf(b), cv: cvOf(b), deadline: deadlineOf(b),
      route: b.applicationMethod || b.how || '', official: b.officialApplicationUrl, email: b.applicationEmail && b.applicationEmailVerified !== false ? b.applicationEmail : '',
      next: b.nextAction || '', titleVerified: !!b.verifiedTitle, found: b.discoveredAt || b.found || '',
      submitted: b.alreadyApplied === true || /^applied|submitted/i.test(st) ? (st || 'Applied') : null, closed: /closed|expired/i.test(st), backupStatus: st,
      why: b.note || b.why || ''};
    backup.push(o);
  }
  // Email offers the LinkedIn routine found (private tracker, exported without addresses).
  for (const e of E.emailOffers || []) {
    offers.push({origin: 'email', raw: e, company: e.company, title: e.role || 'PFE', role: '', url: e.sourceUrl, source: e.source || 'LinkedIn post', location: e.city || '',
      fit: fitOf(e), cv: e.recommendedCv ? e.recommendedCv + ' CV' : '', deadline: isoDay(e.deadline) ? {day: isoDay(e.deadline), verified: true} : null,
      route: 'Email application — ' + e.status, next: '', titleVerified: true, found: e.foundAt || ''});
  }

  // ---- applied records ----
  const recs = [];
  for (const a of S.applications || []) {
    recs.push({company: a.company, role: a.role || '', channel: a.channel || '', url: a.postingUrl || a.url || '', postingId: a.postingId || '',
      first: isoDay(a.date), last: isoDay(a.date), st: classify(a.status), statusText: a.status || '', evidence: a.evidenceCategory || a.source || '', events: [], src: 'main'});
  }
  const recFor = (company, role, allowCompanyOnly) => {
    const same = recs.filter(r => sameCompany(r.company, company));
    if (!same.length) return null;
    let best = null, bestSim = 0;
    for (const r of same) { const s = roleSim(r.role, role); if (s !== null && s > bestSim) { best = r; bestSim = s; } }
    if (best && bestSim >= 0.5) return best;
    if (allowCompanyOnly || genericRole(role)) { const g = same.filter(r => genericRole(r.role)); if (g.length === 1) return g[0]; if (same.length === 1 && (genericRole(role) || genericRole(same[0].role))) return same[0]; }
    return null;
  };
  const bump = (r, st, day, label, evidence, note) => {
    r.events.push({st, day, label, evidence, note});
    if (day && (!r.last || day > r.last)) r.last = day;
    if (day && (!r.first || day < r.first)) r.first = day;
    // latest decisive status wins; a rejection or interview outranks a plain ack
    const cur = ST[r.st] ? ST[r.st].r : 9;
    if (st === 'rejected' || st === 'interview' || ST[st].r < cur || (r.st === 'assessment' && st === 'done')) r.st = st;
  };
  for (const ev of E.events || []) {
    let st = KIND_TO_ST[ev.kind] || 'applied';
    if (st === 'applied' && ev.evidence === 'reported') st = 'reported';
    let r = recFor(ev.company, ev.role, !ev.role);
    if (!r) { r = {company: ev.company, role: ev.role || '', channel: ev.channel || '', url: '', first: ev.date, last: ev.date, st: st === 'ack' || st === 'viewed' ? st : st, statusText: '', evidence: '', events: [], src: 'gmail'}; recs.push(r); }
    bump(r, st, ev.date, ev.kind, ev.evidence, ev.note);
    if (ev.kind === 'interview' && ev.at) r.interviewAt = ev.at;
    if (ev.kind === 'assessment' && ev.due) r.testDue = ev.due;
    if (ev.kind === 'assessment-done') r.testDone = ev.date;
  }
  for (const c of E.emailCampaign || []) {
    const same = recs.filter(r => sameCompany(r.company, c.company));
    let r = c.role ? recFor(c.company, c.role, false) : same.find(x => /mail/i.test(x.channel) || genericRole(x.role));
    const label = `Email to ${c.sent} contact${c.sent > 1 ? 's' : ''}` + (c.cv.length ? ' — ' + c.cv.join(', ') + ' CV' : '');
    if (!r) { r = {company: c.company, role: c.role ? clip(c.role, 110) : 'Email application (no specific offer)', channel: c.role ? 'Email (offer in a post)' : 'Email', url: '', first: c.firstSent, last: c.lastSent, st: 'applied', statusText: label, evidence: 'Sent from Gmail (email tracker)', events: [], src: c.role ? 'email-offer' : 'email'}; recs.push(r); }
    else { if (!r.statusText) r.statusText = label; r.emailNote = label; }
    if (c.lastSent && (!r.last || c.lastSent > r.last)) r.last = c.lastSent;
    if (c.replied) bump(r, 'ack', c.lastSent, 'reply', 'verified');
  }

  // ---- private marks ----
  for (const o of [...offers, ...backup]) {
    if (!o.url || !PRIVATE.size) continue;
    const m = PRIVATE.get(await sha(o.url));
    if (m && m.status === 'applied') { o.privateApplied = m.submittedOn || true; }
    if (m && m.status === 'expired') o.privateExpired = true;
  }

  // private applied marks that match no offer on the page still count as applications
  if (PRIVATE.size) {
    const urls = new Set(await Promise.all([...offers, ...backup].map(o => o.url ? sha(o.url) : '')));
    for (const [k, m] of PRIVATE) {
      if (m.status !== 'applied' || urls.has(k) || !m.company) continue;
      if (recFor(m.company, m.role, false)) continue;
      recs.push({company: m.company, role: m.role || '', channel: '', url: m.postingUrl || '', first: m.submittedOn || null, last: m.submittedOn || null, st: 'reported', statusText: 'You marked this applied', evidence: 'Your private mark', events: [], src: 'private'});
    }
  }

  // ---- offer -> applied? ----
  const offerMatch = o => {
    // exact posting first
    let r = recs.find(r => samePosting(r, o));
    if (r) return {r, how: 'same listing'};
    const same = recs.filter(r => sameCompany(r.company, o.company));
    if (!same.length) return null;
    let best = null, bestSim = 0;
    for (const x of same) { const s = Math.max(roleSim(x.role, o.title) ?? 0, roleSim(x.role, o.role) ?? 0); if (s > bestSim) { best = x; bestSim = s; } }
    if (best && bestSim >= 0.5) return {r: best, how: 'same company and role'};
    const generic = same.filter(x => genericRole(x.role) || /no specific offer/i.test(x.role));
    if (generic.length) return {r: generic[0], how: 'company only', weak: true};
    if (campaignOffer(o.title, o.company)) { const live = same.filter(x => x.st !== 'incomplete'); if (live.length) return {r: live[0], how: 'company PFE campaign', weak: true}; }
    return {r: same[0], how: 'other role at this company', other: true};
  };
  const companyOfferCount = c => [...offers, ...backup].filter(o => sameCompany(o.company, c)).length;
  for (const o of [...offers, ...backup]) {
    const m = offerMatch(o);
    o.match = m;
    const explicit = o.submitted || o.privateApplied;
    const viaRecord = m && !m.other && (!m.weak || companyOfferCount(o.company) === 1) && m.r.st !== 'incomplete';
    if (m && !m.other && m.r.st === 'incomplete') o.unfinished = m.r;
    o.applied = !!(explicit || viaRecord);
    o.otherRoleApplied = !o.applied && m ? m.r : null;
    if (o.applied && !viaRecord) {
      // offer says applied but no record exists: create one so it shows in Applied
      const st = o.privateApplied ? 'reported' : classify(o.submitted);
      const r = {company: o.company, role: o.title + (o.role ? ' — ' + o.role : ''), channel: o.source, url: o.url, first: isoDay(o.privateApplied) || null, last: isoDay(o.privateApplied) || null, st,
        statusText: o.privateApplied ? 'You marked this applied' : o.submitted, evidence: o.privateApplied ? 'Your private mark' : (o.origin === 'backup' ? 'Backup search record' : 'Main tracker'), events: [], src: 'offer'};
      recs.push(r); o.match = {r, how: 'offer record'};
    } else if (o.applied && m) { if (!m.r.url && o.url) m.r.url = o.url; if (!m.r.offerTitle) m.r.offerTitle = o.title; }
    const dl = o.deadline && o.deadline.day;
    o.past = !!(dl && daysUntil(dl) < 0);
    if (!o.fit) o.estFit = estFit(o);
    o.isClosed = !o.applied && (o.closed || o.privateExpired || o.past);
  }

  // ---- completion queue (seen, not confirmed) ----
  const queue = [];
  for (const q of S.completionQueue || []) {
    const o = {company: q.company, title: q.role, url: q.originalListingUrl || q.applyUrl, postingId: q.postingId, platform: q.platform, status: q.status, warn: q.fitWarning || q.warning || '', pfe: q.pfeEligible, found: q.discoveredAt, cv: cvOf(q)};
    const m = offerMatch(o);
    if (/applied/.test(q.status) && !(m && !m.other)) {
      recs.push({company: q.company, role: q.role, channel: q.platform, url: o.url, first: isoDay(q.discoveredAt), last: isoDay(q.discoveredAt), st: 'reported', statusText: 'You reported applying', evidence: 'Main tracker (user-reported)', events: [], src: 'queue'});
      continue;
    }
    if (m && !m.other && !m.weak) continue; // already applied
    if (offers.some(x => samePosting(x, o)) || backup.some(x => samePosting(x, o))) continue; // shown as an offer
    queue.push(o);
  }

  // ---- dedupe applied records (company + role) ----
  const out = [];
  for (const r of recs) {
    const d = out.find(x => sameCompany(x.company, r.company) && ((roleSim(x.role, r.role) ?? 0) >= 0.75 || (x.url && r.url && urlKey(x.url) === urlKey(r.url))));
    if (d) { for (const e of r.events) d.events.push(e); if (ST[r.st].r < ST[d.st].r || r.st === 'rejected') { d.st = r.st; if (r.statusText) d.statusText = r.statusText; } if (r.last && (!d.last || r.last > d.last)) d.last = r.last; d.interviewAt ||= r.interviewAt; d.testDue ||= r.testDue; d.testDone ||= r.testDone; d.url ||= r.url; }
    else out.push(r);
  }
  return {offers, backup, recs: out, queue};
}

// ---------- render ----------
function deadlineTag(d) {
  if (!d) return tag('no deadline listed');
  const n = daysUntil(d.day);
  const cls = n < 0 ? 'bad' : n <= 3 ? 'bad' : n <= 10 ? 'warn' : '';
  return tag(`Deadline ${fmtDay(d.day)} (${relDays(d.day)})`, cls + ' solid') + ' ' + tag(d.verified ? 'verified' : 'unverified', d.verified ? 'good' : 'warn');
}
function offerCard(o) {
  const urgent = o.deadline && daysUntil(o.deadline.day) <= 7 && daysUntil(o.deadline.day) >= 0;
  const kv = [];
  kv.push(['Apply via', esc(clip(o.route || 'Not stated', 220)) + (o.official && safeUrl(o.official) && urlKey(o.official) !== urlKey(o.url) ? ' — ' + link(o.official, 'official application page') : '')]);
  if (o.email) kv.push(['Email', esc(o.email) + ' (from the public posting)']);
  if (o.cv) kv.push(['CV', esc(o.cv)]);
  if (o.next) kv.push(['Next step', esc(clip(o.next, 240))]);
  if (o.why && o.origin === 'backup') kv.push(['Why', esc(clip(o.why, 240))]);
  if (o.otherRoleApplied) kv.push(['Note', `You already applied to ${esc(o.otherRoleApplied.company)} for “${esc(clip(o.otherRoleApplied.role, 80))}”. This is a different role.`]);
  return `<article class="card ${urgent ? 'urgent' : ''}" data-url="${esc(o.url || '')}" data-company="${esc(o.company)}" data-title="${esc(o.title)}">
    <h3><span class="co">${esc(o.company)}</span> — ${esc(o.title)}${o.role ? ' <span style="color:var(--muted);font-weight:500">(' + esc(clip(o.role, 90)) + ')</span>' : ''}</h3>
    <div class="row">${deadlineTag(o.deadline)} ${fitTag(o.fit || o.estFit, !o.fit)} ${o.location ? tag(clip(o.location, 40)) : ''} ${o.paid ? tag('paid', 'good') : ''}</div>
    <div class="row">Source: ${link(o.url, clip(o.source || 'listing', 60)) || esc(clip(o.source || 'not recorded', 60))} ${tag(o.titleVerified ? 'title verified' : 'title unverified', o.titleVerified ? 'good' : 'warn')}${o.found ? ' · found ' + esc(fmtDay(isoDay(o.found))) : ''}</div>
    <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="markbar"><button data-mark="applied">I applied</button><button data-mark="expired">Closed</button></div>
  </article>`;
}
const byDeadlineFit = (a, b) => {
  const da = a.deadline ? daysUntil(a.deadline.day) : 9999, db = b.deadline ? daysUntil(b.deadline.day) : 9999;
  const wa = da <= 30 ? da : 1000, wb = db <= 30 ? db : 1000; // near deadlines first
  return wa - wb || fitRank(a.fit || a.estFit) - fitRank(b.fit || b.estFit) || da - db || String(b.found || '').localeCompare(String(a.found || ''));
};

function render(M) {
  const S = STATE, E = EVID;
  const open = M.offers.filter(o => !o.applied && !o.isClosed).sort(byDeadlineFit);
  const bOpen = M.backup.filter(o => !o.applied && !o.isClosed && !M.offers.some(x => !x.isClosed && (samePosting(x, o) || (sameCompany(x.company, o.company) && (roleSim(x.title, o.title) ?? 0) >= 0.5)))).sort(byDeadlineFit);
  const closed = [...M.offers, ...M.backup].filter(o => o.isClosed);
  const recs = M.recs;
  const unfinished = recs.filter(r => r.st === 'incomplete');
  const isSpec = r => r.src === 'email' && r.st === 'applied' && !r.events.length;
  const spec = recs.filter(isSpec).sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')) || a.company.localeCompare(b.company));
  const active = recs.filter(r => !isSpec(r) && !['rejected', 'bounced', 'incomplete'].includes(r.st)).sort((a, b) => ST[a.st].r - ST[b.st].r || String(b.last || '').localeCompare(String(a.last || '')));
  const rejected = recs.filter(r => r.st === 'rejected' || r.st === 'bounced').sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')));

  // ---- Do next ----
  const items = [];
  for (const r of recs) {
    if (r.interviewAt && Date.parse(r.interviewAt) > NOW - 2 * 36e5) {
      const note = r.events.find(e => e.st === 'interview' && e.note);
      items.push({when: r.interviewAt, cls: 'hot', html: `<h3>Interview — <span class="co">${esc(r.company)}</span>, ${esc(r.role)}</h3><div class="row t">${esc(fmtTime(r.interviewAt))} (${relDays(localDay(r.interviewAt))})</div>${note ? `<div class="row">${esc(note.note)}</div>` : ''}<div class="row">${tag('seen in Gmail', 'good')}</div>`});
    }
    if (r.testDue && !r.testDone && Date.parse(r.testDue) > NOW) items.push({when: r.testDue, cls: 'hot', html: `<h3>Test — <span class="co">${esc(r.company)}</span>, ${esc(r.role)}</h3><div class="row t">Due ${esc(fmtTime(r.testDue))}</div>`});
  }
  const companiesWithItem = new Set(items.map(i => coKey(i.html.match(/class="co">([^<]*)/)?.[1] || '')));
  for (const p of S.priority || []) {
    const kind = norm(p.kind);
    if (!/interview|deadline|assessment|unfinished|apply/.test(kind)) continue; // follow-ups are waiting, not actions
    const rec = recs.find(r => sameCompany(r.company, p.company));
    if (rec && (rec.testDone || rec.st === 'rejected') && /deadline|assessment/.test(kind)) continue; // already done
    if (/assessment/.test(kind) && /completed|await/i.test(p.task)) continue;
    if (companiesWithItem.has(coKey(p.company))) continue;
    const day = isoDay(p.date);
    if (day && daysUntil(day) < 0) continue;
    items.push({when: day ? day + 'T23:00:00+01:00' : '9999', cls: day && daysUntil(day) <= 3 ? 'urgent' : '', html: `<h3><span class="co">${esc(p.company)}</span></h3><div class="row t">${esc(clip(p.task, 260))}</div><div class="row">${day ? tag(fmtDay(day) + ' (' + relDays(day) + ')', 'solid') : ''} ${tag('from main tracker')}</div>`});
  }
  for (const o of open.concat(bOpen)) {
    if (o.deadline && daysUntil(o.deadline.day) <= 10) items.push({when: o.deadline.day + 'T23:00:00+01:00', cls: daysUntil(o.deadline.day) <= 3 ? 'hot' : 'urgent', html: `<h3>Apply — <span class="co">${esc(o.company)}</span>, ${esc(clip(o.title, 90))}</h3><div class="row">${deadlineTag(o.deadline)} ${fitTag(o.fit)}</div>`});
  }
  if (unfinished.length) items.push({when: '9999y', cls: 'urgent', html: `<h3>Finish ${unfinished.length} started application${unfinished.length > 1 ? 's' : ''}</h3><div class="row t">The tracker says these were started but not submitted. Finish them or drop them.</div><ul class="fresh">${unfinished.map(r => `<li><b>${esc(r.company)}</b> — ${r.url && safeUrl(r.url) ? link(r.url, clip(r.role, 80)) : esc(clip(r.role, 80))} <span style="color:var(--muted)">(${esc(clip(r.channel, 30))}${r.first ? ', ' + esc(fmtDay(r.first)) : ''})</span></li>`).join('')}</ul>`});
  const t = E && E.emailTracker;
  if (t && t.draftedNotSent) {
    const by = t.draftedNotSentByLanguage || {};
    items.push({when: '9999z', cls: '', html: `<h3>${t.draftedNotSent} application emails drafted in Gmail, not sent</h3><div class="row t">${by.fr ? by.fr + ' French' : ''}${by.fr && by.en ? ', ' : ''}${by.en ? by.en + ' English' : ''}. They wait in your Drafts; nothing sends on its own.</div><div class="row">${tag('email tracker, updated ' + age(t.updatedAt).text)}</div>`});
  }
  items.sort((a, b) => String(a.when).localeCompare(String(b.when)));
  $('nextList').innerHTML = items.length ? items.map(i => `<article class="card ${i.cls}">${i.html}</article>`).join('') : '<p class="empty">Nothing dated ahead.</p>';
  $('nextCount').textContent = items.length ? items.length + ' items' : '';

  // ---- Open ----
  $('openList').innerHTML = open.length ? open.map(offerCard).join('') : '<p class="empty">No open offers in the main list that you have not applied to.</p>';
  $('openCount').textContent = open.length;
  const q = M.queue.sort((a, b) => (a.warn ? 1 : 0) - (b.warn ? 1 : 0) || String(b.found || '').localeCompare(String(a.found || '')));
  $('checkSum').textContent = `Seen but not confirmed (${q.length})`;
  $('checkWrap').hidden = !q.length;
  $('checkList').innerHTML = q.map(o => `<article class="card"><h3><span class="co">${esc(o.company)}</span> — ${esc(o.title)}</h3><div class="row">${link(o.url, o.platform || 'listing') || esc(o.platform || '')} ${tag(String(o.status).replace(/-/g, ' '))} ${o.warn ? tag('fit warning', 'warn') : ''} ${o.pfe === false ? tag('not a PFE', 'bad') : ''}</div>${o.warn ? `<div class="row">${esc(clip(o.warn, 200))}</div>` : ''}</article>`).join('');

  // ---- Backup ----
  $('backupList').innerHTML = bOpen.length ? bOpen.map(offerCard).join('') : '<p class="empty">No additional offers found yet.</p>';
  const bu = S.backupSearch && S.backupSearch.updatedAt;
  $('backupCount').textContent = bOpen.length + (bu ? ' · updated ' + age(bu).text : '');

  // ---- Applied ----
  const row = r => {
    const s = ST[r.st] || ST.applied;
    const evs = r.events.slice().sort((a, b) => String(b.day).localeCompare(String(a.day)));
    const ev = norm(r.evidence).replace(/unverified|unconfirmed|not employer/g, ' ');
    const ver = r.st === 'reported' || /user|self.report|you said/.test(ev) ? tag('you reported') : r.events.some(e => e.evidence === 'verified') || /verified|gmail|employer|confirm|sent label|sent from|portal/.test(ev) ? tag('verified', 'good') : tag('unverified', 'warn');
    const detail = [r.statusText && r.statusText !== s.label ? clip(r.statusText, 120) : '', r.emailNote && r.emailNote !== r.statusText ? r.emailNote : '', ...evs.filter(e => e.note).map(e => e.note)].filter(Boolean);
    return `<tr><td><b>${esc(r.company)}</b><br><span style="color:var(--muted)">${r.url && safeUrl(r.url) ? link(r.url, clip(r.role || r.offerTitle || 'listing', 90)) : esc(clip(r.role || r.offerTitle || '', 90))}</span></td>
      <td data-l="Status">${tag(s.label, s.cls + ' solid')} ${ver}${detail.length ? `<div style="color:var(--muted);margin-top:3px">${detail.map(esc).join('<br>')}</div>` : ''}</td>
      <td data-l="Via">${esc(clip(r.channel, 40))}</td><td class="nowrap" data-l="Last activity">${r.last ? esc(fmtDay(r.last)) : '—'}</td></tr>`;
  };
  const table = rs => `<table class="table"><thead><tr><th>Company and role</th><th>Status</th><th>Via</th><th>Last activity</th></tr></thead><tbody>${rs.map(row).join('')}</tbody></table>`;
  $('appliedActive').innerHTML = active.length ? table(active) : '<p class="empty">No applications on record.</p>';
  $('specSum').textContent = `Speculative emails with no reply (${spec.length} companies)`;
  $('specWrap').hidden = !spec.length;
  $('appliedSpec').innerHTML = `<p class="lead">CV sent by email without a specific posting. Addresses stay in the private tracker.</p><table class="table"><thead><tr><th>Company</th><th>What was sent</th><th>Sent</th></tr></thead><tbody>${spec.map(r => `<tr><td><b>${esc(r.company)}</b></td><td data-l="Sent">${esc(r.statusText)}</td><td class="nowrap" data-l="Date">${r.last ? esc(fmtDay(r.last)) : '\u2014'}</td></tr>`).join('')}</tbody></table>`;
  $('rejSum').textContent = `Rejected or email bounced (${rejected.length})`;
  $('rejWrap').hidden = !rejected.length;
  $('appliedRejected').innerHTML = table(rejected);
  $('appliedCount').textContent = `${active.length + spec.length + rejected.length} · ${active.length} applications, ${spec.length} speculative emails, ${rejected.length} rejected or bounced`;

  // ---- Closed ----
  $('closedSum').textContent = `Closed or past deadline (${closed.length})`;
  $('closedList').innerHTML = closed.map(o => `<article class="card"><h3><span class="co">${esc(o.company)}</span> — ${esc(o.title)}</h3><div class="row">${o.deadline ? deadlineTag(o.deadline) : ''} ${o.privateExpired ? tag('you marked closed') : o.closed ? tag('listing closed') : ''} ${link(o.url, 'listing')}</div></article>`).join('') || '<p class="empty">None.</p>';

  // ---- Stats + nav ----
  const interviews = recs.filter(r => r.st === 'interview').length;
  $('stats').innerHTML = [[open.length, 'open, not applied'], [bOpen.length, 'backup finds'], [active.length, 'applications in progress'], [spec.length, 'speculative emails'], [interviews, 'interviews'], [rejected.length, 'rejections']].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  $('nav').innerHTML = [['next', 'Do next', items.length], ['open', 'Open', open.length], ['backup', 'Backup', bOpen.length], ['applied', 'Applied', active.length + spec.length + rejected.length], ['sources', 'Sources', '']].map(([id, l, n]) => `<a href="#${id}">${l}${n !== '' ? '<b>' + n + '</b>' : ''}</a>`).join('');

  // ---- Freshness ----
  const fr = [];
  const line = (label, iso, extra) => { const a = age(iso); fr.push(`<li><b>${label}:</b> ${iso ? esc(fmtTime(iso)) + ' — ' + a.text : 'unknown'} ${iso && a.stale ? tag('stale', 'warn') : ''}${extra ? ' <span style="color:var(--muted)">' + esc(extra) + '</span>' : ''}</li>`); };
  line('Main tracker (ChatGPT) last sync', S.lastSyncedAt);
  if (S.gmailVerification) line('Gmail checked by main tracker', S.gmailVerification.lastVerifiedAt, clip(S.gmailVerification.scope, 200));
  if (E && E.gmail) line('Gmail application notices checked by Maya', E.gmail.checkedAt, clip(E.gmail.scope, 200));
  if (E && E.emailTracker && E.emailTracker.updatedAt) line('Email applications tracker', E.emailTracker.updatedAt, `${E.emailTracker.sent} sent, ${E.emailTracker.draftedNotSent} drafted`);
  if (bu) line('Backup search (Maya)', bu);
  if (!E) fr.push('<li class="err">applied-evidence.json did not load: email and Gmail evidence is missing from this view.</li>');
  $('freshList').innerHTML = fr.join('');
  $('siteList').innerHTML = (S.sourcesChecked || []).map(s => `<li>${link(s.url, s.label) || esc(s.label)} — ${s.checkedAt ? esc(fmtTime(s.checkedAt)) + ' (' + age(s.checkedAt).text + ')' : 'not recorded'} ${tag(s.status || '', s.status === 'ok' ? 'good' : 'warn')}</li>`).join('') || '<li>None recorded.</li>';
  $('foot').textContent = `Page built from data loaded ${fmtTime(NOW.toISOString())}. Main list: ${(S.mainOfferRegistry || []).length} offers, ${(S.applications || []).length} application records.`;
  window.__dash = {open: open.length, backup: bOpen.length, applied: active.length + spec.length + rejected.length, spec: spec.length, unfinished: unfinished.length, active: active.length, rejected: rejected.length, closed: closed.length, queue: q.length, next: items.length};
  document.dispatchEvent(new CustomEvent('dash:rendered'));
}

async function refresh() {
  try { render(await buildModel()); }
  catch (e) { console.error(e); $('loadError').innerHTML = `<p class="notice err">Could not render the dashboard: ${esc(e.message)}</p>`; }
}

async function start() {
  try {
    const [s, e] = await Promise.allSettled([getJSON('./shared-state.json'), getJSON('./applied-evidence.json')]);
    if (s.status !== 'fulfilled') throw s.reason;
    STATE = s.value; EVID = e.status === 'fulfilled' ? e.value : null;
  } catch (e) {
    $('loadError').innerHTML = `<p class="notice err">Could not load the tracker data (${esc(e.message)}). Nothing below is current.</p>`;
    return;
  }
  await refresh();
}

// private applied marks (private.js) call this with a Map of sha256(url) -> mark
window.dashSetPrivate = async (map, signedIn) => {
  PRIVATE = map || new Map();
  document.body.classList.toggle('signed', !!signedIn);
  if (STATE) await refresh();
};
start();
