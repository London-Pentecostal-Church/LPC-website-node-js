import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const ui = readFileSync(new URL('../assets/js/volunteers.js', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../assets/js/team-auth.js', import.meta.url), 'utf8');
const render = ui.slice(ui.indexOf('  function render()'), ui.indexOf('  function weekControls()'));

test('Meeting form supports weekly, one-off and daily patterns with exact date payloads', () => {
  const source=ui.slice(ui.indexOf('  function churchMeetingDialog('),ui.indexOf('  function swaps()'));
  let body,submit,payload,refreshed=0;
  const context={canMeetings:()=>true,state:{meetings:[]},branches:['Main Church'],teams:()=>['English'],esc:v=>v,
    field:(label,html)=>label+html,input:(name,value,type,extra)=>`<input name="${name}" value="${value}" ${extra}>`,
    options:values=>values.map(([id,label])=>`<option value="${id}">${label}</option>`).join(''),today:()=> '2032-04-01',
    timeField:()=>'',timeValue:()=> '19:30',leadOptions:()=>'',refreshMeetingPattern:()=>refreshed++,
    modal:(_title,html,_submit,callback)=>{body=html;submit=callback;},save:value=>payload=value,
    addDays:(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}};
  runInNewContext(source+';churchMeetingDialog();',context);
  assert.equal(refreshed,1);for(const value of ['weekly','once','daily','3','7','21','custom'])assert(body.includes('value="'+value+'"'));
  for(const [pattern,count,end]of [['once','7','2032-04-01'],['daily','3','2032-04-03'],['daily','7','2032-04-07'],['daily','21','2032-04-21'],['daily','custom','2032-04-05']]) {
    submit(new Map([['recurrence',pattern],['name','Prayer'],['branch','Main Church'],['team','English'],['startDate','2032-04-01'],['seriesLength',count],['dayCount','5'],['duration','60']]));
    assert.equal(payload.meeting.recurrence,pattern);assert.equal(payload.meeting.endDate,end);
  }
  submit(new Map([['recurrence','weekly'],['day','0'],['name','Weekly'],['branch','Main Church'],['team','English'],['duration','60']]));
  assert.equal(payload.meeting.day,0);assert.equal(payload.meeting.startDate,undefined);
});

test('Watch lists playable videos ahead of collapsed coming-soon branches', () => {
  const site=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
  const source=site.slice(site.indexOf('function renderWatchHub()'),site.indexOf('function prioritiseWatchPlayer('));
  const entry=(label,videoUrl='',youtubeUrl='')=>({key:label,label,branchHref:'#/branches/'+label,source:{videoUrl,youtubeUrl,watchTitle:label,socials:[]}});
  const context={mediaCollections:()=>[entry('Soon'),entry('Channel','','https://youtube.com/@example'),entry('Video','playable')],youtubeVideoId:v=>v==='playable'?'abc123':'',escapeHtml:v=>v,escapeAttribute:v=>v,collectionThemeStyle:()=>'',socialIcon:()=>''};
  const html=runInNewContext(source+';renderWatchHub()',context);
  assert(html.indexOf('data-watch-priority="2"')<html.indexOf('data-watch-priority="1"'));
  assert(html.indexOf('data-watch-available')<html.indexOf('<details class="watch-coming-soon"'));
  assert(html.includes('Videos coming soon'));
  assert(!html.includes('class="watch-coming-soon" open'));
  assert(html.includes('#/branches/Soon'));
  const withFollow=entry('Channel','','https://youtube.com/@example');
  withFollow.source.socials=[['YouTube',withFollow.source.youtubeUrl,'Services']];
  context.mediaCollections=()=>[withFollow];
  const deduplicated=runInNewContext(source+';renderWatchHub()',context);
  assert.equal(deduplicated.split('href="https://youtube.com/@example"').length-1,1);
  assert(!deduplicated.includes('Open YouTube channel'));
});

test('Shared footer keeps Home and Watch as quick links without a second exit button group', () => {
  const site=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
  const source=site.slice(site.indexOf('function renderServiceTimes('),site.indexOf('function quickItem('));
  const html=runInNewContext(source+';renderFooter()',{
    branchCards:[],normalizeRoute:()=>'/volunteers',defaultTheme:{logo:'logo.png'},escapeHtml:v=>v,escapeAttribute:v=>v,mediaSources:{home:{socials:[]}},socialIcon:()=>''});
  assert.equal(html.split('href="#/home"').length-1,1);
  assert.equal(html.split('href="#/watch"').length-1,1);
  assert(!html.includes('footer__website-return'));
  assert(html.indexOf('Team access')>html.indexOf('All rights reserved.'));
});

test('Resolving a live stream promotes only its placeholder and leaves existing players in place', () => {
  const site=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
  const source=site.slice(site.indexOf('function prioritiseWatchPlayer('),site.indexOf('function collectionColor('));
  const rows=[1,2,3].map((order)=>({dataset:{watchPriority:'1',watchOrder:String(order)}}));
  const moved=[];
  const list={children:rows,matches:()=>true,insertBefore(row,next){moved.push(row);rows.splice(rows.indexOf(row),1);rows.splice(next?rows.indexOf(next):rows.length,0,row);}};
  rows.forEach(row=>{row.parentElement=list;Object.defineProperty(row,'nextElementSibling',{get:()=>rows[rows.indexOf(row)+1]||null});});
  const promote=runInNewContext(source+';prioritiseWatchPlayer',{});
  const latest=rows[1],live=rows[2];
  promote({closest:()=>latest},'Latest video');
  promote({closest:()=>live},'Live now');
  assert.equal(rows[0],live);assert.equal(rows[1],latest);
  assert.deepEqual(moved,[latest,live]);
  promote({closest:()=>live},'Live now');assert.equal(moved.length,2);
});

test('Home reference sections collapse by default while the service stream stays visible', () => {
  const site=readFileSync(new URL('../assets/js/site.js',import.meta.url),'utf8');
  const source=site.slice(site.indexOf('function homeDisclosure('),site.indexOf('function renderHomeHeroMedia()'));
  const context={escapeHtml:v=>String(v),branchCards:[{},{}],pastors:[],mediaSources:{home:{}},quickItem:()=>'<a>Quick action</a>',
    renderHomeHeroMedia:()=>'<video></video>',renderCalendarSection:()=>'<section>Events</section>',renderBranchesSection:()=>'<section>Branches</section>',
    renderMediaSection:(_,featured)=>featured?'<section data-featured-stream>Service stream</section>':'',renderSocialSection:()=>'<section>Socials</section>',renderFooter:()=>'<footer>Contact and service times</footer>'};
  const html=runInNewContext(source+';renderHome()',context);
  assert.equal((html.match(/<details class="home-disclosure">/g)||[]).length,4);
  assert(!html.includes('class="home-disclosure" open'));
  assert(html.indexOf('data-featured-stream')<html.indexOf('<details'));
  for(const label of ['Upcoming events','Our branches','Stay connected','Our people']) {
    assert(html.includes(label.replace('&amp;','&')));
  }
  assert(html.includes('<footer>Contact and service times</footer>'));
});

test('Meeting tiles start collapsed while critical cover and personal responsibilities remain visible', () => {
  const source=ui.slice(ui.indexOf('  function meetingTile('),ui.indexOf('  function meetingCard('));
  for(const tab of ['my-week','pastoral','choir','meetings']){
    const context={tab,esc:value=>String(value),name:()=> 'Example Pastor',branchStyle:()=>'',date:value=>value,shortDate:value=>value,
      meetingTitle:value=>value,plannerBadge:()=>({label:'Pastor needed',className:'vs-red'}),
      readiness:()=>({pastorId:''}),needsReview:()=>false,choirTeamBadge:()=>({label:'2 choir/media places to arrange',className:''})};
    const html=runInNewContext(source+';meetingTile({kind:"ministry",name:"Sunday Service",branch:"Main Church",team:"English",time:"09:30",date:"2030-01-06"},"<button>Edit meeting details</button>","Sound operator",true)',context);
    const [summary,body]=html.split('<div class="wp-card-body">');
    assert(html.startsWith('<details '));
    assert(!html.slice(0,html.indexOf('>')).includes(' open'));
    assert(summary.includes('Pastor needed'));
    assert(summary.includes('09:30'));
    assert(summary.includes('Sound operator'));
    assert(summary.includes('My duty:'));
    assert(!summary.includes('Your responsibility:'));
    assert(!summary.includes('Not arranged — action needed'));
    assert(!summary.includes('Edit meeting details'));
    assert(body.includes('Edit meeting details'));
    if(tab==='choir')assert(summary.includes('2 choir/media places to arrange'));
  }
});

test('Meeting time controls retain every minute and submit 24-hour time without a native clock popup', () => {
  const source=ui.slice(ui.indexOf('  const options ='), ui.indexOf('  async function api('));
  let allowed=true;
  const controls=runInNewContext(source+';({timeField,timeValue,editMeetingButton})',{
    esc:value=>String(value??''), btn:label=>label, canMeetings:()=>allowed,
    state:{meetings:[{id:'regular'}]},
  });
  const html=controls.timeField('19:37');
  assert(!html.includes('type="time"'));
  assert.equal((html.match(/<option /g)||[]).length,84);
  assert(html.includes('value="19" selected'));
  assert(html.includes('value="37" selected'));
  for(const [hour,minute]of [['00','00'],['19','37'],['23','59']]){
    assert.equal(controls.timeValue(new Map([['time-hour',hour],['time-minute',minute]])),hour+':'+minute);
  }
  assert.equal(controls.editMeetingButton({meetingId:'regular'}),'Edit meeting details');
  assert.equal(controls.editMeetingButton({meetingId:'missing'}),'');
  allowed=false;
  assert.equal(controls.editMeetingButton({meetingId:'regular'}),'');
});

test('Role menus expose only the permitted planner lanes and always offer sign-out', () => {
  for (const actor of [
    { name: 'Volunteer', manage: [] },
    { name: 'Pastoral scheduler', manage: ['ministry'] },
    { name: 'Choir scheduler', manage: ['service'] },
    { name: 'Both schedulers', manage: ['ministry', 'service'] },
    { name: 'Administrator', admin: true },
  ]) {
    const root = { isConnected: true, querySelector: () => ({ innerHTML: '' }) };
    const context = {
      root, state: { actor, notifications: [] }, tab: 'my-week', kind: 'service', weekStart: '2030-01-01',
      isCoordinator: () => actor.admin || actor.manage?.length,
      manager: () => actor.admin || actor.manage?.includes('service'),
      esc: value => value,
      btn: (label, action, extra = '') => `<button data-vs="${action}" ${extra}>${label}</button>`,
      weekly: () => '', members: () => '',
    };
    context.window = {};
    runInNewContext(authSource + render + '\nrender();', context);
    const html = root.innerHTML;
    assert(html.includes('Sign out'));
    assert(html.includes('class="wp-account-identity" role="group" aria-label="Signed-in account"'));
    assert(html.includes('<strong class="wp-account-name">'+actor.name+'</strong>'));
    assert(html.includes('<b>Role:</b>'));
    assert(!html.includes('Sign in as another account'));
    assert(!html.includes('data-tab="meetings" class="vs-btn vs-btn--secondary">Church meetings'));
    assert.equal(html.includes('data-tab="pastoral"'), !!(actor.admin || actor.manage?.includes('ministry')));
    assert.equal(html.includes('data-tab="choir"'), !!(actor.admin || actor.manage?.includes('service')));
    assert.equal(html.includes('Members & skills'), !!actor.admin);
    assert(!html.includes('Create account'));
    assert(!html.includes('aria-label="Return navigation"'));
    if (actor.admin) {
      root.dataset = { usersPage: 'true' };
      runInNewContext('render();', context);
      assert(root.innerHTML.includes('aria-label="Return navigation"'));
      assert(root.innerHTML.includes('href="#/lpcadmin"'));
    }
  }
});

test('Account switching clears both sessions and reloads the sign-in screen', async () => {
  const start = ui.indexOf('      if (a === "logout") {');
  const end = ui.indexOf('      if (a === "forgot-password")', start);
  const calls = [];
  const location = { hash: '#/volunteers', reload: () => calls.push('reload') };
  const context = {
    a: 'logout', clashDraft: {}, quickAddDraft: {}, viewedMemberId: 'old', selected: 'old', tab: 'pastoral', weekStart: 'old', state: {},
    fetch: async path => { calls.push(path); return { ok: true, json: async () => ({actor:null}) }; }, window: { location },
  };
  const auth = readFileSync(new URL('../assets/js/team-auth.js', import.meta.url), 'utf8');
  runInNewContext(auth, context);
  await runInNewContext('(async () => {' + ui.slice(start, end) + '})()', context);
  assert.deepEqual(calls, ['/api/volunteers/logout', '/api/admin/logout', '/api/volunteers/session', 'reload']);
  assert.equal(location.hash, '#/volunteers');
});

test('Failed logout or a retained session never switches to another account', async () => {
  const auth = readFileSync(new URL('../assets/js/team-auth.js', import.meta.url), 'utf8');
  for (const failedPath of ['/api/volunteers/logout','/api/admin/logout','/api/volunteers/session','retained-session']) {
    let reloaded = false;
    const context = {
      window: {location:{hash:'#/lpcadmin',reload:()=>{reloaded=true;}}},
      fetch: async path => ({ok:path!==failedPath,json:async()=>({actor:failedPath==='retained-session'?{admin:true}:null})}),
    };
    runInNewContext(auth, context);
    await assert.rejects(context.window.LPCTeamAuth.signOut());
    assert.equal(reloaded,false);
    assert.equal(context.window.location.hash,'#/lpcadmin');
  }
  const html = readFileSync(new URL('../index.html', import.meta.url),'utf8');
  assert(html.indexOf('assets/js/team-auth.js') < html.indexOf('assets/js/volunteers.js'));
});

test('Main admin opens a dedicated, administrator-only user management route', () => {
  const site = readFileSync(new URL('../assets/js/site.js', import.meta.url), 'utf8');
  assert(site.indexOf('href="#/lpcadmin/users"') < site.indexOf('href="#/lpcadmin/volunteers"'));
  const routeStart = site.indexOf('function getDynamicRouteRenderer(route)');
  const routeEnd = site.indexOf('\nfunction ', routeStart + 1);
  const routeSource = site.slice(routeStart, routeEnd);
  for (const authenticated of [false, true]) {
    const html = runInNewContext(routeSource + '\ngetDynamicRouteRenderer("/lpcadmin/users")();', {
      adminSession: { authenticated }, renderAdminLogin: () => 'Admin sign-in required',
      renderFooter: () => '<footer>Home and Watch quick links</footer>',
    });
    assert.equal(html.includes('data-users-page="true"'), authenticated);
    assert.equal(html.includes('<footer>Home and Watch quick links</footer>'), authenticated);
    if (!authenticated) assert.equal(html, 'Admin sign-in required');
  }
  for (const route of ['/volunteers','/lpcadmin/volunteers']) {
    const html=runInNewContext(routeSource+';getDynamicRouteRenderer("'+route+'")();',{renderFooter:()=>'<footer>Home and Watch quick links</footer>'});
    assert(html.indexOf('<footer>') > html.indexOf('</section>'));
    assert.equal((html.match(/<footer>/g)||[]).length,1);
  }
  const root = { isConnected: true, dataset: { usersPage: 'true' }, querySelector: () => ({ innerHTML: '' }) };
  const context = {
    root, state: { actor: { name: 'Administrator', admin: true }, notifications: [] },
    tab: 'my-week', kind: 'service', weekStart: '2030-01-01', isCoordinator: () => true, manager: () => true,
    esc: value => value, btn: (label, action) => `<button data-vs="${action}">${label}</button>`, members: () => 'Account manager',
  };
  context.window = {};
  runInNewContext(authSource + render + '\nrender();', context);
  assert.equal(context.tab, 'members');
  assert(root.innerHTML.includes('<h1>Users & access</h1>'));
  assert(root.innerHTML.includes('Main admin menu'));
  assert(root.className.includes('wp-users-page'));
  assert(!root.innerHTML.includes('Coordinator settings'));
});

test('Return destinations match each role and links work even when the URL already matches', async () => {
  const cases=[
    [null,'#/home','my-week'],
    [{admin:true},'#/lpcadmin','my-week'],
    [{manage:['ministry']},'#/volunteers?view=pastoral','pastoral'],
    [{manage:['service']},'#/volunteers?view=choir','choir'],
    [{manage:['ministry','service']},'#/volunteers?view=pastoral','pastoral'],
    [{manage:[]},'#/volunteers?view=my-week','my-week'],
  ];
  for(const [actor,href,view]of cases){
    const context={window:{},state:{actor},a:'landing',selected:'old',viewedMemberId:'other',tab:'history',kind:'service',e:{preventDefault(){}},close(){},render(){},root:{querySelector:()=>null}};
    runInNewContext(authSource,context);
    assert.equal(context.window.LPCTeamAuth.landing(actor).href,href);
    assert.equal(context.window.LPCTeamAuth.landing(actor).view,view);
    if(!actor || actor.admin)continue;
    const start=ui.indexOf('      if (a === "landing")');
    const end=ui.indexOf('      if (a === "open-clash")',start);
    await runInNewContext('(async()=>{'+ui.slice(start,end)+'})()',context);
    assert.equal(context.tab,view);
    assert.equal(context.viewedMemberId,null);
    assert.equal(context.selected,'');
  }
});

test('User management starts with a picker and opens only the selected profile', async () => {
  const source = ui.slice(ui.indexOf('  function memberChoices('), ui.indexOf('  function pendingAccounts()'));
  const members = [
    {id:'z', name:'Zoe Example', username:'zoe', active:true},
    {id:'a', name:'Alex Example', username:'alex', active:false},
  ];
  const context = {state:{members,pendingAccounts:[]},accountEmailEnabled:true,field:(label,html)=>label+html,
    btn:(label,action)=>`<button data-vs="${action}">${label}</button>`,
    options:values=>values.map(([id,label])=>`<option value="${id}">${label}</option>`).join(''),pendingAccounts:()=>''};
  const result = runInNewContext(source+';({members,memberChoices})',context);
  const html = result.members();
  assert(html.includes('Select existing user')); assert(html.includes('Add new user'));
  assert(!html.includes('<table')); assert(!html.includes('name="skills"')); assert(!html.includes('name="manage"'));
  assert.deepEqual(Array.from(result.memberChoices('ALEX'),choice=>choice[0]),['a']);
  assert.equal(result.memberChoices('nobody').length,0);
  assert.deepEqual(Array.from(result.memberChoices(),choice=>choice[0]),['a','z']);
  assert(html.includes('Edit selected user'));
  const editButton = {disabled:true};
  const picker = {value:'a'};
  const root = {querySelector:selector=>selector==='[data-user-select]'?picker:editButton};
  const opened=[];
  const handler = ui.slice(ui.indexOf('    root.onchange = async (e) => {'),ui.indexOf('    root.oninput = (e) => {'));
  runInNewContext(handler,{root,memberDialog:id=>opened.push(id)});
  await root.onchange({target:{matches:selector=>selector==='[data-user-select]',value:'a'}});
  assert.deepEqual(opened,[]);
  assert.equal(editButton.disabled,false);
  const clickStart=ui.indexOf('      if (a === "edit-selected-user")');
  const clickEnd=ui.indexOf('      if (a === ',clickStart+10);
  const reopen=()=>runInNewContext('(async()=>{'+ui.slice(clickStart,clickEnd)+'})()',{a:'edit-selected-user',root,memberDialog:id=>opened.push(id)});
  await reopen();
  await reopen();
  assert.deepEqual(opened,['a','a']);
  await root.onchange({target:{matches:selector=>selector==='[data-user-select]',value:''}});
  assert.equal(editButton.disabled,true);
  const results={textContent:''};
  root.querySelector=selector=>selector==='[data-user-select]'?picker:selector==='[data-user-results]'?results:editButton;
  const inputHandler=ui.slice(ui.indexOf('    root.oninput = (e) => {'),ui.indexOf('    try {',ui.indexOf('    root.oninput = (e) => {')));
  runInNewContext(inputHandler,{root,memberChoices:result.memberChoices,options:()=>'',refreshMeetingSchedulers(){}});
  editButton.disabled=false;
  root.oninput({target:{matches:selector=>selector==='[data-user-search]',value:'nobody'}});
  assert.equal(editButton.disabled,true);
  assert.equal(picker.disabled,true);
});
