import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
test('Image desk switches panels with click and keyboard without replacing unsaved fields',()=>{
 const init=source.slice(source.indexOf('function initPageImageTabs('),source.indexOf('function initPageImageAdmin('));
 const tabs=['home','ministries','contact'].map(page=>({dataset:{imagePage:page},events:{},setAttribute(k,v){this[k]=v},addEventListener(k,v){this.events[k]=v},focus(){this.focused=true}}));
 const panels=tabs.map(tab=>({dataset:{imagePanel:tab.dataset.imagePage},unsavedValue:'changed-image.jpg'}));
 const form={querySelectorAll:s=>s==='[data-image-page]'?tabs:panels};
 runInNewContext(init+';initPageImageTabs(form)',{form});
 tabs[1].events.click();assert.equal(tabs[1]['aria-selected'],'true');assert.equal(panels[1].hidden,false);assert.equal(panels[0].hidden,true);
 let prevented=false;tabs[1].events.keydown({key:'End',preventDefault(){prevented=true}});
 assert(prevented);assert(tabs[2].focused);assert.equal(panels[2].hidden,false);assert.equal(tabs[2].tabIndex,0);
 tabs[2].events.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(panels[0].hidden,false);
 assert(panels.every(panel=>panel.unsavedValue==='changed-image.jpg'));
});
test('Pastoral hierarchy includes every current profile beneath the president and grows with the team',()=>{
 const renderer=source.slice(source.indexOf('function renderPastoralCard('),source.indexOf('function renderPastorProfile('));
 const team=[{id:'senior-pastor',name:'Pr Sam John',role:'President'},...Array.from({length:10},(_,i)=>({id:`pastor-${i}`,name:`Pastor ${i}`,role:'Associate',image:'/portrait.jpg'}))];
 const env={pastors:team,escapeHtml:escape,escapeAttribute:escape,renderFooter:()=>''};
 const html=runInNewContext(renderer+';renderPastoralGallery()',env);
 const [leader,members]=html.split('data-pastoral-members');
 assert(leader.includes('Pr Sam John'));assert(!members.includes('Pr Sam John'));
 for(const p of team)assert.equal(html.split(`href="#/pastors/${p.id}"`).length-1,1);
 for(const p of team.slice(1))assert(members.includes(p.name));
 assert(!html.includes('people-poster'));
 const home=runInNewContext(renderer+";renderPastoralTeam('h3')",env);
 assert.equal((home.match(/<h3>/g)||[]).length,team.length);
 assert(source.includes("${renderPastoralTeam('h3')}"));
});
const defaults={kicker:'Newsletter',title:'News & updates from LPC',body:'',author:'',date:'',image:'',imageAlt:'',ctaText:'',ctaHref:''};
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
test('Branch visitor preview escapes draft details and contains no live navigation',()=>{
 const render=source.slice(source.indexOf('function renderBranchVisitorPreview('),source.indexOf('function initBranchVisitorPreviews('));
 const html=runInNewContext(render+';renderBranchVisitorPreview(branch)',{branch:{name:'<script>Church</script>',address:'Road\nTown',services:'Sunday 10:00',contact:'Office',color:'#123456'},escapeHtml:escape,escapeAttribute:escape});
 assert(html.includes('&lt;script>Church'));assert(html.includes('Road<br>Town'));assert(!html.includes('href='));assert(html.includes('unpublished preview'));
});
test('Hero save status preserves edits made while a submitted version publishes',()=>{
 const helpers=source.slice(source.indexOf('function heroDraftSignature('),source.indexOf('function initHeroPreviewDevices('));
 const fields={image:'original.jpg'},events={},dirty={},bar={classList:{add(){}},insertAdjacentHTML(){},querySelector:()=>dirty};
 const form={id:'hero-image-editor-form',dataset:{},querySelector:()=>bar,addEventListener:(type,fn)=>events[type]=fn};
 const f=runInNewContext(helpers+';({initHeroDraftStatus,heroDraftSignature})',{FormData:class{*[Symbol.iterator](){yield*Object.entries(fields)}}});
 f.initHeroDraftStatus(form);fields.image='submitted.jpg';events.input();assert.equal(dirty.textContent,'Unpublished changes');const snapshot=f.heroDraftSignature(form);
 fields.image='newer.jpg';events['hero-published']({detail:{snapshot}});assert.equal(dirty.textContent,'Unpublished changes');
 fields.image='submitted.jpg';events.input();assert.equal(dirty.textContent,'Saved version');
});
test('Hero publication stays in the editor and emits the submitted snapshot',async()=>{
 const init=source.slice(source.indexOf('function initHeroImageEditorAdmin()'),source.indexOf('function setAdminFormStatus('));
 let submit,event,config;const button={},status={},form={dataset:{heroKey:'about'},querySelector:s=>s.includes('status')?status:button,addEventListener:(_type,fn)=>submit=fn,dispatchEvent:e=>event=e};
 runInNewContext(init+';initHeroImageEditorAdmin()',{document:{getElementById:()=>form},FormData:class{get(k){return k==='desktopImage'?'original.jpg':''}},heroImageDefaults:{about:{}},heroDraftSignature:()=> 'submitted',focusNumberToPosition:String,scaleNumberToValue:String,normalizeFitMode:String,heroLabel:()=> 'About',saveHeroImagesConfig:async c=>config=c,setAdminFormStatus:(_target,state)=>status.state=state,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
 await submit({preventDefault(){}});assert.equal(config.about.desktopImage,'original.jpg');assert.equal(event.type,'hero-published');assert.equal(event.detail.snapshot,'submitted');assert.equal(status.state,'success');assert.equal(button.disabled,false);
});
test('Video inspection uses controlled playback without image framing controls',()=>{
 const inspector=source.slice(source.indexOf('function openMediaInspector('),source.indexOf('async function renderManagedAssets('));
 const close={addEventListener(){}},dialog={setAttribute(){},showModal(){this.open=true},addEventListener(){},querySelectorAll:()=>[],querySelector:s=>s==='[data-media-close]'?close:null};
 runInNewContext(inspector+';openMediaInspector({},"video",{},asset,{})',{asset:{name:'service.mp4',path:'/service.mp4',size:1024},document:{createElement:()=>dialog,body:{style:{},append(){}}},escapeHtml:escape,escapeAttribute:escape,formatAssetSize:()=> '1 KB',renderAssetProtectionActions:()=>'',renderMediaReferences:()=>''});
 assert(dialog.innerHTML.includes('<video'));assert(dialog.innerHTML.includes('controls playsinline'));assert(!dialog.innerHTML.includes('data-media-frame'));assert(dialog.open);
});
test('Newsletter checks separate required text and paired links from a suggested image description',()=>{
 const helper=source.slice(source.indexOf('function newsletterReview('),source.indexOf('function renderNewsletterChecklist('));
 const review=runInNewContext(helper+';newsletterReview');
 const result=review({title:'News',body:'A short update',image:'poster.jpg',imageAlt:'',ctaText:'Read more',ctaHref:''});
 assert.equal(result.words,3);assert.equal(result.checks.find(c=>c.label.includes('paired')).ok,false);assert.equal(result.checks.find(c=>c.optional).ok,false);
 assert(review({title:'News',body:'Text only'}).checks.every(c=>c.ok));
});
test('Header studio updates phone preview and keeps later edits marked unpublished after a save',()=>{
 const init=source.slice(source.indexOf('function initHeaderMessageStudio('),source.indexOf('function newsletterReview('));
 const events={},input={value:'Original',addEventListener:(type,fn)=>events[type]=fn},preview={dataset:{}},text={},dirty={},counter={};
 const buttons=['desktop','phone'].map(device=>({dataset:{headerDevice:device},setAttribute(k,v){this[k]=v},addEventListener:(_t,fn)=>events[device]=fn}));
 const form={querySelector:s=>s.includes('name=')?input:s==='[data-header-preview]'?preview:s.includes('preview-text')?text:s.includes('dirty')?dirty:counter,querySelectorAll:()=>buttons,addEventListener:(type,fn)=>events[type]=fn};
 runInNewContext(init+';initHeaderMessageStudio(form)',{form,defaultSiteSettingsConfig:{topbarSlogan:'Default'}});
 input.value='<script>plain text</script>';events.input();assert.equal(text.textContent,input.value);assert.equal(dirty.textContent,'Unpublished changes');
 events.phone();assert.equal(preview.dataset.device,'phone');assert.equal(buttons[1]['aria-pressed'],'true');
 events['header-published']({detail:{topbarSlogan:'Older submission'}});assert.equal(dirty.textContent,'Unpublished changes');
 events['header-published']({detail:{topbarSlogan:input.value}});assert.equal(dirty.textContent,'Saved version');
});
test('A failed header publish leaves the last saved configuration intact',async()=>{
 const save=source.slice(source.indexOf('async function saveSiteSettingsConfig('),source.indexOf('async function hydrateYouTubePlayers('));let fail=true,applied=0;
 const f=runInNewContext(save+';({saveSiteSettingsConfig,current:()=>siteSettingsConfig})',{siteSettingsConfig:{topbarSlogan:'Original'},fetch:async()=>({ok:!fail,json:async()=>({topbarSlogan:'Published'})}),applySiteSettings:()=>applied++});
 await assert.rejects(f.saveSiteSettingsConfig({topbarSlogan:'Draft'}));assert.equal(f.current().topbarSlogan,'Original');assert.equal(applied,0);
 fail=false;await f.saveSiteSettingsConfig({topbarSlogan:'Published'});assert.equal(f.current().topbarSlogan,'Published');assert.equal(applied,1);
});
test('Branch completion queue filters missing details while retaining open draft fields',()=>{
 const init=source.slice(source.indexOf('function initBranchCompletionQueue('),source.indexOf('function refreshBranchReadiness('));
 const callbacks={},search={value:'',addEventListener:(t,fn)=>callbacks.search=fn},toggle={checked:false,addEventListener:(t,fn)=>callbacks.toggle=fn},count={},empty={};
 const row=(name,address,services)=>({open:false,fields:{name,churchName:name,address,services},querySelector(s){return {value:this.fields[s.match(/name="(.*?)"/)[1]]}}});
 const rows=[row('Ready','Road','Sunday'),row('Missing','','Sunday')];
 const form={querySelector:s=>s.includes('query')?search:s.includes('filter')?toggle:s.includes('count')?count:empty,querySelectorAll:()=>rows,addEventListener:(t,fn)=>callbacks[t]=fn};
 runInNewContext(init+';initBranchCompletionQueue(form)',{form,branchVisitGaps:b=>!b.address||!b.services?['Missing']:[],queueMicrotask:fn=>fn()});
 toggle.checked=true;callbacks.toggle();assert(rows[0].hidden);assert(!rows[1].hidden);assert(count.textContent.includes('1 need'));
 rows[1].open=true;rows[1].fields.address='Draft road';callbacks.input();assert(!rows[1].hidden);assert(count.textContent.includes('0 need'));
 rows[1].open=false;callbacks.toggle();assert(rows[1].hidden);assert.equal(empty.hidden,false);
});
test('Calendar agenda sorts events chronologically, shows London time and escapes event content',()=>{
 const render=source.slice(source.indexOf('function calendarAgendaRows('),source.indexOf('function openCalendarAgenda('));
 const events=[{title:'Later',start:'2026-11-02T12:00:00Z'},{title:'<script>early</script>',start:'2026-11-01T09:30:00Z',location:'Main & Hall'},{title:'All day',start:'2026-11-01T00:00:00Z',allDay:true}];
 const html=runInNewContext(render+';calendarAgendaRows(events)',{events,escapeHtml:escape,escapeAttribute:escape,Intl});
 assert(html.indexOf('All day')<html.indexOf('&lt;script>early'));assert(html.indexOf('&lt;script>early')<html.indexOf('Later'));assert(html.includes('09:30'));assert(!html.includes('<script>'));assert(html.includes('data-agenda-event="1"'));
});
test('Media chooser filters multiple words and separates uploads from protected packaged assets',()=>{
 const helper=source.slice(source.indexOf('function pickerMatches('),source.indexOf('async function renderAssetPickerItems('));
 const match=runInNewContext(helper+';pickerMatches');
 const files=[{name:'Church Sunday.jpg',source:'upload',protected:true},{name:'Church youth.png',source:'packaged',protected:false}];
 assert.equal(match(files,'CHURCH sunday','all').length,1);assert.equal(match(files,'','upload').length,1);assert.equal(match(files,'','unprotected')[0].name,'Church youth.png');assert.equal(match(files,'no match','all').length,0);
});
test('A library upload refreshes the manager instead of removing its controls',async()=>{
 const upload=source.slice(source.indexOf('async function uploadAssetFile('),source.indexOf('function initSiteSettingsAdmin('));
 let refreshed=0,closed=0;const input={dispatchEvent(){}},overlay={id:'asset-manager',querySelector:()=>({})};
 const f=runInNewContext(upload+';uploadAssetFile',{FormData:class{append(){}},fetch:async()=>({ok:true,status:200,json:async()=>({path:'/uploads/new.jpg'})}),escapeHtml:escape,Event:class{},renderManagedAssets:async()=>refreshed++,closeAssetPicker:()=>closed++});
 await f(overlay,'image',input,{name:'new.jpg'});assert.equal(input.value,'/uploads/new.jpg');assert.equal(refreshed,1);assert.equal(closed,0);
});
test('Hero preview uses the selected device image and framing regardless of browser viewport',()=>{
 const render=source.slice(source.indexOf('function renderHeroPreviewWorkspace('),source.indexOf('function renderHeroImageEditorForm('));
 const config={desktopImage:'wide.jpg',mobileImage:'phone.jpg',desktopFit:'cover',mobileFit:'contain',desktopFocal:'left',mobileFocal:'right',desktopScale:'1',mobileScale:'1.3'};
 const f=runInNewContext(render+';renderHeroPreviewTile',{escapeAttribute:escape,heroLabel:()=> 'About'});
 const phone=f('about',true,config,'phone');assert(phone.includes('phone.jpg'));assert(!phone.includes('wide.jpg'));assert(phone.includes('--tile-fit:contain'));assert(phone.includes('--tile-scale:1.3'));assert(!phone.includes('href='));
 const desktop=f('about',true,config,'desktop');assert(desktop.includes('wide.jpg'));assert(!desktop.includes('phone.jpg'));
});
test('About page retains the full founder welcome inside a disclosure and offers a first-visit action',()=>{
 const render=source.slice(source.indexOf('function renderAboutHub('),source.indexOf('function renderYouthHub('));
 const page=runInNewContext(render+';renderAboutHub()',{renderSubPage:p=>p,seniorPastor:{image:'sam.jpg'},escapeAttribute:escape});
 assert(page.actions.some(a=>a[1]==='#/plan-your-visit'));assert(page.body.includes('<details>'));assert(page.body.includes('Thank you for taking time'));assert(page.body.includes('If you are looking for a place to connect'));assert(page.body.includes('Pastor and Founder'));
});
test('Pastor completion checks track editable essentials without treating optional roles as required',()=>{
 const helper=source.slice(source.indexOf('function pastorProfileGaps('),source.indexOf('function initPastorCompletionQueue('));
 const gaps=runInNewContext(helper+';pastorProfileGaps');
 assert.deepEqual(Array.from(gaps({name:'Pastor',role:'Associate',image:'photo.jpg',intro:' '})),['Introduction']);assert.equal(gaps({name:'Pastor',role:'Associate',image:'photo.jpg',intro:'Hello'}).length,0);
});
test('Public church links preserve the selected church without rerendering or storing account data',()=>{
 const helpers=source.slice(source.indexOf('function publicChurchChoice()'),source.indexOf('function publicLinkControl('));
 let replaced='';const window={location:{hash:'#/watch?church=south%20london',pathname:'/',search:''},history:{replaceState:(_a,_b,url)=>replaced=url}};
 const f=runInNewContext(helpers+';({publicChurchChoice,updatePublicChurchLink})',{window,URLSearchParams});
 assert.equal(f.publicChurchChoice(),'south london');f.updatePublicChurchLink('/plan-your-visit','church/a');assert.equal(replaced,'/#/plan-your-visit?church=church%2Fa');
});
test('Sharing offers a selectable link when clipboard access is unavailable',async()=>{
 const init=source.slice(source.indexOf('function initPublicLinkControls()'),source.indexOf('function renderVisitPlanDetails('));
 let click;const status={},input={focus(){this.focused=true},select(){this.selected=true}},fallback={hidden:true,querySelector:()=>input};
 const control={querySelector:s=>s.includes('status')?status:fallback},button={closest:()=>control,addEventListener:(_t,fn)=>click=fn};
 runInNewContext(init+';initPublicLinkControls()',{document:{querySelectorAll:()=>[button]},navigator:{clipboard:{writeText:async()=>{throw Error('Denied')}}},window:{location:{href:'https://example.com/#/watch?church=one'}}});
 await click();assert.equal(fallback.hidden,false);assert(input.focused&&input.selected);assert.equal(input.value,'https://example.com/#/watch?church=one');
});
test('Publication checks require only editable branch facts, associate profile content and newsletter text',()=>{
 const helper=source.slice(source.indexOf('function publicationChecks('),source.indexOf('function renderAdminReadiness('));
 const checks=runInNewContext(helper+';publicationChecks(branches,people,news)',{branches:[{name:'Ready',address:'Road',services:'Sunday'},{name:'Missing',address:' '}],people:[{name:'Ready',image:'image.jpg',intro:'Hello'},{name:'Missing',image:'image.jpg',intro:''}],news:{title:'News',body:'Update',image:''}});
 assert.equal(checks[0].missing.length,1);assert.equal(checks[1].missing.length,1);assert.equal(checks[2].missing.length,0);
});
test('Pastor directory matches name and role, collapses the hidden president space and restores the team',()=>{
 const init=source.slice(source.indexOf('function initPastorDirectory()'),source.indexOf('function renderPastorProfile('));
 let search;const cards=[{dataset:{pastorSearch:'pr sam john president'}},{dataset:{pastorSearch:'pr tiju thomas youth pastor'}}],count={},empty={},lead={querySelector:()=>cards[0].hidden?null:cards[0]};
 const gallery={querySelectorAll:()=>cards,querySelector:s=>s.includes('lead')?lead:s.includes('count')?count:empty};
 const input={value:'tiju youth',closest:()=>gallery,addEventListener:(_t,fn)=>search=fn};
 runInNewContext(init+';initPastorDirectory()',{document:{getElementById:()=>input}});search();assert(cards[0].hidden&&!cards[1].hidden);assert(lead.hidden);assert.equal(count.textContent,'1 pastor found');
 input.value='unknown';search();assert.equal(empty.hidden,false);input.value='';search();assert(cards.every(c=>!c.hidden));assert.equal(lead.hidden,false);
});
test('Youth entry keeps media modes and gives a contextual email path instead of a generic contact detour',()=>{
 const render=source.slice(source.indexOf('function renderYouthHub()'),source.indexOf('function renderMinistryExplorer('));
 const context={getHeroImageConfig:()=>({desktopImage:'youth.jpg',mobileImage:'phone.jpg'}),escapeAttribute:escape,renderFooter:()=>'',videoType:()=> 'video/mp4'};
 let html=runInNewContext(render+';renderYouthHub()',context);assert(html.includes('phone.jpg'));assert(html.includes('Joining%20LPC%20Youth'));assert(html.includes('Friday · 7:00 pm'));
 context.getHeroImageConfig=()=>({desktopImage:'poster.jpg',video:'youth.mp4'});html=runInNewContext(render+';renderYouthHub()',context);assert(html.includes('<video'));assert(html.includes('youth.mp4'));
});
const getter=source.slice(source.indexOf('function getNewsletterConfig()'),source.indexOf('function getSiteSettingsConfig()'));
const render=source.slice(source.indexOf('function renderNewsletterSection('),source.indexOf('function videoType('));
const context=config=>({newsletterConfig:config,defaultNewsletterConfig:defaults,escapeHtml:escape,escapeAttribute:escape});

test('Newsletter studio preview escapes text and supports image and text announcements',()=>{
 const renderer=source.slice(source.indexOf('function renderNewsletterDraftPreview('),source.indexOf('function renderNewsletterAdminFields('));
 const html=runInNewContext(renderer+';renderNewsletterDraftPreview(draft)',{draft:{title:'<script>title</script>',body:'<img src=x onerror=bad>',image:'./assets/images/news.jpg',imageAlt:'News poster'},escapeHtml:escape,escapeAttribute:escape});
 assert(html.includes('&lt;script>title'));assert(html.includes('&lt;img src=x'));assert(html.includes('alt="News poster"'));assert(!html.includes('<script>'));
 const text=runInNewContext(renderer+';renderNewsletterDraftPreview(draft)',{draft:{title:'News',body:'Text only'},escapeHtml:escape,escapeAttribute:escape});assert(!text.includes('<img'));
});

test('Newsletter studio tracks unpublished edits, switches phone views and preserves edits made while publishing',()=>{
 const init=source.slice(source.indexOf('function initNewsletterStudio()'),source.indexOf('function renderAdminLogin()'));
 const fields={...defaults,title:'Original'},events={},preview={},dirty={},review={addEventListener:(_type,fn)=>events.review=fn},undo={addEventListener:(_type,fn)=>events.undo=fn};
 const buttons=['edit','preview'].map(view=>({dataset:{newsletterView:view},addEventListener:(type,fn)=>events[view]=fn,setAttribute(k,v){this[k]=v}}));
 const form={dataset:{},elements:{namedItem:key=>({set value(value){fields[key]=value}})},querySelector:s=>s.includes('review')&&!s.includes('preview')?review:s.includes('undo')?undo:s.includes('checklist')?null:s.includes('preview')?preview:dirty,querySelectorAll:()=>buttons,addEventListener:(type,fn)=>events[type]=fn};
 runInNewContext(init+';initNewsletterStudio()',{document:{getElementById:()=>form},FormData:class{get(k){return fields[k]}},defaultNewsletterConfig:defaults,renderNewsletterDraftPreview:d=>d.title});
 fields.title='Updated';events.input();assert.equal(preview.innerHTML,'Updated');assert.equal(dirty.textContent,'Unpublished changes');
 events.preview();assert.equal(form.dataset.newsletterMode,'preview');assert.equal(buttons[1]['aria-pressed'],'true');
 events.invalid();assert.equal(form.dataset.newsletterMode,'edit');assert.equal(buttons[0]['aria-pressed'],'true');
 const submitted={...fields};fields.title='Changed during save';events['newsletter-published']({detail:submitted});assert.equal(dirty.textContent,'Unpublished changes');
 fields.title='Updated';events.input();assert.equal(dirty.textContent,'Saved version');fields.title='Unwanted edit';events.input();events.undo();assert.equal(fields.title,'Updated');assert.equal(dirty.textContent,'Saved version');
});
test('Newsletter preserves legacy content and renders a text broadcast without an empty image',()=>{
 const html=runInNewContext(getter+render+';renderNewsletterSection()',context({kicker:"Pastor's Thought",title:'A word of encouragement for this week.',body:'Existing news\nSecond line',ctaText:'Watch Sermons',ctaHref:'#/watch'}));
 assert(html.includes('Newsletter'));assert(html.includes('News &amp; updates from LPC'));assert(html.includes('Existing news\nSecond line'));assert(!html.includes('<img'));assert(!html.includes('Watch Sermons'));assert(!html.includes("Pastor's Thought"));
});
test('Newsletter displays the optional image above escaped text and preserves optional links',()=>{
 const html=runInNewContext(getter+render+';renderNewsletterSection()',context({title:'Church news',body:'<script>unsafe</script>',image:'./assets/images/news.jpg',imageAlt:'Church family',ctaText:'Read more',ctaHref:'#/contact'}));
 assert(html.indexOf('<img')<html.indexOf('newsletter-content'));assert(html.includes('alt="Church family"'));assert(html.includes('&lt;script>unsafe&lt;/script>'));assert(html.includes('href="#/contact"'));
 assert.equal(runInNewContext(getter+render+';renderNewsletterSection()',context({})), '');
});
test('Newsletter editor saves and removes images, keeps optional fields empty and reports save errors',async()=>{
 const init=source.slice(source.indexOf('function initNewsletterAdmin()'),source.indexOf('function initHeroImagesAdmin()'));
 let submit,saved,fail=false;
 const fields=new Map([['title','Church update'],['body','News for all'],['image','./assets/images/news.jpg']]);
 const status={},button={disabled:false},form={addEventListener:(_,fn)=>submit=fn,querySelector:key=>key==='[type="submit"]'?button:status};
 const env={document:{getElementById:()=>form},FormData:class{get(key){return fields.get(key)}},defaultNewsletterConfig:defaults,saveNewsletterConfig:async value=>{if(fail)throw Error('Save failed');saved=value}};
 runInNewContext(init+';initNewsletterAdmin()',env);
 await submit({preventDefault(){}});assert.equal(saved.image,'./assets/images/news.jpg');assert.equal(saved.ctaText,'');assert.match(status.textContent,/published/);
 fields.set('image','');await submit({preventDefault(){}});assert.equal(saved.image,'');
 fail=true;await submit({preventDefault(){}});assert.equal(status.textContent,'Save failed');assert.equal(button.disabled,false);
});

test('Image viewer opens modally, locks scrolling, closes and restores focus and scroll state',()=>{
 const init=source.slice(source.indexOf('function initNewsletterViewer()'),source.indexOf('function videoType('));
 const events={},closeButton={},opener={isConnected:true,addEventListener:(_,fn)=>events.open=fn,focus:()=>events.focused=true};
 const viewer={open:false,showModal(){this.open=true},close(){this.open=false;events.close()},querySelector:()=>closeButton,addEventListener:(type,fn)=>events[type]=fn};
 closeButton.addEventListener=(_,fn)=>events.closeButton=fn;
 const document={body:{style:{overflow:'auto'}},querySelector:key=>key==='.newsletter-image-button'?opener:viewer};
 runInNewContext(init+';initNewsletterViewer()', {document});
 events.open();assert(viewer.open);assert.equal(document.body.style.overflow,'hidden');
 events.closeButton();assert(!viewer.open);assert.equal(document.body.style.overflow,'auto');assert(events.focused);
 events.open();events.click({target:viewer});assert(!viewer.open);
});

test('Media references match encoded local paths, deduplicate uses and distinguish different files',()=>{
 const helper=source.slice(source.indexOf('function matchingMediaReferences('),source.indexOf('function savedMediaReferences('));const match=runInNewContext(helper+';matchingMediaReferences');
 const entries=[{path:'./assets/images/family photo.jpg',label:'Home',href:'#/home'},{path:'/assets/images/family%20photo.jpg',label:'Home',href:'#/home'},{path:'/assets/images/family photo.jpg',label:'Newsletter',href:'#/news'},{path:'/uploads/family photo.jpg',label:'Other',href:'#/other'}];
 const result=match('/assets/images/family%20photo.jpg?cache=1',entries);assert.equal(result.length,2);assert.equal(result[1].label,'Newsletter');assert.equal(match('',entries).length,0);
});
