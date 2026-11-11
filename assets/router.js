
/* PFE Desk v4: six purpose-built routes. Existing DOM nodes and listeners remain intact. */
(()=>{
  'use strict';
  const main=document.querySelector('main'),header=main.querySelector('header');
  const nav=document.createElement('nav');
  nav.className='site-nav';
  nav.setAttribute('aria-label','Dashboard pages');
  const specs=[
    ['overview','Home','⌂','Your next actions, priorities and progress.'],
    ['opportunities','Opportunities','⌕','Explore roles, filter by fit and inspect verified details.'],
    ['applications','Applications','✓','Follow submitted applications and assessments.'],
    ['tasks','Tasks','◷','Finish pending steps and monitor deadlines.'],
    ['cvs','CV Library','▤','Approved CVs and platform profiles.'],
    ['monitoring','Settings & Audit','⚙','Review sync freshness, sources and account access.']
  ];
  const pages=new Map();
  const navigation=new Map();
  for(const [id,label,icon,desc] of specs){
    const link=document.createElement('a');
    link.href='#/'+id;link.dataset.route=id;
    const symbol=document.createElement('span');symbol.className='nav-icon';symbol.setAttribute('aria-hidden','true');symbol.textContent=icon;
    const name=document.createElement('span');name.textContent=label;link.append(symbol,name);
    nav.append(link);navigation.set(id,link);
    const page=document.createElement('div');page.id='view-'+id;page.className='page-panel';page.hidden=id!=='overview';
    page.setAttribute('aria-label',label+' page');
    const title=document.createElement('div');title.className='page-heading';
    const heading=document.createElement('h2');heading.textContent=label;
    const subtitle=document.createElement('p');subtitle.textContent=desc;
    title.append(heading,subtitle);page.append(title);pages.set(id,page);
  }
  header.after(nav);
  const footer=main.querySelector('footer');
  for(const page of pages.values())main.insertBefore(page,footer);
  function move(id,destination){const node=document.getElementById(id);if(node)pages.get(destination).append(node)}
  function moveSelector(selector,destination){const node=main.querySelector(selector);if(node)pages.get(destination).append(node)}
  move('overview','overview');
  move('priorities','overview');
  move('action-center-section','overview');
  move('analytics-section','overview');
  move('opportunities','opportunities');
  move('private-auth','monitoring');
  move('private-records-section','applications');
  move('pipeline','applications');
  move('application-table-section','applications');
  move('activity-feed-section','applications');
  move('deadlines-section','tasks');
  move('followups','tasks');
  move('prep','tasks');
  const completionSection=document.createElement('section');
  completionSection.id='completion-queue-section';
  completionSection.innerHTML='<h2>Finish external applications</h2><p class="muted">StagiairesMA completion notices are intermediary reminders, not confirmation of employer submissions. Open the original listing, use the role-specific CV, and confirm final submission on the employer or job platform.</p><div id="completion-queue-list" class="completion-queue-list"><p>Loading application completion links…</p></div><p id="completion-queue-summary" class="muted"></p>';
  pages.get('tasks').insertBefore(completionSection,pages.get('tasks').children[1]||null);
  move('cv-library','cvs');
  move('platform-cv-profiles','cvs');
  move('cv-variants-section','cvs');
  moveSelector('.freshness','monitoring');
  move('sources-audit','monitoring');
  move('maya-backup','monitoring');
  move('automation-monitor-section','monitoring');
  const emptyTwo=main.querySelector('.two');if(emptyTwo&&!emptyTwo.children.length)emptyTwo.remove();
  function showRoute(){
    const segment=(location.hash.match(/^#\/?([a-z-]+)/)||[])[1];
    const route=pages.has(segment)?segment:'overview';
    for(const [key,page] of pages){
      page.hidden=key!==route;
      const link=navigation.get(key);
      if(key===route)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    document.title=(specs.find(s=>s[0]===route)?.[1]||'Overview')+' · PFE Command Center';
    document.body.classList.add('route-ready');
    window.scrollTo({top:0,behavior:'instant'});
  }
  window.addEventListener('hashchange',showRoute);
  showRoute();
})();
