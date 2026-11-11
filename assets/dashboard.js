
(()=>{'use strict';
const $=id=>document.getElementById(id);const text=(id,v)=>{if($(id))$(id).textContent=String(v??'—')};
const clean=x=>String(x??'').slice(0,300);
const make=(tag,cls,str)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(str!==undefined)x.textContent=clean(str);return x};
const cards=[...document.querySelectorAll('.offer')];
function filter(){
 const q=$('search').value.trim().toLowerCase(),lane=$('lane').value,fit=$('fit').value;
 const status=$('application-status-filter').value;
 const container=document.querySelector('.offers');
 const orderOf=card=>card.dataset.expired==='true'?2:card.dataset.applied==='true'?1:0;
 const ordered=[...cards].sort((a,b)=>orderOf(a)-orderOf(b)||Number(a.dataset.offerIndex)-Number(b.dataset.offerIndex));
 ordered.forEach(card=>container.append(card));
 let visible=0,applied=0,expired=0,known=0;
 cards.forEach(card=>{
   const isExpired=card.dataset.expired==='true';
   const isApplied=!isExpired&&(card.dataset.applied==='true'||card.dataset.confirmedEmailSent==='true');
   if(card.dataset.applicationLoaded==='true')known++;
   if(isApplied)applied++;
   if(isExpired)expired++;
   const statusMiss=status==='open'?(isApplied||isExpired):status==='applied'?!isApplied:status==='expired'?!isExpired:false;
   card.hidden=Boolean(statusMiss||(q&&!card.textContent.toLowerCase().includes(q))||(lane&&card.dataset.lane!==lane)||(fit&&card.dataset.fit!==fit));
   if(!card.hidden)visible++;
 });
 text('offer-filter-count',visible+' of '+cards.length+' offers shown · '+applied+' applied · '+expired+' expired'+(known<cards.length?' · Sign in to load private statuses':''));
 $('offer-no-matches').hidden=visible!==0;
}
['search','lane','fit','application-status-filter'].forEach(id=>$(id).addEventListener('input',filter));
document.addEventListener('pfe:application-statuses-updated',filter);
filter();
function normalizeUrl(value){try{const u=new URL(value);const id=(u.pathname.match(/(?:jobs\/view\/|stage-emploi-maroc\/|job\/|offre-emploi-)[^/]*?(\d{4,})(?:[/.]|$)/)||[])[1];return id?(u.hostname.replace(/^www\.|^ma\./,'')+':'+id):u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'').toLowerCase()}catch{return ''}}
function normalizedText(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ')}
function makeMaya(data){
 const root=$('maya-list');root.replaceChildren();
 const candidates=Array.isArray(data.backupSearch?.offers)?data.backupSearch.offers:[];
 const main=Array.isArray(data.mainOfferRegistry)?data.mainOfferRegistry:[];
 const keys=new Set(),roles=new Set();
 for(const a of main){if(a.url)keys.add(normalizeUrl(a.url));if(a.postingId)keys.add('id:'+normalizedText(a.postingId));roles.add(normalizedText(a.company)+'|'+normalizedText(a.role||a.title))}
 let count=0,duplicates=0,invalid=0;
 const publicLink=(value)=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
 const field=(card,label,value)=>{if(!value)return;const p=make('p','backup-detail');const b=make('strong',null,label+': ');p.append(b,document.createTextNode(String(value)));card.append(p)};
 for(const entry of candidates){
  if(!entry||typeof entry!=='object'||!entry.verifiedTitle||!entry.title||!entry.company||!entry.sourceUrl){invalid++;continue}
  const original=publicLink(entry.sourceUrl);if(!original){invalid++;continue}
  const idKey=entry.postingId?'id:'+normalizedText(entry.postingId):'';
  const urlKey=normalizeUrl(entry.sourceUrl);
  const roleKey=normalizedText(entry.company)+'|'+normalizedText(entry.role||entry.title);
  if((urlKey&&keys.has(urlKey))||(idKey&&keys.has(idKey))||roles.has(roleKey)){duplicates++;continue}
  keys.add(urlKey);if(idKey)keys.add(idKey);roles.add(roleKey);
  const card=make('article','backup-offer'),company=make('small','muted',entry.company),title=make('h3',null,entry.title),deadline=make('small','muted',entry.verifiedDeadline?'Verified deadline: '+entry.verifiedDeadline:'Deadline not verified'),link=make('a',null,'Open original posting ↗');
  link.href=original;link.rel='noopener noreferrer';link.target='_blank';
  card.append(company,title,deadline);
  const method=entry.applicationMethodLabel||entry.applicationMethod||entry.applicationRoute||'Not verified — open original posting';
  field(card,'Application method',method);
  // Only publish an address if explicitly marked as a public, verified recruitment contact.
  const address=entry.applicationEmailVerified===true?(entry.applicationEmail||entry.recruitmentEmail||entry.contactEmail):null;
  if(address && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))field(card,'Verified recruitment email',address);
  const official=publicLink(entry.officialApplicationUrl||entry.companyApplicationUrl||entry.careerUrl||entry.applyUrl);
  if(official){const a=make('a',null,'Apply on company website ↗');a.href=official;a.rel='noopener noreferrer';a.target='_blank';const p=make('p','backup-detail');p.append(a);card.append(p)}
  field(card,'Email subject',entry.emailSubject||entry.applicationSubject);
  const docs=entry.requiredDocuments||entry.requestedDocuments;
  field(card,'Required documents',Array.isArray(docs)?docs.join(', '):docs);
  field(card,'Recommended CV',entry.recommendedCv||entry.cvRecommendation||entry.cvGuidance|| (String(method).toLowerCase().includes('profile')?'Mohssine_Echlaihi_PFE.pdf (generic profile CV)':null));
  field(card,'Profile adjustment',entry.profileAdjustment||entry.suggestedProfileChange);
  field(card,'Next action',entry.nextAction||entry.applicationNextAction|| (String(method).toLowerCase().includes('email')?'Verify the listed email and approve sending a tailored application':'Check the original listing and confirm its application route'));
  field(card,'Suitability',entry.compatibilityAssessment||entry.matchReason);
  card.append(link);root.append(card);count++;
 }
 if(!count){root.append(make('p','muted','No additional offers found yet.'))}
 text('maya-status',(count?count+' additional verified offer(s). ':'')+(duplicates?duplicates+' duplicate(s) omitted. ':'')+(invalid?invalid+' invalid/unverified record(s) omitted. ':'')+'Backup data last updated: '+clean(data.backupSearch?.updatedAt||'not yet published')+'. Email sending and application submission are never automatic.');
}
function humanAge(ms){if(!Number.isFinite(ms)||ms<0)return 'time unknown';const sec=Math.floor(ms/1000);if(sec<60)return 'just now';const min=Math.floor(sec/60);if(min<60)return min+' minute'+(min===1?'':'s')+' ago';const hours=Math.floor(min/60);if(hours<48)return hours+' hour'+(hours===1?'':'s')+' ago';const days=Math.floor(hours/24);return days+' day'+(days===1?'':'s')+' ago'}
function showGmailFreshness(data){
 const v=data.gmailVerification||{},when=typeof v.lastVerifiedAt==='string'?new Date(v.lastVerifiedAt):null;
 const valid=when&&Number.isFinite(when.getTime());
 if(!valid){text('gmail-last-verified','Not yet verified');text('gmail-stale-warning','No verified timestamp');text('gmail-scope','Gmail verification has not been recorded in shared data.');$('gmail-freshness').classList.add('is-stale');return}
 const tz=v.timezone||'Africa/Casablanca';
 let dateText='';try{dateText=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:tz}).format(when)}catch{dateText=when.toISOString()}
 const age=Date.now()-when.getTime();const stale=age>Math.max(1,Number(v.staleAfterHours)||24)*3600000;
 text('gmail-last-verified',dateText+' ('+tz+') · '+humanAge(age));
 text('gmail-stale-warning',stale?'Stale data — Gmail needs a fresh check':'');
 text('gmail-scope',v.scope||'Last verified Gmail check; refreshing this page does not re-check Gmail.');
 $('gmail-freshness').classList.toggle('is-stale',stale);
}
function showSources(data){
 const target=$('sources-list');target.replaceChildren();
 const items=Array.isArray(data.sourcesChecked)?data.sourcesChecked:[];
 if(!items.length){target.append(make('p','muted','No source checks recorded yet.'));return}
 for(const item of items){const card=make('div','source-item'),header=make('strong',null,item.label||'Source');card.append(header);
 if(item.url&&/^https?:\/\//i.test(item.url)){const a=make('a',null,'Open checked source ↗');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';card.append(make('br'),a)}
 const when=item.checkedAt&&Number.isFinite(new Date(item.checkedAt).getTime())?new Date(item.checkedAt):null;
 let stamp='Not yet checked';if(when){try{stamp=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Casablanca'}).format(when)+' (Africa/Casablanca) · '+humanAge(Date.now()-when.getTime())}catch{stamp=item.checkedAt}}
 card.append(make('small',null,'Last actual check: '+stamp));
 const status={ok:'Search completed',limited:'Limited verification',partial:'Partial access',no_results:'No verified results',failed:'Access failed'}[item.status]||'Status unknown';
 card.append(make('small',item.status==='ok'?'':'issue',status));
 if(item.details)card.append(make('small',null,item.details));
 if(item.accessIssue)card.append(make('small','issue','Access issue: '+item.accessIssue));
 target.append(card)}
}
function showVerifiedOfferTitles(data){
 const main=Array.isArray(data.mainOfferRegistry)?data.mainOfferRegistry:[];
 // The first cards are legacy static HTML. Render newly published registry entries too.
 const container=document.querySelector('#opportunities .offers');
 for(let i=cards.length;i<main.length;i++){
   const item=main[i];
   const card=make('article','offer');
   card.dataset.offerIndex=String(i);
   const hay=(item.role||item.title||'').toLowerCase();
   card.dataset.lane=/devops|cloud|infra|linux|automation|automatisation/.test(hay)?'devops':/java|spring|jee/.test(hay)?'java':/full.?stack|web|react/.test(hay)?'fullstack':'other';
   card.dataset.fit=/software|devops|cloud|full.?stack|développement|development|automation|automatisation/.test(hay)?'good':'weak';
   const header=make('div','offer-header'),heading=make('h3',null,item.company||'Company');
   const tags=make('div','tags');tags.append(make('span',null,card.dataset.lane),make('span',null,card.dataset.fit+' fit'));header.append(heading,tags);
   const roleBlock=make('div','offer-role-block');roleBlock.append(make('p','jobtitle',item.title||'Internship'),make('p','role',item.role||item.title||''));
   const meta=make('div','offer-meta'),provenance=make('p','provenance'),sourceLink=make('a','source-link','Original listing');
   if(/^https:\/\//.test(item.url||'')){sourceLink.href=item.url;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer'}
   provenance.append(sourceLink);
   meta.append(provenance,make('p','deadline',item.verifiedDeadline?'Verified deadline: '+item.verifiedDeadline:'Deadline not verified'));
   const method=make('div','method-block');
   method.append(make('p','method-label',item.listingReviewStatus||'Imported listing — verify details'),make('p','submission-evidence','Application status not verified; check platform history before applying.'));
   const footer=make('div','offer-footer'),buttons=make('div','buttons'),open=make('a','secondary','Open listing');
   if(/^https:\/\//.test(item.url||'')){open.href=item.url;open.target='_blank';open.rel='noopener noreferrer'}
   buttons.append(open);footer.append(buttons);
   card.append(header,roleBlock,meta,method,footer);
   container.append(card);cards.push(card);
 }
 cards.forEach((card,i)=>{const source=main[i];if(!source)return;
 const title=card.querySelector('.jobtitle'),heading=card.querySelector('h3'),sourceLink=card.querySelector('.source-link'),role=card.querySelector('.role');
 if(heading)heading.textContent=source.company||'Company unverified';
 if(title)title.textContent=(source.verifiedTitle&&source.title)?source.title:'Exact original title not verified';
 if(role&&source.role)role.textContent=source.role;
 const sourceType=source.submission?.sourceType;
 const recordedApplied=sourceType==='verified-sent-mail'||sourceType==='user-reported-submission';
 card.dataset.confirmedEmailSent=recordedApplied?'true':'false';
 card.dataset.publicApplicationEvidence=sourceType||'';
 if(recordedApplied&&card.dataset.expired!=='true'){card.classList.add('offer-is-applied')}
 if(sourceLink){if(source.url&&/^https?:\/\//i.test(source.url)){sourceLink.href=source.url;sourceLink.textContent='Source: '+(source.sourceLabel||'Original listing');sourceLink.removeAttribute('aria-disabled')}
 else{sourceLink.removeAttribute('href');sourceLink.textContent='Source unavailable'}}
 })}
function showApplicationMethods(data){
 const masters=new Map((data.cvMasters?.versions||[]).map(x=>[x.id,x]));
 const entries=Array.isArray(data.mainOfferRegistry)?data.mainOfferRegistry:[];
 cards.forEach((card,index)=>{
   const item=entries[index];if(!item)return;
   const master=masters.get(item.recommendedCvId||item.cvMasterId);
   const link=card.querySelector('.buttons a.btn');
   if(link&&master&&/^https:\/\/drive\.google\.com\/file\//.test(master.pdf||'')){const tailored=item.tailoredCvUrl&&/^https:\/\//.test(item.tailoredCvUrl);link.href=tailored?item.tailoredCvUrl:master.pdf;link.textContent=tailored?'View tailored CV':'View '+((item.applicationMethod==='rekrute'||item.applicationMethod==='linkedin'||item.applicationMethod==='stagiaires')?'general CV':'recommended CV')}
   const strategy=card.querySelector('.cv-strategy');if(strategy){const route=item.tailoredCvUrl?'Dedicated copy available: '+item.tailoredCvUrl:'No dedicated company CV prepared until direct PDF upload is verified.';strategy.textContent='CV strategy: '+route+' Profile-based applications use the general CV.';}
   const method=card.querySelector('.application-method');
   if(method)method.textContent=item.methodLabel||'Check external website';

   // An official employer career-page CV draft is optional until its upload field is verified.
   const existingDraft=card.querySelector('.tailored-draft-link');
   if(existingDraft)existingDraft.remove();
   if(item.tailoredCvDraftUrl&&/^https:\/\/drive\.google\.com\/file\//.test(item.tailoredCvDraftUrl)){
     const draft=document.createElement('a');
     draft.className='tailored-draft-link';
     draft.href=item.tailoredCvDraftUrl;
     draft.target='_blank';draft.rel='noopener noreferrer';
     draft.textContent='View tailored CV draft · upload not confirmed';
     draft.title='Company-specific profile only. Verify the application form asks for a separate CV upload before using.';
     card.querySelector('.method-block')?.append(draft);
   }
   if(item.officialCareersUrl&&/^https:\/\//.test(item.officialCareersUrl)){
     const listing=card.querySelector('.offer-footer .buttons a.secondary');
     if(listing){listing.href=item.officialCareersUrl;listing.textContent='Official careers';}
   }
   // Badges are sourced exclusively from structured offer fields; unknown means no label.
   card.querySelector('.offer-benefits')?.remove();
   const verifiedBenefits=[];
   if(item.paid===true&&typeof item.paidStatus==='string'&&item.paidStatus.trim()){
     const amount=item.paidStatus.match(/MAD\s*[\d, ]+(?:\/month|\s+per month)?/i);
     const label=amount?'Paid · '+amount[0].replace(/\s+per month/i,'/month'):'Paid internship';
     verifiedBenefits.push({label,detail:'Payment: '+item.paidStatus});
   }
   if(item.preHire===true&&typeof item.preHireStatus==='string'&&item.preHireStatus.trim()){
     verifiedBenefits.push({label:'Pré-embauche possible',detail:item.preHireStatus+' — not guaranteed'});
   }
   if(verifiedBenefits.length){
     const group=document.createElement('div');
     group.className='offer-benefits';
     group.setAttribute('aria-label','Advertised internship benefits');
     for(const info of verifiedBenefits){
       const pill=document.createElement('span');pill.className='offer-benefit';
       pill.textContent=info.label;pill.title=info.detail;group.append(pill);
     }
     const details=card.querySelector('.offer-role-block');
     if(details)details.after(group);else card.prepend(group);
   }
   const status=card.querySelector('.submission-evidence span');
   if(status)status.textContent=item.submission?.status||'Not verified';
   const statusRow=card.querySelector('.submission-evidence');if(statusRow)statusRow.hidden=!item.submission?.status||item.submission.status==='Not verified';
 });
}

let deskSnapshot=null;
const statusesForGroup=(status,group)=>{
 const s=String(status||'').toLowerCase();
 if(group==='sent')return /sent|acknowledg|awaiting|applied/.test(s);
 if(group==='action')return /needs|fail|bounce|delivery|draft|unfinished/.test(s);
 if(group==='assessment')return /assessment|interview|hirevue|test/.test(s);
 if(group==='rejected')return /reject/.test(s);
 return true;
};
function renderCompletionQueue(d){
 const wrap=$('completion-queue-list');if(!wrap)return;
 wrap.replaceChildren();
 const entries=Array.isArray(d.completionQueue)?d.completionQueue:[];
 for(const offer of entries){
  const article=make('article','completion-entry');
  article.dataset.completionId=String(offer.id||'');
  const head=make('div','completion-head'),about=make('div');
  about.append(make('strong',null,offer.company||'Company'),make('small',null,offer.role||''));
  const mail=offer.emailEvidence;
  const mailVerified=mail?.sourceType==='verified-employer-email'&&['applied','expired','rejected','assessment','interview','acknowledged'].includes(mail.status);
  const startLabel=mailVerified?(mail.status==='acknowledged'?'Application received · email':mail.status==='interview'?'Interview · email':mail.status==='assessment'?'Assessment · email':mail.status==='rejected'?'Not selected · email':mail.status==='expired'?'Closed · email':'Application sent · email'):offer.status==='applied-user-reported'?'Applied · user-reported':'Not yet confirmed';
  const state=make('span','status completion-status',startLabel);
  const source=make('small','completion-source',mailVerified?'Source: verified employer email · '+String(mail.verifiedAt||''):offer.status==='applied-user-reported'?'Source: user report':'Source: StagiairesMA reminder; employer application not verified');
  head.append(about,state);article.append(head,source);
  const desc=make('p','completion-warning',offer.warning||'Verify the original job listing before submitting.');
  article.append(desc);
  const links=make('div','completion-links');
  for(const item of [{url:offer.applyUrl,label:'Open application'},{url:offer.cvUrl,label:'View matching CV'},{url:offer.letterUrl,label:'Cover letter'}]){
   if(!item.url||!/^https:\/\//i.test(item.url))continue;
   const link=document.createElement('a');link.href=item.url;link.textContent=item.label==='Open application'&&(mailVerified||offer.status==='applied-user-reported')?'View listing':item.label;
   link.className=item.label==='Open application'?'btn':'secondary';link.target='_blank';link.rel='noopener noreferrer';links.append(link);
  }
  article.append(links);
  article.append(make('small','completion-listing-meta','Listing: '+(offer.platform||'external platform')+' · Checked '+(offer.discoveredAt||'unknown')));
  const control=make('div','completion-controls');
  control.textContent='Sign in with GitHub in Applications to mark Applied or Expired privately.';
  article.append(control);
  wrap.append(article);
 }
 if(!entries.length)wrap.append(make('p','muted','No external completion notices recorded yet.'));
 text('completion-queue-summary',entries.length+' recorded completion notices · '+entries.filter(x=>x.status==='applied-user-reported'||x.emailEvidence?.sourceType==='verified-employer-email').length+' with application evidence · private status controls require GitHub sign-in');
 document.dispatchEvent(new CustomEvent('pfe:completion-queue-rendered',{detail:{entries}}));
}
function renderApplicationTable(d){
 const table=$('application-table-body');table.replaceChildren();
 const q=$('app-table-search').value.toLowerCase().trim(),group=$('app-table-status').value,sort=$('app-table-sort').value;
 const rows=(Array.isArray(d.applications)?d.applications:[]).filter(a=>
  (!q||[a.company,a.role,a.channel,a.status].join(' ').toLowerCase().includes(q))&&statusesForGroup(a.status,group));
 rows.sort((a,b)=>sort==='company'?String(a.company).localeCompare(String(b.company)):sort==='oldest'?String(a.date||'').localeCompare(String(b.date||'')):String(b.date||'').localeCompare(String(a.date||'')));
 for(const a of rows){
  const tr=document.createElement('tr'),who=document.createElement('td'),company=make('strong',null,a.company||'Unknown company'),role=make('small',null,a.role||'Role not recorded');
  who.append(company,role);
  const date=make('td',null,a.date||'Unknown');
  const channel=make('td',null,a.channel||'Not recorded');
  const state=document.createElement('td'),badge=make('span','status',a.status||'Unverified');state.append(badge);
  tr.append(who,date,channel,state);table.append(tr);
 }
 if(!rows.length){const row=document.createElement('tr'),cell=make('td',null,'No matching recorded applications.');cell.colSpan=4;row.append(cell);table.append(row)}
 text('app-table-count',rows.length+' of '+(d.applications||[]).length+' recorded entries · not a complete employer receipt count');
}
['app-table-search','app-table-status','app-table-sort'].forEach(id=>$(id)?.addEventListener('input',()=>{if(deskSnapshot)renderApplicationTable(deskSnapshot)}));
function renderDeskSections(d){
 deskSnapshot=d;
 renderApplicationTable(d);
 const records=Array.isArray(d.applications)?d.applications:[];
 const list=$('activity-feed');list.replaceChildren();
 const sorted=[...records].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 for(const item of sorted.slice(0,12)){
  const entry=make('div','desk-item');
  entry.append(make('strong',null,(item.company||'Unknown')+' · '+(item.status||'Unverified')));
  entry.append(make('small',null,[item.date,item.role,item.channel].filter(Boolean).join(' · ')));
  list.append(entry);
 }
 if(!list.children.length)list.append(make('p','muted','No documented application activity yet.'));
 const deadline=$('deadline-list');deadline.replaceChildren();
 const dated=(d.mainOfferRegistry||[]).filter(x=>x.verifiedDeadline&&/^\d{4}-\d{2}-\d{2}$/.test(x.verifiedDeadline)).sort((a,b)=>a.verifiedDeadline.localeCompare(b.verifiedDeadline));
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=type=>parts.find(p=>p.type===type)?.value||'00';
 const today=part('year')+'-'+part('month')+'-'+part('day');
 for(const item of dated){
  const overdue=item.verifiedDeadline<today,soon=item.verifiedDeadline>=today;
  const entry=make('div','desk-item '+(overdue?'is-overdue':soon?'is-upcoming':''));
  entry.append(make('strong',null,item.company+' · '+item.title));
  entry.append(make('small',null,'Verified listing deadline: '+item.verifiedDeadline+(overdue?' · passed':' · upcoming')));
  if(item.url&&/^https:\/\//i.test(item.url)){const link=make('a',null,'Original posting');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';entry.append(link)}
  deadline.append(entry);
 }
 const assessment=(d.priority||[]).filter(x=>x.kind==='assessment'&&x.date);
 for(const item of assessment){
  const entry=make('div','desk-item');
  entry.append(make('strong',null,item.company+' · assessment action'));
  entry.append(make('small',null,item.date+' · '+(item.certainty||'Check original invitation')+' · '+item.task));
  deadline.append(entry);
 }
 if(!deadline.children.length)deadline.append(make('p','muted','No verified dates available.'));
 const funnel=$('funnel-chart');funnel.replaceChildren();
 const unique=new Set(records.map(x=>[x.company,x.role].map(v=>String(v||'').toLowerCase().trim()).join('|'))).size;
 const sent=records.filter(x=>statusesForGroup(x.status,'sent')).length;
 const waiting=records.filter(x=>/sent|acknowledg|awaiting/i.test(x.status||'')).length;
 const assessments=records.filter(x=>/assessment|interview/i.test(x.status||'')).length;
 const rejected=records.filter(x=>/reject/i.test(x.status||'')).length;
 const series=[['Recorded entries',unique],['Sent / acknowledged',sent],['Awaiting response',waiting],['Assessment / interview',assessments],['Rejected',rejected]];
 const max=Math.max(1,...series.map(x=>x[1]));
 for(const [name,val] of series){
  const line=make('div','funnel-row'),label=make('span',null,name),track=make('div','track'),fill=make('div','fill'),count=make('strong',null,String(val));
  fill.style.width=Math.round(val/max*100)+'%';track.append(fill);line.append(label,track,count);funnel.append(line);
 }
 const action=$('action-center');action.replaceChildren();
 const actionEntries=(d.priority||[]).slice(0,5);
 for(const item of actionEntries){
  const line=make('div','desk-item');
  line.append(make('strong',null,item.company+' · '+item.task));
  line.append(make('small',null,[item.date,item.certainty,item.reason].filter(Boolean).join(' · ')));
  action.append(line);
 }
 if(!actionEntries.length)action.append(make('p','muted','No prioritized actions recorded in this snapshot.'));
 const cv=$('cv-variant-list');cv.replaceChildren();
 const variants=(d.mainOfferRegistry||[]).filter(o=>o.tailoredCvUrl||o.tailoredCvDraftUrl);
 for(const item of variants){
  const el=make('div','desk-item'),link=make('a',null,'View '+(item.tailoredCvUrl?'application-ready copy':'prepared draft'));
  const uri=item.tailoredCvUrl||item.tailoredCvDraftUrl;link.href=uri;link.target='_blank';link.rel='noopener noreferrer';
  el.append(make('strong',null,item.company+' · '+(item.role||item.title)));
  el.append(make('small',null,item.tailoredCvStatus||'A company-specific copy exists; submission not verified.'));
  el.append(link);cv.append(el);
 }
 if(!variants.length)cv.append(make('p','muted','No company-specific CV copies in the verified registry.'));
 const auto=$('automation-monitor-list');auto.replaceChildren();
 const tasks=d.automationMonitor?.tasks||[];
 for(const item of tasks){
  const entry=make('div','desk-item'),line=item.title+' · '+(item.enabled?'Enabled':'Paused');
  entry.append(make('strong',null,line));
  entry.append(make('small',null,item.scheduleLabel+' · Last observed run: '+(item.lastObservedRun||'None verified')));
  auto.append(entry);
 }
 if(!tasks.length)auto.append(make('p','muted','Run metadata has not been checked.'));
 const checked=d.automationMonitor?.inspectedAt;
 if(checked)auto.append(make('p','muted','Task metadata inspected at '+checked+'. The live scheduler may have newer information.'));
 if(d.calendarAudit?.checkedAt){text('calendar-check-note','Google Calendar reviewed '+d.calendarAudit.checkedAt+' · '+d.calendarAudit.note)}
}
async function load(){text('audit','Loading verified shared snapshot…');
try{const resp=await fetch('./shared-state.json?t='+Date.now(),{cache:'no-store'});if(!resp.ok)throw Error('HTTP '+resp.status);const d=await resp.json();if(!d||!d.metrics||!Array.isArray(d.applications))throw Error('Invalid data');
const m=d.metrics;text('k-sent',m.emailSentMessages);text('k-last',m.newlySent);text('k-replies',m.confirmedAssessments);text('k-responses',m.verifiedUniqueEmployerReplies);text('k-unfinished',m.unfinishedSubmissions);text('k-rejections',m.confirmedRejectionMessages);text('k-bounces',m.identifiedBounceReports);
text('audit','Gmail verified on '+clean(d.updatedAt)+'. '+clean(m.emailSentScope)+' Acknowledgments and automatic confirmations are not counted as genuine recruiter replies. These figures are a verified subset, not a complete response-rate calculation.');
text('snapshot-date',d.updatedAt);const synced=d.lastSyncedAt?new Date(d.lastSyncedAt):null;if(synced&&Number.isFinite(synced.getTime())){let stamp;try{stamp=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:d.syncTimezone||'Africa/Casablanca'}).format(synced)}catch{stamp=synced.toISOString()}text('last-sync-time',stamp+' · '+humanAge(Date.now()-synced.getTime()))}else{text('last-sync-time','Not yet synced')}showGmailFreshness(d);showSources(d);showVerifiedOfferTitles(d);showApplicationMethods(d);makeMaya(d);renderDeskSections(d);renderCompletionQueue(d);filter();
const ps=$('priority-list');ps.replaceChildren();(d.priority||[]).forEach(a=>{const row=make('div','priority'),rank=make('div','rank',a.rank),info=make('div'),title=make('strong',null,a.company+' · '+a.task),desc=make('small',null,a.reason);info.append(title,desc);if(a.date)info.append(make('div','when',a.date+' · '+a.certainty));else if(a.certainty)info.append(make('small','muted',a.certainty));const links=Array.isArray(a.actionLinks)?a.actionLinks:(a.actionUrl?[{label:a.actionLabel||'Open action',url:a.actionUrl}]:[]);if(links.length){const actions=make('div','priority-links');for(const item of links){if(!item||!item.url)continue;let target;try{target=new URL(item.url);if(!['https:','http:'].includes(target.protocol))continue}catch{continue}const anchor=make('a','priority-action-link',item.label||'Open action ↗');anchor.href=target.href;anchor.target='_blank';anchor.rel='noopener noreferrer';actions.append(anchor)}if(actions.childNodes.length)info.append(actions)}row.append(rank,info);ps.append(row)});
const target=$('company-list');target.replaceChildren();const rows=[...d.applications].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));rows.slice(0,28).forEach(a=>{const r=make('div','status-row'),info=make('div'),name=make('strong',null,a.company),desc=make('small',null,[a.role,a.channel,a.date].filter(Boolean).join(' · ')),stat=make('span','status',a.status);info.append(name,desc);r.append(info,stat);target.append(r)});
const p=d.followUpPolicy||{};text('followup-text',p.recommendation||'Prioritize urgent assessments, incomplete submissions and relevant offers before follow-up emails.');
}catch(e){text('audit','Shared snapshot unavailable: '+clean(e.message)+'. Try again later. No private local state is required.');text('priority-list','Shared data currently unavailable.');text('company-list','Shared data currently unavailable.');text('maya-status','Shared backup data unavailable; last published data could not be loaded.');text('gmail-last-verified','Not yet verified');text('gmail-stale-warning','Could not load verification metadata');text('sources-list','Source audit unavailable.');text('last-sync-time','Sync time unavailable')}
}
load();
})();
