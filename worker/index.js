import { calendarEvents } from './calendar.mjs';
/* BUNDLED_DATA */
const json = (body,status=200,extra={}) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const cookie = request => request.headers.get('cookie')?.match(/(?:^|;\s*)lpc_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
async function same(a,b){const encode=new TextEncoder();const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(String(s))));const [x,y]=await Promise.all([digest(a),digest(b)]);let n=0;for(let i=0;i<x.length;i++)n|=x[i]^y[i];return n===0;}
async function read(env,key){const object=await env.BUCKET.get(key);return object?object.json():null;}
async function put(env,key,value){await env.BUCKET.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}
async function authenticated(request,env){const id=cookie(request);if(!id)return false;const session=await read(env,'sessions/'+id);return !!session && session.expires>Date.now();}
async function revision(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,'0')).join('');}
const validType = type => Object.hasOwn(defaults,type);
async function config(env,type){return await read(env,'config/'+type+'.json') ?? defaults[type];}
async function save(env,type,value){const old=await config(env,type);const name=new Date().toISOString().replace(/[:.]/g,'-')+'-'+token().slice(0,8)+'-'+type+'.json';await put(env,'backups/'+name,old);await put(env,'config/'+type+'.json',value);return value;}
function validate(value){if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('Invalid configuration');for(const [key,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Invalid field');if(v&&typeof v==='object')validate(v);else if(typeof v!=='string'||v.length>20000)throw new Error('Invalid value');else if(/(?:url|href|image|poster|video)$/i.test(key)&&v && !/^(https?:\/\/|\.\/assets\/|\/uploads\/|#\/)/i.test(v))throw new Error('Use a website asset or an HTTPS URL');}return value;}
function validateBranches(value){
 if(!value.branches||Array.isArray(value.branches)||Object.keys(value.branches).length>50)throw new Error('Invalid branch list');
 for(const [slug,b]of Object.entries(value.branches)){
 if(!/^[a-z0-9-]+$/.test(slug)||slug.length>100)throw new Error('Invalid branch identifier');
 for(const key of ['name','churchName','subtitle','color','logo','image','summary','address','services','contact'])if(typeof b[key]!=='string'||b[key].length>5000)throw new Error('Invalid branch details');
 if(!b.name.trim()||!b.churchName.trim()||!/^#[0-9a-f]{6}$/i.test(b.color))throw new Error('Name, church name, and colour are required');
 for(const key of ['logo','image'])if(b[key]&&!/^(https:\/\/|\.\/assets\/images\/|\/uploads\/images\/)/.test(b[key]))throw new Error('Choose a valid branch image');
 for(const key of ['youtubeUrl','videoUrl','facebookUrl','instagramUrl'])if(b[key]){let url;try{url=new URL(b[key]);}catch{throw new Error('Enter a valid '+key);}if(url.protocol!=='https:')throw new Error('Use HTTPS links');if(key==='videoUrl'&&(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname)||!(/^[a-zA-Z0-9_-]{11}$/.test(url.searchParams.get('v')||url.pathname.match(/^\/(?:embed|live|shorts)\/([^/]+)/)?.[1]||(url.hostname==='youtu.be'?url.pathname.slice(1):'')))))throw new Error('Use a specific YouTube video or livestream link');}
 if(b.autoplay&&!['silent','click'].includes(b.autoplay))throw new Error('Invalid playback option');
 }return value;
}
function validatePastors(value) {
 const people=value.people;
 if(!people || Array.isArray(people) || typeof people!=='object' || Object.keys(people).length>50) throw new Error('Invalid pastor list');
 const clean={};
 for(const [id,p] of Object.entries(people)) {
  if(!/^pastor-[a-zA-Z0-9-]+$/.test(id) || !p || typeof p!=='object') throw new Error('Invalid pastor');
  for(const key of ['name','role','image','intro']) if(typeof p[key]!=='string') throw new Error('Invalid pastor field');
  if(!p.name.trim() || !p.role.trim() || p.name.length>150 || p.role.length>150 || p.intro.length>5000 || p.image.length>2000) throw new Error('Invalid pastor details');
  if(p.image && !/^(https:\/\/|\.\/assets\/images\/|\/uploads\/images\/)/.test(p.image)) throw new Error('Invalid pastor photo');
  clean[id]={name:p.name.trim(),role:p.role.trim(),image:p.image,intro:p.intro};
 }
 return {people:clean};
}
async function all(env,prefix){const result=[];let cursor;do{const page=await env.BUCKET.list({prefix,cursor});result.push(...page.objects);cursor=page.truncated?page.cursor:undefined;}while(cursor);return result;}
async function assetList(env){
 const uploads=(await all(env,'uploads/')).map(o=>({name:o.key.split('/').at(-1),path:'/'+o.key,type:o.key.startsWith('uploads/videos/')?'video':'image',source:'upload',size:o.size,modified:new Date(o.uploaded).getTime()}));
 const configs=await Promise.all(Object.keys(defaults).map(t=>config(env,t)));
 const refs=new Set(); const walk=v=>{if(typeof v==='string' && /^(\.\/assets\/|\/uploads\/)/.test(v))refs.add(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);}; configs.forEach(walk);
 const deleted=(await read(env,'config/deleted-assets.json'))?.paths||[];
 const protectedPaths=(await read(env,'config/asset-protection.json'))?.protected||[];
 const assets=[...uploads,...bundledAssets].filter(a=>!deleted.includes(a.path)).map(a=>{
  const used=refs.has(a.path)||bundledReferences.includes(a.path);
  const protection=used?'protected':protectedPaths.includes(a.path)?'user-protected':'unprotected';
  return {...a,protection,protected:protection!=='unprotected',deletable:protection==='unprotected'};
 });return {images:assets.filter(a=>a.type==='image'),videos:assets.filter(a=>a.type==='video')};
}
async function body(request){if(Number(request.headers.get('content-length')||0)>100000)throw new Error('Configuration too large');const raw=await request.text();if(raw.length>100000)throw new Error('Configuration too large');return JSON.parse(raw);}
const sessionCookie = value => `lpc_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${value?28800:0}`;
async function resolveLatestYouTubeVideo(channelUrl, handle) {
  const baseUrl = normalizeChannelUrl(channelUrl, handle);
  const live = await findFirstVideo(`${baseUrl}/streams`, true);
  if (live) return { ...live, mode: "Live now", channelUrl: baseUrl };

  const latest = await findFirstVideo(`${baseUrl}/streams?view=0&sort=dd&flow=grid`, false);
  if (!latest) throw new Error("No latest video found on channel live page");
  return { ...latest, mode: "Latest video", channelUrl: baseUrl };
}

function normalizeChannelUrl(channelUrl, handle) {
  if (channelUrl) {
    const url = new URL(channelUrl);
    if(url.protocol!=='https:'||!['www.youtube.com','youtube.com','m.youtube.com'].includes(url.hostname)||url.username||url.password||url.port)throw new Error('Use a YouTube channel URL');
    if(!/^\/(?:@[a-zA-Z0-9_.-]+|(?:c|channel|user)\/[a-zA-Z0-9_.-]+)(?:\/(?:videos|streams|live))?\/?$/.test(url.pathname))throw new Error('Use a channel URL');
    url.hostname='www.youtube.com';
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/(videos|streams|live)\/?$/, "").replace(/\/$/, "");
    return url.toString().replace(/\/$/, "");
  }

  if (!/^@?[a-zA-Z0-9_.-]+$/.test(handle||"")) throw new Error("Missing or invalid channel handle");
  return `https://www.youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}`;
}

async function findFirstVideo(url, requireLive) {
  const html = await fetchYouTubeHtml(url);
  const data = extractYtInitialData(html);
  const renderers = [];
  collectVideoRenderers(data, renderers);

  const selected = requireLive ? renderers.find(isLiveRenderer) : renderers[0];
  if (/^[a-zA-Z0-9_-]{11}$/.test(selected?.videoId||"")) {
    return withOembedMetadata({
      id: selected.videoId,
      title: textFromRuns(selected.title) || "Watch on YouTube",
      thumbnail: bestThumbnail(selected.thumbnail),
    });
  }

  const fallbackId = firstVideoIdFromHtml(html, requireLive);
  return fallbackId ? withOembedMetadata({ id: fallbackId }) : null;
}

async function fetchYouTubeHtml(url) {
  const response = await fetch(url, {
    signal:AbortSignal.timeout(8000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      "accept-language": "en-GB,en;q=0.9",
    },
  });

  if (!response.ok) throw new Error(`YouTube request failed: ${response.status}`);
  return response.text();
}

function extractYtInitialData(html) {
  const marker = "var ytInitialData = ";
  const start = html.indexOf(marker);
  if (start === -1) throw new Error("YouTube initial data not found");

  const jsonStart = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      escaped = char === "\\" && !escaped;
      if (char === "\"" && !escaped) inString = false;
      if (char !== "\\") escaped = false;
      continue;
    }

    if (char === "\"") inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0 && char === "}") return JSON.parse(html.slice(jsonStart, i + 1));
  }

  throw new Error("YouTube initial data was incomplete");
}

function collectVideoRenderers(value, output) {
  if (!value || typeof value !== "object") return;
  if (value.videoRenderer) output.push(value.videoRenderer);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") collectVideoRenderers(child, output);
  }
}

function isLiveRenderer(renderer) {
  const text = JSON.stringify(renderer.thumbnailOverlays || renderer.badges || renderer).toLowerCase();
  return text.includes('"style":"live"') || text.includes('"text":"live"') || text.includes("watching now");
}

function textFromRuns(value) {
  if (!value) return "";
  if (value.simpleText) return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text || "").join("");
  return "";
}

function bestThumbnail(value) {
  const thumbnails = value?.thumbnails || [];
  return thumbnails.at(-1)?.url || thumbnails[0]?.url || "";
}

function firstVideoIdFromHtml(html, requireLive) {
  const ids = [...html.matchAll(/"videoId":"([^"]+)"/g)];
  const seen = new Set();

  for (const match of ids) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);

    if (!requireLive) return id;

    const start = Math.max(0, match.index - 2500);
    const end = Math.min(html.length, match.index + 2500);
    if (html.slice(start, end).toLowerCase().includes('"style":"live"')) return id;
  }

  return null;
}

async function withOembedMetadata(video) {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${video.id}&format=json`,
    );
    if (!response.ok) return withDefaultThumbnail(video);
    const data = await response.json();
    return {
      id: video.id,
      title: data.title || video.title || "Watch on YouTube",
      thumbnail: data.thumbnail_url || video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    };
  } catch (error) {
    return withDefaultThumbnail(video);
  }
}

function withDefaultThumbnail(video) {
  return {
    id: video.id,
    title: video.title || "Watch on YouTube",
    thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
  };
}


export default {async fetch(request,env){
 if(new URL(request.url).pathname==='/api/calendar/events'){try{return json(await calendarEvents(env.LPC_CALENDAR_ICS_URL));}catch{return json({error:'Calendar temporarily unavailable'},503);}}

 const url=new URL(request.url),path=url.pathname;
 try {
  if(path.startsWith('/api/')){
   if(!env.BUCKET)return json({error:'Admin storage is temporarily unavailable'},503);
   if(!['GET','HEAD'].includes(request.method)){
    if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Invalid request origin'},403);
   }
   if(path==='/api/admin/session')return json({authenticated:await authenticated(request,env),username:env.LPC_ADMIN_USERNAME||'admin'});
   if(path==='/api/admin/login'&&request.method==='POST'){
    if(!env.LPC_ADMIN_PASSWORD||!env.LPC_ADMIN_USERNAME)return json({error:'Admin sign-in has not been configured'},503);
    const ip=request.headers.get('cf-connecting-ip')||'unknown';const key='attempts/'+encodeURIComponent(ip);const previous=await read(env,key);const attempts=previous&&previous.until>Date.now()?previous:{count:0,until:Date.now()+15*60*1000};
    if(attempts.count>=10)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
    const input=await body(request);const matches=await same(input.password||'',env.LPC_ADMIN_PASSWORD);
    if(input.username!==env.LPC_ADMIN_USERNAME||!matches){await put(env,key,{...attempts,count:attempts.count+1});return json({error:'Invalid username or password'},401);}
    await env.BUCKET.delete(key);const id=token();await put(env,'sessions/'+id,{expires:Date.now()+28800000});return json({authenticated:true,username:env.LPC_ADMIN_USERNAME},200,{'set-cookie':sessionCookie(id)});
   }
   if(path==='/api/admin/logout'&&request.method==='POST'){const id=cookie(request);if(id)await env.BUCKET.delete('sessions/'+id);return json({authenticated:false},200,{'set-cookie':sessionCookie('')});}
   const type=path.slice('/api/'.length);
   if(validType(type)&&request.method==='GET'){const value=await config(env,type);return json(value,200,{'x-config-revision':await revision(value)});}
   if(path==='/api/youtube/latest'&&request.method==='GET'){
    try{const base=normalizeChannelUrl(url.searchParams.get('channelUrl'),url.searchParams.get('handle'));const key='youtube-cache/'+await revision({base});const cached=await read(env,key);if(cached?.expires>Date.now())return json(cached.video);
    try{const video=await resolveLatestYouTubeVideo(base,null);await put(env,key,{video,expires:Date.now()+600000});return json(video);}catch(error){return json(cached?.video??null);}
    }catch(error){return json({error:error.message},400);}
   }
   if(!await authenticated(request,env))return json({error:'Not authenticated'},401);
   if(validType(type)&&request.method==='POST'){
    const input=await body(request);
    if(type==='branches' && input.baseRevision!==await revision(await config(env,type)))return json({error:'Branch details changed or were not loaded safely. Reload this page before saving.'},409);
    let value=validate(type==='branches'?{branches:input.branches}:input);
    if(type==='image-framing') {
     const assets=await assetList(env);const paths=new Set(assets.images.map(a=>a.path));
     for(const [path,frame]of Object.entries(value)) {
      if(!paths.has(path)||!frame||!['cover','contain'].includes(frame.fit)||!['x','y'].every(key=>typeof frame[key]==='string'&&/^\d{1,3}$/.test(frame[key])&&Number(frame[key])<=100))return json({error:'Choose a valid image and framing'},400);
     }
     for(const frame of Object.values(value))if(frame.offsetY!==undefined && (typeof frame.offsetY!=='string'||! /^-?\d{1,3}$/.test(frame.offsetY)||Math.abs(Number(frame.offsetY))>150))return json({error:'Image shift must be between -150 and 150 pixels'},400);
     value={...await config(env,type),...value};
    }
    if(type==='branches') {try{value=validateBranches(value);}catch(error){return json({error:error.message},400);}}
    if(type==='pastors') { try { value=validatePastors(value); } catch(error) { return json({error:error.message},400); } }
    if(type==='hero-images'){const existing=await config(env,type);for(const [k,v]of Object.entries(value))existing[k]={...existing[k],...v};value=existing;}
    const saved=await save(env,type,value);return json(saved,200,{'x-config-revision':await revision(saved)});
   }
   if(path==='/api/assets'&&request.method==='GET')return json(await assetList(env));
   if(path==='/api/assets/upload'&&request.method==='POST'){
    const limit=24*1024*1024;if(Number(request.headers.get('content-length')||0)>limit)return json({error:'Please upload a file smaller than 24 MB'},413);
    // Bound buffering before parsing multipart input in the Worker.
    const reader=request.body.getReader(),chunks=[];let size=0;while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>limit){await reader.cancel();return json({error:'Please upload a file smaller than 24 MB'},413);}chunks.push(chunk.value);}
    const form=await new Response(new Blob(chunks),{headers:{'content-type':request.headers.get('content-type')}}).formData();const file=form.get('file');if(!file||typeof file==='string')return json({error:'Choose a file'},400);
    const ext=file.name.split('.').at(-1).toLowerCase();const mimes={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',m4v:'video/mp4'};if(!mimes[ext])return json({error:'Use JPG, PNG, WebP, MP4, WebM, MOV or M4V'},400);
    const kind=mimes[ext].startsWith('video')?'video':'image';const name=token().slice(0,12)+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const key=`uploads/${kind}s/${name}`;await env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:mimes[ext]}});return json({name,path:'/'+key,type:kind,modified:Date.now()});
   }
   if(['/api/assets/delete','/api/assets/protection'].includes(path)&&request.method==='POST'){
    const input=await body(request);const assets=await assetList(env);const asset=[...assets.images,...assets.videos].find(a=>a.path===input.path);if(!asset)return json({error:'Asset not found'},404);
    if(path.endsWith('/delete')){if(!asset.deletable)return json({error:'This asset is protected'},409);if(asset.source==='upload') await env.BUCKET.delete(asset.path.slice(1));
     else {const deleted=await read(env,'config/deleted-assets.json')||{paths:[]};deleted.paths=[...new Set([...deleted.paths,asset.path])];await put(env,'config/deleted-assets.json',deleted);}
     return json({deleted:true,storageFreed:asset.source==='upload'});}
    if(asset.protection==='protected'&&!input.protected)return json({error:'This asset is used by the website and remains protected'},409);
    const paths=new Set((await read(env,'config/asset-protection.json'))?.protected||[]);if(input.protected)paths.add(asset.path);else paths.delete(asset.path);const result={protected:[...paths]};await put(env,'config/asset-protection.json',result);return json(result);
   }
   if(path==='/api/admin/branches/recovery' && request.method==='GET') {
    const current=await config(env,'branches');const recovered=structuredClone(current);const changes=[];
    const stored=(await all(env,'backups/')).filter(o=>o.key.endsWith('-branches.json')).map(o=>o.key.slice(8));
    const names=[...new Set([...stored,...Object.keys(bundledBackups).filter(n=>n.endsWith('-branches.json'))])].sort().reverse();
    for(const name of names){const backup=await read(env,'backups/'+name)??bundledBackups[name];
     for(const [slug,b]of Object.entries(recovered.branches)){for(const field of ['address','services','contact']){const old=backup?.branches?.[slug]?.[field];if(!b[field]?.trim()&&typeof old==='string'&&old.trim()){b[field]=old;changes.push({slug,branch:b.name,field,value:old,backup:name});}}}
    }
    return json({baseRevision:await revision(current),branches:recovered.branches,changes,backupsChecked:names.length});
   }
   if(path==='/api/admin/config-backups'&&request.method==='GET'){
    const type=url.searchParams.get('type')||'hero-images';if(!validType(type))return json({error:'Invalid configuration type'},400);
    const stored=(await all(env,'backups/')).filter(o=>o.key.endsWith('-'+type+'.json')).map(o=>({name:o.key.slice(8),size:o.size,modified:new Date(o.uploaded).toISOString(),summary:{}}));
    const bundled=Object.keys(bundledBackups).filter(n=>n.endsWith('-'+type+'.json')).map(name=>({name,size:JSON.stringify(bundledBackups[name]).length,modified:name.slice(0,10),summary:{}}));return json({type,backups:[...stored,...bundled].sort((a,b)=>b.name.localeCompare(a.name))});
   }
   if(path==='/api/admin/config-backups/restore'&&request.method==='POST'){
    const {type,name}=await body(request);if(!validType(type)||typeof name!=='string'||name.includes('/')||!name.endsWith('-'+type+'.json'))return json({error:'Invalid backup'},400);const value=await read(env,'backups/'+name)??bundledBackups[name];if(!value)return json({error:'Backup not found'},404);return json({type,restoredFrom:name,config:await save(env,type,value)});
   }
   return json({error:'Not found'},404);
  }
  if(path.startsWith('/assets/images/') || path.startsWith('/assets/videos/')) {
   const deleted=(await read(env,'config/deleted-assets.json'))?.paths||[];
   if(deleted.includes('.'+decodeURIComponent(path))) return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
  }
  if(path.startsWith('/uploads/')){
   const object=await env.BUCKET.get(decodeURIComponent(path.slice(1)),{range:request.headers});if(!object)return new Response('Not found',{status:404});const headers=new Headers({'x-content-type-options':'nosniff','cache-control':'public,max-age=3600','accept-ranges':'bytes'});object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);let status=200;if(object.range){status=206;headers.set('content-range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);}return new Response(object.body,{status,headers});
  }
  // Serve the application shell for direct URLs; all APIs remain server-authorized.
  if(/^\/(?:admin|lpcadmin)(?:\/|$)/.test(path)||path==='/'||/^\/(about|ministries|youth|branches|pastors|watch|contact|plan-your-visit)(\/.*)?$/.test(path)){
   const response=await env.ASSETS.fetch(new Request(new URL('/index.html',url),request));const headers=new Headers(response.headers);headers.set('cache-control','no-cache');if(/^\/(admin|lpcadmin)/.test(path))headers.set('x-robots-tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers});
  }
  if(path.startsWith('/assets/data/backups/'))return new Response('Not found',{status:404});
  return env.ASSETS.fetch(request);
 }catch(error){console.error('LPC request failed',error.message);return json({error:request.method==='GET'?'Unable to load this content. Please try again.':'The change could not be saved. Please try again.'},500);}
}};
