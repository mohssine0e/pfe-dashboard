
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,GithubAuthProvider,signInWithPopup,onAuthStateChanged,signOut,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,getDoc,collection,onSnapshot,setDoc,deleteDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config={
  apiKey:'AIzaSyDPW8FELdI5M8dSInZbFAYECwv9ouxpTfY',
  authDomain:'pfe-dashboard-169c9.firebaseapp.com',
  projectId:'pfe-dashboard-169c9',
  appId:'1:972061652457:web:75508aeea582bb758e8778'
};
const app=initializeApp(config);
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const login=$('auth-login'),logout=$('auth-logout'),uidRow=$('auth-uid-row'),uidText=$('auth-id'),status=$('auth-status');
const cards=[...document.querySelectorAll('.offer')];
const panels=new Map(),completionPanels=new Map();
let privateStatusSnapshot=new Map(),completionQueueEntries=[];
let unsubscribe=null,authSequence=0,adminReady=false;

const localDate=()=>{
  const now=new Date();
  const year=now.getFullYear(),month=String(now.getMonth()+1).padStart(2,'0'),day=String(now.getDate()).padStart(2,'0');
  return year+'-'+month+'-'+day;
};
async function offerKey(offer) {
  // A stable key based on the actual posting URL, not the card's position.
  const bytes=new TextEncoder().encode(String(offer.url||'').trim());
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function make(tag,cls,text){
  const element=document.createElement(tag);
  if(cls)element.className=cls;
  if(text!==undefined)element.textContent=text;
  return element;
}
function removeControls(){
  adminReady=false;
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  for(const panel of panels.values())panel.root.remove();
  panels.clear();
  for(const panel of completionPanels.values())panel.root.replaceChildren();
  completionPanels.clear();
  privateStatusSnapshot=new Map();
  syncManualTasks();
  for(const card of cards){
    delete card.dataset.applied;
    delete card.dataset.expired;
    delete card.dataset.applicationLoaded;
    card.classList.remove('offer-is-applied','offer-is-expired');
  }
  const privateSection=$('private-records-section');
  if(privateSection){privateSection.hidden=true;$('private-records-list').replaceChildren();}
  document.dispatchEvent(new Event('pfe:application-statuses-updated'));
}
async function buildPanel(card,offer,key,sequence){
 if(sequence!==authSequence||!adminReady)return;
 const root=make('div','admin-offer-panel');
 root.setAttribute('aria-label','Private application status');
 const makeToggle=(type,labelText)=>{
   const label=make('label',type+'-toggle status-toggle');
   const input=make('input','applied-check');
   input.type='checkbox';
   input.setAttribute('aria-label','Mark '+String(offer.company||'this offer')+' as '+type);
   const visual=make('span','applied-check-visual');visual.setAttribute('aria-hidden','true');
   const caption=make('span','applied-check-label',labelText);
   label.append(input,visual,caption);
   return {label,input,caption};
 };
 const applied=makeToggle('applied','Mark as applied');
 const expired=makeToggle('expired','Mark as expired');
 const group=make('div','offer-status-toggles');
 group.append(applied.label,expired.label);
 const feedback=make('span','admin-feedback','');
 feedback.setAttribute('role','status');
 root.append(group,feedback);
 (card.querySelector('.offer-footer')||card).append(root);
 const panel={root,applied,expired,feedback,offer,key,state:'open'};
 panels.set(key,panel);
 const change=async(target)=>{
   if(!adminReady||sequence!==authSequence||!auth.currentUser){
     applied.input.checked=panel.state==='applied';expired.input.checked=panel.state==='expired';return;
   }
   const next=target.input.checked?(target===applied?'applied':'expired'):'open';
   if(next==='open'&&!window.confirm('Clear this manually recorded status?')){
     applied.input.checked=panel.state==='applied';expired.input.checked=panel.state==='expired';return;
   }
   applied.input.disabled=true;expired.input.disabled=true;
   feedback.textContent='Saving…';
   try{
     const metadata={
       postingUrl:String(offer.url||''),
       company:String(offer.company||''),
       role:String(offer.role||offer.title||''),
       status:next,
       updatedAt:serverTimestamp()
     };
     if(next==='applied')Object.assign(metadata,{
       submittedOn:localDate(),expiredOn:null,
       evidence:'self-report',
       evidenceSource:'User manually marked as applied; platform confirmation not independently checked'
     });
     if(next==='expired')Object.assign(metadata,{
       expiredOn:localDate(),submittedOn:null,
       evidence:'user-marked-expired',
       evidenceSource:'User manually marked listing expired; original deadline not independently verified'
     });
     if(next==='open')Object.assign(metadata,{
       expiredOn:null,submittedOn:null,evidence:'manual-reset',evidenceSource:'User cleared status'
     });
     // Merge keeps any existing private notes when switching or clearing statuses.
     await setDoc(doc(db,'privateApplications',key),metadata,{merge:true});
     feedback.textContent='';
   }catch(error){
     applied.input.checked=panel.state==='applied';expired.input.checked=panel.state==='expired';
     feedback.textContent='Save failed: '+(error.code||'unknown');
   }finally{applied.input.disabled=false;expired.input.disabled=false;}
 };
 applied.input.addEventListener('change',()=>change(applied));
 expired.input.addEventListener('change',()=>change(expired));
}
async function buildCompletionControls(entries,sequence){
 if(!adminReady||sequence!==authSequence||!auth.currentUser)return;
 completionQueueEntries=Array.isArray(entries)?entries:[];
 for(const offer of completionQueueEntries){
  const card=[...document.querySelectorAll('.completion-entry')].find(x=>x.dataset.completionId===String(offer.id||''));
  if(!card||!offer.applyUrl||!/^https:\/\//.test(offer.applyUrl))continue;
  const key=await offerKey({url:offer.originalListingUrl||offer.applyUrl});
  if(sequence!==authSequence||!adminReady)return;
  const root=card.querySelector('.completion-controls');if(!root||completionPanels.has(key))continue;
  root.replaceChildren();
  const makeToggle=(type,labelText)=>{
   const label=make('label',type+'-toggle status-toggle');
   const input=make('input','applied-check');input.type='checkbox';
   input.setAttribute('aria-label','Mark '+offer.company+' '+offer.role+' as '+type);
   const visual=make('span','applied-check-visual');visual.setAttribute('aria-hidden','true');
   const caption=make('span','applied-check-label',labelText);
   label.append(input,visual,caption);return {label,input,caption};
  };
  const applied=makeToggle('applied','Applied'),expired=makeToggle('expired','Expired');
  const group=make('div','offer-status-toggles'),feedback=make('span','admin-feedback','');
  group.append(applied.label,expired.label);feedback.setAttribute('role','status');
  root.append(group,feedback);
  const panel={root,applied,expired,feedback,offer,key,state:'open',card};
  completionPanels.set(key,panel);
  const change=async(target)=>{
   if(!adminReady||sequence!==authSequence||!auth.currentUser)return;
   const evidence=offer.emailEvidence;
   if(evidence?.sourceType==='verified-employer-email'){renderCompletionStatuses(privateStatusSnapshot);return;}
   const next=target.input.checked?(target===applied?'applied':'expired'):'open';
   if(next==='open'&&!window.confirm('Clear this manually recorded completion status?')){renderCompletionStatuses(privateStatusSnapshot);return;}
   applied.input.disabled=true;expired.input.disabled=true;feedback.textContent='Saving privately…';
   try{
    const metadata={postingUrl:String(offer.originalListingUrl||offer.applyUrl),company:String(offer.company||''),role:String(offer.role||''),status:next,evidence:next==='applied'?'self-report':next==='expired'?'user-marked-expired':'manual-reset',evidenceSource:next==='applied'?'Manually marked applied; no employer confirmation':'Manual status, not email-verified',submittedOn:next==='applied'?localDate():null,expiredOn:next==='expired'?localDate():null,updatedAt:serverTimestamp()};
    await setDoc(doc(db,'privateApplications',key),metadata,{merge:true});
    feedback.textContent='Saved to your private tracking';
   }catch(error){feedback.textContent='Save failed: '+(error.code||'unknown');renderCompletionStatuses(privateStatusSnapshot);}
   finally{applied.input.disabled=false;expired.input.disabled=false;}
  };
  applied.input.addEventListener('change',()=>change(applied));
  expired.input.addEventListener('change',()=>change(expired));
 }
 renderCompletionStatuses(privateStatusSnapshot);
}
function renderCompletionStatuses(snapshot){
 for(const panel of completionPanels.values()){
  const record=snapshot.get(panel.key),offer=panel.offer;
  const email=offer.emailEvidence;
  const verified=email?.sourceType==='verified-employer-email'&&['applied','expired','rejected','assessment','interview','acknowledged'].includes(email.status);
  const privateStatus=record?.status==='applied'?'applied':record?.status==='expired'?'expired':'open';
  const userStatus=offer.status==='applied-user-reported'?'applied':'open';
  const effective=verified?(email.status==='expired'?'expired':email.status==='rejected'?'open':'applied'):(privateStatus!=='open'?privateStatus:userStatus);
  const label=verified?(email.status==='acknowledged'?'Application received · email':email.status==='interview'?'Interview scheduled · email':email.status==='assessment'?'Assessment · email':email.status==='rejected'?'Not selected · email':email.status==='expired'?'Listing closed · email':'Application sent · email'):privateStatus!=='open'?(privateStatus==='applied'?'Applied · manual':'Expired · manual'):userStatus==='applied'?'Applied · user-reported':'Not yet confirmed';
  panel.state=effective;
  panel.applied.input.checked=effective==='applied';panel.expired.input.checked=effective==='expired';
  panel.applied.input.disabled=verified;panel.expired.input.disabled=verified;
  panel.applied.caption.textContent='Applied';
  panel.expired.caption.textContent='Expired';
  const badge=panel.card.querySelector('.completion-status');if(badge)badge.textContent=label;
  const source=panel.card.querySelector('.completion-source');
  if(source)source.textContent=verified?'Source: verified employer email · '+String(email.verifiedAt||''):privateStatus!=='open'?'Source: private manual mark':userStatus==='applied'?'Source: user-reported completion':'Source: StagiairesMA reminder only';
  panel.card.classList.toggle('offer-is-applied',effective==='applied');
  panel.card.classList.toggle('offer-is-expired',effective==='expired');
  if(verified)panel.feedback.textContent='Employer email confirmed this stage. Manual history and notes remain private.';
  else if(panel.feedback.textContent.startsWith('Verified email'))panel.feedback.textContent='';
 }
}
document.addEventListener('pfe:completion-queue-rendered',event=>{
 completionQueueEntries=event.detail?.entries||[];
 if(adminReady)buildCompletionControls(completionQueueEntries,authSequence).catch(()=>{});
});
function renderPrivateRecords(snapshot){
 const root=$('private-records-list'),section=$('private-records-section');
 if(!root||!section)return;
 section.hidden=false;root.replaceChildren();
 const rows=[];
 snapshot.forEach(docSnap=>{const info=docSnap.data();if(info&&(info.status==='applied'||info.status==='expired'))rows.push({key:docSnap.id,...info})});
 rows.sort((a,b)=>String(b.submittedOn||b.expiredOn||'').localeCompare(String(a.submittedOn||a.expiredOn||'')));
 for(const record of rows){
   const el=make('div','private-record'),top=make('strong',null,(record.company||'Unknown')+' · '+(record.role||'PFE application'));
   el.append(top,make('small',null,(record.status==='expired'?'User-marked expired · '+(record.expiredOn||'Date not recorded'):'User-marked applied · '+(record.submittedOn||'Date not recorded'))));
   if(record.postingUrl&&/^https:\/\//i.test(record.postingUrl)){
     const link=make('a',null,'Original listing');link.href=record.postingUrl;link.target='_blank';link.rel='noopener noreferrer';el.append(link);
   }
   const details=document.createElement('details'),summary=make('summary',null,'Private notes');
   const area=document.createElement('textarea');area.value=String(record.notes||'').slice(0,500);area.maxLength=500;area.setAttribute('aria-label','Private note for '+(record.company||'application'));
   const save=make('button',null,'Save note');save.type='button';
   const noteStatus=make('span','notes-feedback','');
   save.addEventListener('click',async()=>{
     if(!adminReady||!auth.currentUser)return;
     save.disabled=true;noteStatus.textContent='Saving…';
     try{await setDoc(doc(db,'privateApplications',record.key),{notes:area.value.slice(0,500),notesUpdatedAt:serverTimestamp()},{merge:true});noteStatus.textContent='Saved privately';}
     catch(e){noteStatus.textContent='Could not save: '+(e.code||'unknown');}
     finally{save.disabled=false;}
   });
   details.append(summary,area,save,noteStatus);el.append(details);root.append(el);
 }
 if(!rows.length)root.append(make('p','muted','No manually marked applied or expired offers yet.'));
}

/* User-controlled task state: stored in the existing privateApplications collection,
   behind the same authorized GitHub/Firebase account as application checkboxes. */
function syncManualTasks(){
 const controls=[...document.querySelectorAll('.manual-task')];
 for(const row of controls){
  const input=row.querySelector('.task-manual-control input');
  if(!input)continue;
  const taskId=String(row.dataset.taskId||'');
  if(!taskId)continue;
  const key='task-'+encodeURIComponent(taskId).slice(0,800);
  const record=privateStatusSnapshot.get(key);
  const complete=record?.taskCompleted===true;
  input.checked=complete;
  input.disabled=!adminReady||!auth.currentUser;
  row.classList.toggle('task-is-complete',complete);
  const label=row.querySelector('.task-manual-control span');
  if(label)label.textContent=complete?'Completed':'Mark done';
  if(input.dataset.bound==='true')continue;
  input.dataset.bound='true';
  input.addEventListener('change',async()=>{
   if(!adminReady||!auth.currentUser){syncManualTasks();return;}
   const next=input.checked;
   input.disabled=true;
   const feedback=make('span','admin-feedback','Saving privately…');
   row.append(feedback);
   try{
    await setDoc(doc(db,'privateApplications',key),{
      type:'manual-task',taskId,taskCompleted:next,
      status:'task',evidence:'self-report',
      evidenceSource:'User manually toggled task status',
      completedOn:next?localDate():null,updatedAt:serverTimestamp()
    },{merge:true});
    feedback.textContent='Saved';
   }catch(error){
    input.checked=!next;
    feedback.textContent='Could not save: '+(error.code||'unknown');
   }finally{input.disabled=false;setTimeout(()=>feedback.remove(),3000);}
  });
 }
}
document.addEventListener('pfe:tasks-rendered',syncManualTasks);

function renderSaved(snapshot){
 privateStatusSnapshot=snapshot;
 syncManualTasks();
 renderCompletionStatuses(snapshot);
 for(const panel of panels.values()){
   const data=snapshot.get(panel.key);
   panel.state=data?.status==='applied'?'applied':data?.status==='expired'?'expired':'open';
   const card=panel.root.closest('.offer');
   const isApplied=panel.state==='applied',isExpired=panel.state==='expired';
   card.dataset.applied=isApplied?'true':'false';
   card.dataset.expired=isExpired?'true':'false';
   card.dataset.applicationLoaded='true';
   card.classList.toggle('offer-is-applied',(isApplied||card.dataset.confirmedEmailSent==='true')&&!isExpired);
   card.classList.toggle('offer-is-expired',isExpired);
   panel.applied.input.checked=isApplied;
   panel.expired.input.checked=isExpired;
   panel.applied.caption.textContent=card.dataset.confirmedEmailSent==='true'?(card.dataset.publicApplicationEvidence==='user-reported-submission'?'Applied · user-reported':panel.offer.applicationMethod==='formThenEmail'?'Applied · form + email':'Applied via email'):isApplied?'Applied':'Mark as applied';
   panel.applied.input.disabled=card.dataset.confirmedEmailSent==='true';
   panel.applied.input.checked=isApplied||card.dataset.confirmedEmailSent==='true';
   panel.expired.caption.textContent=isExpired?'Expired':'Mark as expired';
   panel.applied.label.title=card.dataset.confirmedEmailSent==='true'?(card.dataset.publicApplicationEvidence==='user-reported-submission'?'LinkedIn submission reported by user; platform receipt not independently verified':'Sent via connected Gmail; this cannot be unsent'):isApplied?'Uncheck to clear applied status':'Manually record application completion';
   panel.expired.label.title=isExpired?'Uncheck to clear expired status':'Manually record the listing as expired (not source-verified)';
   panel.feedback.textContent=isApplied?(data?.submittedOn?'· '+data.submittedOn:''):isExpired?(data?.expiredOn?'· '+data.expiredOn:''):'';
   const publicStatus=card.querySelector('.submission-evidence');
   if(publicStatus)publicStatus.hidden=isApplied||isExpired||publicStatus.textContent.includes('Not verified');
 }
 document.dispatchEvent(new Event('pfe:application-statuses-updated'));
}
async function authorizeAndLoad(user,sequence){
  status.textContent='Checking private Firestore permissions…';
  try{
    // The document need not exist: successful get means rules authorize this UID.
    await getDoc(doc(db,'privateApplications','admin-access-probe'));
    if(sequence!==authSequence||auth.currentUser?.uid!==user.uid)return;
    const resp=await fetch('./shared-state.json',{cache:'no-store'});
    if(!resp.ok)throw new Error('Cannot load offer metadata');
    const state=await resp.json();
    if(!Array.isArray(state.mainOfferRegistry))throw new Error('Offer list unavailable');
    adminReady=true;
    syncManualTasks();
    status.textContent='Private admin verified. Application statuses are visible only to your account.';
    const offers=state.mainOfferRegistry;
    for(let index=0;index<Math.min(cards.length,offers.length);index++){
      const offer=offers[index];
      if(!offer.url)continue;
      const key=await offerKey(offer);
      await buildPanel(cards[index],offer,key,sequence);
    }
    await buildCompletionControls(state.completionQueue||completionQueueEntries,sequence);
    if(sequence!==authSequence||!adminReady)return;
    unsubscribe=onSnapshot(collection(db,'privateApplications'),snap=>{
      if(sequence!==authSequence||!adminReady)return;
      const rows=new Map();
      snap.forEach(doc=>rows.set(doc.id,doc.data()));
      renderSaved(rows);
      renderPrivateRecords(snap);
    },error=>{
      removeControls();
      status.textContent='Private tracking unavailable: '+(error.code||'database access error')+'. Check published Firestore rules.';
    });
  }catch(error){
    if(sequence!==authSequence)return;
    removeControls();
    status.textContent=error.code==='permission-denied'
      ?'Signed in, but this account is not authorized in Firestore. Verify that your UID matches the published Rules.'
      :'Private tracking is locked: '+(error.code||error.message||'unexpected error');
  }
}
try{
  await setPersistence(auth,browserLocalPersistence);
  onAuthStateChanged(auth,user=>{
    const sequence=++authSequence;
    removeControls();
    login.hidden=Boolean(user);logout.hidden=!user;uidRow.hidden=!user;
    if(user){
      uidText.textContent=user.uid;
      authorizeAndLoad(user,sequence);
    }else{
      uidText.textContent='';
      status.textContent='Signed out. Public dashboard is read-only.';
    }
  },error=>{removeControls();status.textContent='Authentication error: '+(error.code||'unknown')});
  login.addEventListener('click',async()=>{
    login.disabled=true;status.textContent='Opening GitHub sign-in…';
    try{await signInWithPopup(auth,new GithubAuthProvider())}
    catch(error){status.textContent='Sign-in failed: '+(error.code||'unknown')}
    finally{login.disabled=false}
  });
  logout.addEventListener('click',async()=>{
    try{await signOut(auth)}catch(error){status.textContent='Sign-out failed: '+(error.code||'unknown')}
  });
  $('auth-copy').addEventListener('click',async()=>{
    if(!auth.currentUser)return;
    try{await navigator.clipboard.writeText(auth.currentUser.uid);$('auth-copy').textContent='UID copied'}
    catch{status.textContent='Clipboard unavailable. Select the displayed UID to copy it.'}
  });
}catch(error){
  status.textContent='Firebase initialization failed. Check your network and Firebase configuration.';
}
