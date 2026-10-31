import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
const defaults={kicker:'Newsletter',title:'News & updates from LPC',body:'',author:'',date:'',image:'',imageAlt:'',ctaText:'',ctaHref:''};
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
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
 const fields={...defaults,title:'Original'},events={},preview={},dirty={};
 const buttons=['edit','preview'].map(view=>({dataset:{newsletterView:view},addEventListener:(type,fn)=>events[view]=fn,setAttribute(k,v){this[k]=v}}));
 const form={dataset:{},querySelector:s=>s.includes('preview')?preview:dirty,querySelectorAll:()=>buttons,addEventListener:(type,fn)=>events[type]=fn};
 runInNewContext(init+';initNewsletterStudio()',{document:{getElementById:()=>form},FormData:class{get(k){return fields[k]}},defaultNewsletterConfig:defaults,renderNewsletterDraftPreview:d=>d.title});
 fields.title='Updated';events.input();assert.equal(preview.innerHTML,'Updated');assert.equal(dirty.textContent,'Unpublished changes');
 events.preview();assert.equal(form.dataset.newsletterMode,'preview');assert.equal(buttons[1]['aria-pressed'],'true');
 events.invalid();assert.equal(form.dataset.newsletterMode,'edit');assert.equal(buttons[0]['aria-pressed'],'true');
 const submitted={...fields};fields.title='Changed during save';events['newsletter-published']({detail:submitted});assert.equal(dirty.textContent,'Unpublished changes');
 fields.title='Updated';events.input();assert.equal(dirty.textContent,'Saved version');
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
