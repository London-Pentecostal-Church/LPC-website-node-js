import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const ui = readFileSync(new URL('../assets/js/volunteers.js', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../assets/js/team-auth.js', import.meta.url), 'utf8');
const render = ui.slice(ui.indexOf('  function render()'), ui.indexOf('  function weekControls()'));

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
      weekly: () => '',
    };
    context.window = {};
    runInNewContext(authSource + render + '\nrender();', context);
    const html = root.innerHTML;
    assert(html.includes('Sign out'));
    assert(html.includes('Sign in as another account'));
    assert.equal(html.includes('data-tab="pastoral"'), !!(actor.admin || actor.manage?.includes('ministry')));
    assert.equal(html.includes('data-tab="choir"'), !!(actor.admin || actor.manage?.includes('service')));
    assert.equal(html.includes('Members & skills'), !!actor.admin);
    assert(!html.includes('Create account'));
    const home = context.window.LPCTeamAuth.landing(actor);
    assert(html.includes(`href="${home.href}"`));
    assert(html.indexOf(home.label) < html.indexOf('<header'));
    assert(html.includes('href="#/home"'));
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
    });
    assert.equal(html.includes('data-users-page="true"'), authenticated);
    if (!authenticated) assert.equal(html, 'Admin sign-in required');
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
  assert.deepEqual(opened,['a']);
  assert.equal(editButton.disabled,false);
  const clickStart=ui.indexOf('      if (a === "edit-selected-user")');
  const clickEnd=ui.indexOf('      if (a === ',clickStart+10);
  const reopen=()=>runInNewContext('(async()=>{'+ui.slice(clickStart,clickEnd)+'})()',{a:'edit-selected-user',root,memberDialog:id=>opened.push(id)});
  await reopen();
  await reopen();
  assert.deepEqual(opened,['a','a','a']);
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
