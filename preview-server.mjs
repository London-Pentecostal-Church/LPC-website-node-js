import { accountMailConfigured, sendAccountMail } from './worker/account-mail.mjs';
import { handleVolunteers } from './worker/volunteers.mjs';
import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile, rename } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { calendarEvents } from './worker/calendar.mjs';
import { sendContact } from './worker/contact-mail.mjs';
const contactAttempts=new Map();
const volunteerRoot = process.env.DATA_DIR ? resolve(process.env.DATA_DIR, 'volunteer-private') : resolve(import.meta.dirname, '.private-volunteers');
let volunteerQueue = Promise.resolve();
async function volunteerRead(file) { try { return JSON.parse(await readFile(join(volunteerRoot,file+'.json'),'utf8')); } catch(error) { if(error.code==='ENOENT') return null; throw error; } }
async function volunteerWrite(file,value) { await mkdir(volunteerRoot,{recursive:true}); const target=join(volunteerRoot,file+'.json'), temp=target+'.tmp'; await writeFile(temp,JSON.stringify(value),{mode:0o600}); await rename(temp,target); }


const root = resolve(import.meta.dirname);
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const bundledDataRoot = join(root, "assets", "data");
const dataRoot = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : bundledDataRoot;
const homeHeroConfigPath = join(dataRoot, "home-hero.json");
const heroImagesConfigPath = join(dataRoot, "hero-images.json");
const pastorThoughtConfigPath = join(dataRoot, "pastor-thought.json");
const siteSettingsConfigPath = join(dataRoot, "site-settings.json");
const assetProtectionConfigPath = join(dataRoot, "asset-protection.json");
const uploadsRoot = join(dataRoot, "uploads");
const backupRoot = join(dataRoot, "backups");
const adminUsername = process.env.LPC_ADMIN_USERNAME || "admin";
const adminPassword = process.env.LPC_ADMIN_PASSWORD || "lpc2026";
const adminSessionSecret = process.env.LPC_ADMIN_SESSION_SECRET || `${adminUsername}:${adminPassword}`;
const sessions = new Set();
const revokedSessions = new Set();
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 120 * 1024 * 1024);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);
const videoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if(url.pathname.startsWith('/api/volunteers')) {
      let raw; try { raw=['GET','HEAD'].includes(request.method)?undefined:await readLimitedBody(request,150000); } catch {sendJson(response,413,{error:'Request too large'});return;}
      const headers=new Headers(request.headers); headers.delete('cf-connecting-ip'); headers.set('x-volunteer-client',request.socket.remoteAddress||'unknown');
      const protocol=request.socket.encrypted?'https:':(process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN).protocol:request.headers['x-forwarded-proto']==='https'?'https:':'http:');
      const apiRequest=new Request(protocol+'//'+request.headers.host+url.pathname+url.search,{method:request.method,headers,body:raw});
      const execute=()=>handleVolunteers(apiRequest,{emailReady:accountMailConfigured(process.env),sendAccountMail:message=>sendAccountMail(process.env,message),getState:()=>volunteerRead('state'),saveState:async(value,expected)=>{const previous=await volunteerRead('state');if((previous?.revision||0)!==expected)throw Object.assign(new Error('Schedule changed. Reload before saving.'),{status:409});await volunteerWrite('state',value);},getKey:volunteerRead,putKey:volunteerWrite},isAuthenticated(request)?{id:'admin',name:adminUsername,admin:true}:null);
      const result=await (volunteerQueue=volunteerQueue.catch(()=>{}).then(execute)); response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));return;
    }
    if(url.pathname==='/api/contact'){
      if(request.method!=='POST'){sendJson(response,405,{error:'Method not allowed'});return;}
      if(!['http:','https:'].some(protocol=>request.headers.origin===protocol+'//'+request.headers.host)||request.headers['sec-fetch-site']==='cross-site'){sendJson(response,403,{error:'Invalid request origin'});return;}
      const ip=request.socket.remoteAddress,now=Date.now();for(const [key,value]of contactAttempts)if(value.until<now)contactAttempts.delete(key);
      const attempt=contactAttempts.get(ip)||{count:0,until:now+600000};if(attempt.count>=5){sendJson(response,429,{error:'Please wait a few minutes before trying again.'});return;}attempt.count++;contactAttempts.set(ip,attempt);
      let raw='',size=0;for await(const chunk of request){size+=chunk.length;if(size>16000){sendJson(response,413,{error:'Message is too large'});return;}raw+=chunk;}
      let input;try{input=JSON.parse(raw);}catch{sendJson(response,400,{error:'Invalid message'});return;}
      if(input.website){sendJson(response,200,{sent:true});return;}
      try{const result=await sendContact(input);sendJson(response,result.status,result);}catch(error){sendJson(response,error.message.startsWith('Enter your name')?400:502,{error:error.message.startsWith('Enter your name')?error.message:'Email could not be sent. Please try again or email office@londonpentecostalchurch.org.'});}return;
    }

    if (url.pathname === '/api/calendar/events') {
      try { sendJson(response, 200, await calendarEvents(process.env.LPC_CALENDAR_ICS_URL)); }
      catch { sendJson(response, 503, {error:'Calendar temporarily unavailable'}); }
      return;
    }
    if (url.pathname === "/api/youtube/latest") {
      const channelUrl = url.searchParams.get("channelUrl");
      const handle = url.searchParams.get("handle");
      const result = await resolveLatestYouTubeVideo(channelUrl, handle);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/api/home-hero") {
      if (request.method === "GET") {
        sendJson(response, 200, await readHomeHeroConfig());
        return;
      }

      if (request.method === "POST") {
        if (!isAuthenticated(request)) {
          sendJson(response, 401, { error: "Not authenticated" });
          return;
        }
        const body = await readJsonBody(request);
        const config = normalizeHomeHeroConfig(body);
        await writeConfigWithBackup(homeHeroConfigPath, config);
        sendJson(response, 200, config);
        return;
      }

      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    if (url.pathname === "/api/hero-images") {
      if (request.method === "GET") {
        sendJson(response, 200, await readHeroImagesConfig());
        return;
      }

      if (request.method === "POST") {
        if (!isAuthenticated(request)) {
          sendJson(response, 401, { error: "Not authenticated" });
          return;
        }
        const existing = await readHeroImagesConfig();
        const incoming = normalizeHeroImagesPatch(await readJsonBody(request));
        const config = mergeHeroImagesConfig(existing, incoming);
        await writeConfigWithBackup(heroImagesConfigPath, config);
        sendJson(response, 200, config);
        return;
      }

      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    if (url.pathname === "/api/pastor-thought") {
      if (request.method === "GET") {
        sendJson(response, 200, await readPastorThoughtConfig());
        return;
      }

      if (request.method === "POST") {
        if (!isAuthenticated(request)) {
          sendJson(response, 401, { error: "Not authenticated" });
          return;
        }
        const config = normalizePastorThoughtConfig(await readJsonBody(request));
        await writeConfigWithBackup(pastorThoughtConfigPath, config);
        sendJson(response, 200, config);
        return;
      }

      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    if(url.pathname==='/api/page-images'){
      const configPath=join(dataRoot,'page-images.json');
      if(request.method==='GET'){sendJson(response,200,existsSync(configPath)?await readJsonFile(configPath):{});return;}
      if(request.method!=='POST'){sendJson(response,405,{error:'Method not allowed'});return;}
      if(!isAuthenticated(request)){sendJson(response,401,{error:'Not authenticated'});return;}
      const input=await readJsonBody(request),library=await listAdminAssets(),paths=new Set(library.images.map(image=>image.path));
      if(!input||typeof input!=='object'||Array.isArray(input)){sendJson(response,400,{error:'Invalid page images'});return;}
      for(const [page,slots]of Object.entries(input)){if(!['/home','/about','/ministries','/youth','/plan-your-visit','/watch','/contact'].includes(page)||!slots||typeof slots!=='object'||Array.isArray(slots)||Object.values(slots).some(path=>!paths.has(path))){sendJson(response,400,{error:'Choose a library image for each page'});return;}}
      await writeConfigWithBackup(configPath,input);sendJson(response,200,input);return;
    }
    if(url.pathname==='/api/image-framing'){
      const configPath=join(dataRoot,'image-framing.json');
      const current=existsSync(configPath)?await readJsonFile(configPath):{};
      if(request.method==='GET'){sendJson(response,200,current);return;}
      if(request.method!=='POST'){sendJson(response,405,{error:'Method not allowed'});return;}
      if(!isAuthenticated(request)){sendJson(response,401,{error:'Not authenticated'});return;}
      const input=await readJsonBody(request),library=await listAdminAssets(),paths=new Set(library.images.map(item=>item.path));
      if(!input||typeof input!=='object'||Array.isArray(input)){sendJson(response,400,{error:'Invalid image framing'});return;}
      for(const [path,frame]of Object.entries(input)){
        if(!paths.has(path)||!frame||!['cover','contain'].includes(frame.fit)||!['x','y'].every(key=>typeof frame[key]==='string'&&/^\d{1,3}$/.test(frame[key])&&Number(frame[key])<=100)||(frame.offsetY!==undefined&&(typeof frame.offsetY!=='string'||! /^-?\d{1,3}$/.test(frame.offsetY)||Math.abs(Number(frame.offsetY))>150))){sendJson(response,400,{error:'Choose a valid image and framing settings'});return;}
      }
      const saved={...current,...input};await writeConfigWithBackup(configPath,saved);sendJson(response,200,saved);return;
    }
    if (url.pathname === '/api/branches' || url.pathname === '/api/admin/branches/recovery') {
      const configPath=join(dataRoot,'branches.json');
      const current=await readJsonFile(configPath);
      const revision=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
      if(url.pathname.endsWith('/recovery')) {
        if(!isAuthenticated(request)){sendJson(response,401,{error:'Not authenticated'});return;}
        const recovered=structuredClone(current),changes=[];
        const names=existsSync(backupRoot)?(await readdir(backupRoot)).filter(name=>name.endsWith('-branches.json')).sort().reverse():[];
        for(const name of names){const backup=await readJsonFile(join(backupRoot,name));for(const [slug,b]of Object.entries(recovered.branches)){for(const field of ['address','services','contact']){const old=backup?.branches?.[slug]?.[field];if(!b[field]?.trim()&&typeof old==='string'&&old.trim()){b[field]=old;changes.push({slug,branch:b.name,field,value:old,backup:name});}}}}
        sendJson(response,200,{baseRevision:revision(current),branches:recovered.branches,changes,backupsChecked:names.length});return;
      }
      if(request.method==='GET'){response.setHeader('x-config-revision',revision(current));sendJson(response,200,current);return;}
      if(request.method==='POST'){
        if(!isAuthenticated(request)){sendJson(response,401,{error:'Not authenticated'});return;}
        const input=await readJsonBody(request);
        if(input.baseRevision!==revision(current)){sendJson(response,409,{error:'Branch details changed. Reload before saving.'});return;}
        let value;try{value=validateBranches({branches:input.branches});}catch(error){sendJson(response,400,{error:error.message});return;}
        await writeConfigWithBackup(configPath,value);response.setHeader('x-config-revision',revision(value));sendJson(response,200,value);return;
      }
      response.writeHead(405);response.end();return;
    }
    if (url.pathname === "/api/pastors") {
      const configPath = join(dataRoot, "pastors.json");
      if(request.method === "GET") { sendJson(response,200,JSON.parse(await readFile(configPath,"utf8"))); return; }
      if(request.method === "POST") {
        if (!isAuthenticated(request)) { sendJson(response,401,{error:"Not authenticated"}); return; }
        const value = await readJsonBody(request);
        if(!value.people || Array.isArray(value.people)) { sendJson(response,400,{error:"Invalid pastor list"}); return; }
        await writeConfigWithBackup(configPath,value); sendJson(response,200,value); return;
      }
      response.writeHead(405); response.end(); return;
    }
    if (url.pathname === "/api/site-settings") {
      if (request.method === "GET") {
        sendJson(response, 200, await readSiteSettingsConfig());
        return;
      }

      if (request.method === "POST") {
        if (!isAuthenticated(request)) {
          sendJson(response, 401, { error: "Not authenticated" });
          return;
        }
        const config = normalizeSiteSettingsConfig(await readJsonBody(request));
        await writeConfigWithBackup(siteSettingsConfigPath, config);
        sendJson(response, 200, config);
        return;
      }

      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    if (url.pathname === "/api/assets") {
      if (request.method !== "GET") {
        response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
        response.end("Method not allowed");
        return;
      }

      sendJson(response, 200, await listAdminAssets());
      return;
    }

    if (url.pathname === "/api/assets/upload") {
      if (request.method !== "POST") {
        response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
        response.end("Method not allowed");
        return;
      }
      if (!isAuthenticated(request)) {
        sendJson(response, 401, { error: "Not authenticated" });
        return;
      }

      sendJson(response, 200, await handleAssetUpload(request));
      return;
    }

    if (url.pathname === "/api/assets/delete") {
      if (request.method !== "POST") {
        response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
        response.end("Method not allowed");
        return;
      }
      if (!isAuthenticated(request)) {
        sendJson(response, 401, { error: "Not authenticated" });
        return;
      }

      const body = await readJsonBody(request);
      await deleteUploadedAsset(String(body?.path || ""));
      sendJson(response, 200, { deleted: true });
      return;
    }

    if (url.pathname === "/api/assets/protection") {
      if (request.method !== "POST") {
        response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
        response.end("Method not allowed");
        return;
      }
      if (!isAuthenticated(request)) {
        sendJson(response, 401, { error: "Not authenticated" });
        return;
      }

      const body = await readJsonBody(request);
      sendJson(response, 200, await updateAssetProtection(String(body?.path || ""), Boolean(body?.protected)));
      return;
    }

    if (url.pathname === "/api/admin/config-backups") {
      if (!isAuthenticated(request)) {
        sendJson(response, 401, { error: "Not authenticated" });
        return;
      }

      if (request.method === "GET") {
        const type = url.searchParams.get("type") || "hero-images";
        sendJson(response, 200, await listConfigBackups(type));
        return;
      }

      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    if (url.pathname === "/api/admin/config-backups/restore") {
      if (!isAuthenticated(request)) {
        sendJson(response, 401, { error: "Not authenticated" });
        return;
      }

      if (request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await restoreConfigBackup(body?.type || "hero-images", body?.name || ""));
        return;
      }

      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    if (url.pathname === "/api/admin/session") {
      sendJson(response, 200, { authenticated: isAuthenticated(request), username: adminUsername });
      return;
    }

    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      const body = await readJsonBody(request);
      if (body?.username === adminUsername && body?.password === adminPassword) {
        const token = createAdminSessionToken();
        sessions.add(token);
        response.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "set-cookie": `lpc_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`,
        });
        response.end(JSON.stringify({ authenticated: true, username: adminUsername }));
        return;
      }
      sendJson(response, 401, { error: "Invalid username or password" });
      return;
    }

    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      const token = getCookie(request, "lpc_admin");
      if (token) sessions.delete(token);
      if (token) revokedSessions.add(token);
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": "lpc_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      });
      response.end(JSON.stringify({ authenticated: false }));
      return;
    }

    if (url.pathname.startsWith("/uploads/")) {
      await serveUploaded(url.pathname, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
  }
}).listen(port, host, () => {
  console.log(`Preview started: http://${host}:${port}/`);
});

async function readHomeHeroConfig() {
  try {
    return normalizeHomeHeroConfig(await readConfigFile(homeHeroConfigPath, "home-hero.json"));
  } catch {
    return normalizeHomeHeroConfig({});
  }
}

async function readHeroImagesConfig() {
  try {
    return normalizeHeroImagesConfig(await readConfigFile(heroImagesConfigPath, "hero-images.json"));
  } catch {
    return normalizeHeroImagesConfig({});
  }
}

async function readPastorThoughtConfig() {
  try {
    return normalizePastorThoughtConfig(await readConfigFile(pastorThoughtConfigPath, "pastor-thought.json"));
  } catch {
    return normalizePastorThoughtConfig({});
  }
}

async function readSiteSettingsConfig() {
  try {
    return normalizeSiteSettingsConfig(await readConfigFile(siteSettingsConfigPath, "site-settings.json"));
  } catch {
    return normalizeSiteSettingsConfig({});
  }
}

async function readAssetProtectionConfig() {
  try {
    return normalizeAssetProtectionConfig(await readConfigFile(assetProtectionConfigPath, "asset-protection.json"));
  } catch {
    return normalizeAssetProtectionConfig({});
  }
}

async function readConfigFile(filePath, bundledFileName) {
  try {
    return await readJsonFile(filePath);
  } catch (error) {
    const bundledPath = join(bundledDataRoot, bundledFileName);
    if (normalize(filePath) !== normalize(bundledPath)) return readJsonFile(bundledPath);
    throw error;
  }
}

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function normalizeAssetProtectionConfig(config) {
  return {
    protected: [...new Set((Array.isArray(config?.protected) ? config.protected : []).map((path) => String(path || "").trim()).filter(Boolean))].sort(),
  };
}

async function listAdminAssets() {
  const [bundledImages, bundledVideos, uploadedImages, uploadedVideos, protection, referencedPaths] = await Promise.all([
    listAssetsInFolder(join(root, "assets", "images"), imageExtensions, "image"),
    listAssetsInFolder(join(root, "assets", "videos"), videoExtensions, "video"),
    listAssetsInFolder(join(uploadsRoot, "images"), imageExtensions, "image", "/uploads/images"),
    listAssetsInFolder(join(uploadsRoot, "videos"), videoExtensions, "video", "/uploads/videos"),
    readAssetProtectionConfig(),
    referencedAssetPaths(),
  ]);
  const protectedPaths = new Set(protection.protected);
  const decorate = (item) => decorateAssetItem(item, referencedPaths, protectedPaths);
  return {
    images: [...uploadedImages, ...bundledImages].map(decorate).sort(sortAssetsByModified),
    videos: [...uploadedVideos, ...bundledVideos].map(decorate).sort(sortAssetsByModified),
  };
}

async function listAssetsInFolder(folderPath, allowedExtensions, type, publicPrefix = "") {
  if (!existsSync(folderPath)) return [];
  const found = [];

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await walk(entryPath);
          return;
        }
        if (!entry.isFile()) return;
        const extension = extname(entry.name).toLowerCase();
        if (!allowedExtensions.has(extension)) return;
        const fileStat = await stat(entryPath);
        const relativePath = normalize(entryPath.slice(folderPath.length + 1)).replaceAll("\\", "/");
        const publicPath = publicPrefix
          ? `${publicPrefix}/${relativePath}`
          : `./${normalize(entryPath.slice(root.length + 1)).replaceAll("\\", "/")}`;
        found.push({
          type,
          name: entry.name,
          path: publicPath,
          modified: fileStat.mtimeMs,
          source: publicPrefix ? "upload" : "asset",
        });
      }),
    );
  }

  await walk(folderPath);
  return found.sort(sortAssetsByModified);
}

function sortAssetsByModified(a, b) {
  return b.modified - a.modified || a.path.localeCompare(b.path);
}

function decorateAssetItem(item, referencedPaths, userProtectedPaths) {
  const systemProtected = referencedPaths.has(item.path);
  const userProtected = userProtectedPaths.has(item.path);
  const protection = systemProtected ? "protected" : userProtected ? "user-protected" : "unprotected";
  return {
    ...item,
    protection,
    protected: protection !== "unprotected",
    deletable: protection === "unprotected",
    protectionLabel:
      protection === "protected" ? "Protected Asset" : protection === "user-protected" ? "User protected" : "Unprotected",
  };
}

async function handleAssetUpload(request) {
  const contentType = request.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Upload must use multipart form data");

  const body = await readLimitedBody(request, maxUploadBytes);
  const file = parseMultipartFile(body, boundaryMatch[1] || boundaryMatch[2]);
  const extension = extname(file.filename).toLowerCase();
  const uploadType = videoExtensions.has(extension) || file.mimeType.startsWith("video/") ? "video" : "image";
  const allowedExtensions = uploadType === "video" ? videoExtensions : imageExtensions;
  if (!allowedExtensions.has(extension)) {
    throw new Error(`Unsupported ${uploadType} file type`);
  }

  const folderName = uploadType === "video" ? "videos" : "images";
  const uploadFolder = join(uploadsRoot, folderName);
  await mkdir(uploadFolder, { recursive: true });
  const safeName = uniqueUploadName(file.filename);
  const filePath = join(uploadFolder, safeName);
  await writeFile(filePath, file.data);
  const fileStat = await stat(filePath);

  return {
    type: uploadType,
    name: safeName,
    path: `/uploads/${folderName}/${safeName}`,
    modified: fileStat.mtimeMs,
  };
}

async function updateAssetProtection(publicPath, shouldProtect) {
  const normalizedPath = normalizePublicAssetPath(publicPath);
  if (!normalizedPath) throw new Error("Invalid asset path");
  const filePath = resolvePublicAssetFilePath(normalizedPath);
  if (!existsSync(filePath)) throw new Error("Asset was not found");

  const referencedPaths = await referencedAssetPaths();
  if (referencedPaths.has(normalizedPath) && !shouldProtect) {
    throw new Error("This asset is used by the website JSON and remains protected automatically");
  }

  const config = await readAssetProtectionConfig();
  const protectedPaths = new Set(config.protected);
  if (shouldProtect) protectedPaths.add(normalizedPath);
  else protectedPaths.delete(normalizedPath);

  const nextConfig = normalizeAssetProtectionConfig({ protected: [...protectedPaths] });
  await writeConfigWithBackup(assetProtectionConfigPath, nextConfig);
  return {
    path: normalizedPath,
    protected: shouldProtect,
    config: nextConfig,
  };
}

async function referencedAssetPaths() {
  const configs = await Promise.all([
    readHomeHeroConfig(),
    readHeroImagesConfig(),
    readPastorThoughtConfig(),
    readSiteSettingsConfig(),
  ]);
  const values = [];
  collectStringValues(configs, values);
  return new Set(values.filter(isPublicAssetPath));
}

function collectStringValues(value, output) {
  if (typeof value === "string") {
    output.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStringValues(item, output));
  }
}

function isPublicAssetPath(value) {
  return (
    (value.startsWith("./assets/") || value.startsWith("/uploads/")) &&
    [...imageExtensions, ...videoExtensions].some((extension) => value.toLowerCase().split("?")[0].endsWith(extension))
  );
}

function normalizePublicAssetPath(publicPath) {
  const value = String(publicPath || "").trim();
  return isPublicAssetPath(value) ? value : "";
}

function resolvePublicAssetFilePath(publicPath) {
  if (publicPath.startsWith("/uploads/images/") || publicPath.startsWith("/uploads/videos/")) {
    const requested = decodeURIComponent(publicPath.replace(/^\/uploads\//, ""));
    const filePath = normalize(join(uploadsRoot, requested));
    if (!filePath.startsWith(uploadsRoot)) throw new Error("Invalid upload path");
    return filePath;
  }

  if (publicPath.startsWith("./assets/images/") || publicPath.startsWith("./assets/videos/")) {
    const requested = decodeURIComponent(publicPath.replace(/^\.\//, ""));
    const filePath = normalize(join(root, requested));
    const assetsRoot = normalize(join(root, "assets"));
    if (!filePath.startsWith(assetsRoot)) throw new Error("Invalid asset path");
    return filePath;
  }

  throw new Error("Invalid asset path");
}

async function readLimitedBody(request, limitBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limitBytes) throw new Error("Upload is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipartFile(body, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let position = body.indexOf(boundaryBuffer);

  while (position !== -1) {
    const next = body.indexOf(boundaryBuffer, position + boundaryBuffer.length);
    if (next === -1) break;
    parts.push(body.subarray(position + boundaryBuffer.length, next));
    position = next;
  }

  for (const rawPart of parts) {
    let part = rawPart;
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.subarray(0, 2).toString() === "--") continue;
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString("utf8");
    const disposition = headers.match(/content-disposition:.*name="file".*filename="([^"]+)"/i);
    if (!disposition) continue;
    const mimeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
    let data = part.subarray(headerEnd + 4);
    if (data.subarray(-2).toString() === "\r\n") data = data.subarray(0, -2);
    if (!data.length) throw new Error("Upload file is empty");
    return {
      filename: disposition[1],
      mimeType: mimeMatch ? mimeMatch[1].trim().toLowerCase() : "",
      data,
    };
  }

  throw new Error("No upload file was found");
}

function uniqueUploadName(filename) {
  const extension = extname(filename).toLowerCase();
  const base = filename
    .slice(0, filename.length - extension.length)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 70);
  return `${base || "media"}-${Date.now().toString(36)}${extension}`;
}

async function deleteUploadedAsset(publicPath) {
  const normalizedPath = normalizePublicAssetPath(publicPath);
  if (!normalizedPath) throw new Error("Invalid asset path");
  const [referencedPaths, protection] = await Promise.all([referencedAssetPaths(), readAssetProtectionConfig()]);
  if (referencedPaths.has(normalizedPath)) throw new Error("This asset is used by the website JSON and cannot be deleted");
  if (protection.protected.includes(normalizedPath)) {
    throw new Error("This asset is user protected. Unprotect it before deleting");
  }
  const filePath = resolvePublicAssetFilePath(normalizedPath);
  if (existsSync(filePath)) await rm(filePath, { force: true });
}

function normalizeHomeHeroConfig(config) {
  return {
    video: String(config?.video || "").trim(),
    poster: String(config?.poster || "./assets/images/derived/hero-crowd-plain.jpg").trim(),
    focal: String(config?.focal || "center 42%").trim(),
    mobileFocal: String(config?.mobileFocal || "center 38%").trim(),
    scale: String(config?.scale || "1").trim(),
    mobileScale: String(config?.mobileScale || config?.scale || "1").trim(),
    fit: normalizeFitMode(config?.fit),
    mobileFit: normalizeFitMode(config?.mobileFit || config?.fit),
    label: String(config?.label || "Regular church events").trim(),
    title: String(config?.title || "LPC worship, baptism, prayer, and fellowship").trim(),
  };
}

function normalizeHeroImagesConfig(config) {
  const normalized = {};
  for (const [key, value] of Object.entries(config || {})) {
    normalized[key] = {
      video: String(value?.video || "").trim(),
      desktopImage: String(value?.desktopImage || value?.image || "").trim(),
      mobileImage: String(value?.mobileImage || "").trim(),
      desktopFocal: String(value?.desktopFocal || value?.focal || "center").trim(),
      mobileFocal: String(value?.mobileFocal || value?.desktopFocal || value?.focal || "center").trim(),
      desktopScale: String(value?.desktopScale || value?.scale || "1").trim(),
      mobileScale: String(value?.mobileScale || value?.desktopScale || value?.scale || "1").trim(),
      desktopFit: normalizeFitMode(value?.desktopFit || value?.fit),
      mobileFit: normalizeFitMode(value?.mobileFit || value?.desktopFit || value?.fit),
    };
  }
  return normalized;
}

function normalizeHeroImagesPatch(config) {
  const normalized = {};
  for (const [key, value] of Object.entries(config || {})) {
    if (!value || typeof value !== "object") continue;
    normalized[key] = {};
    if (Object.hasOwn(value, "video")) normalized[key].video = String(value.video || "").trim();
    if (Object.hasOwn(value, "desktopImage")) {
      normalized[key].desktopImage = String(value.desktopImage || value.image || "").trim();
    }
    if (Object.hasOwn(value, "image") && !Object.hasOwn(value, "desktopImage")) {
      normalized[key].desktopImage = String(value.image || "").trim();
    }
    if (Object.hasOwn(value, "mobileImage")) normalized[key].mobileImage = String(value.mobileImage || "").trim();
    if (Object.hasOwn(value, "desktopFocal")) {
      normalized[key].desktopFocal = String(value.desktopFocal || value.focal || "center").trim();
    }
    if (Object.hasOwn(value, "focal") && !Object.hasOwn(value, "desktopFocal")) {
      normalized[key].desktopFocal = String(value.focal || "center").trim();
    }
    if (Object.hasOwn(value, "mobileFocal")) {
      normalized[key].mobileFocal = String(value.mobileFocal || value.desktopFocal || value.focal || "center").trim();
    }
    if (Object.hasOwn(value, "desktopScale")) {
      normalized[key].desktopScale = String(value.desktopScale || value.scale || "1").trim();
    }
    if (Object.hasOwn(value, "scale") && !Object.hasOwn(value, "desktopScale")) {
      normalized[key].desktopScale = String(value.scale || "1").trim();
    }
    if (Object.hasOwn(value, "mobileScale")) {
      normalized[key].mobileScale = String(value.mobileScale || value.desktopScale || value.scale || "1").trim();
    }
    if (Object.hasOwn(value, "desktopFit")) {
      normalized[key].desktopFit = normalizeFitMode(value.desktopFit || value.fit);
    }
    if (Object.hasOwn(value, "fit") && !Object.hasOwn(value, "desktopFit")) {
      normalized[key].desktopFit = normalizeFitMode(value.fit);
    }
    if (Object.hasOwn(value, "mobileFit")) {
      normalized[key].mobileFit = normalizeFitMode(value.mobileFit || value.desktopFit || value.fit);
    }
  }
  return normalized;
}

function normalizeFitMode(value) {
  return ["cover", "contain", "fill"].includes(value) ? value : "cover";
}

function mergeHeroImagesConfig(existing, incoming) {
  const merged = { ...(existing || {}) };
  for (const [key, value] of Object.entries(incoming || {})) {
    merged[key] = {
      ...(merged[key] || {}),
      ...value,
    };
  }
  return normalizeHeroImagesConfig(merged);
}

async function writeConfigWithBackup(filePath, config) {
  await mkdir(dirname(filePath), { recursive: true });
  if (existsSync(filePath)) {
    await mkdir(backupRoot, { recursive: true });
    const backupName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${filePath.split(/[\\/]/).at(-1)}`;
    await writeFile(join(backupRoot, backupName), await readFile(filePath, "utf8"), "utf8");
  }
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function getConfigDefinition(type) {
  switch (type) {
    case "home-hero":
      return { type, fileName: "home-hero.json", filePath: homeHeroConfigPath, normalize: normalizeHomeHeroConfig };
    case "hero-images":
      return { type, fileName: "hero-images.json", filePath: heroImagesConfigPath, normalize: normalizeHeroImagesConfig };
    case "pastor-thought":
      return {
        type,
        fileName: "pastor-thought.json",
        filePath: pastorThoughtConfigPath,
        normalize: normalizePastorThoughtConfig,
      };
    case "site-settings":
      return { type, fileName: "site-settings.json", filePath: siteSettingsConfigPath, normalize: normalizeSiteSettingsConfig };
    default:
      throw new Error("Unknown configuration type");
  }
}

async function listConfigBackups(type) {
  const definition = getConfigDefinition(type);
  if (!existsSync(backupRoot)) return { type: definition.type, backups: [] };

  const entries = await readdir(backupRoot, { withFileTypes: true });
  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(`-${definition.fileName}`)) continue;
    const filePath = join(backupRoot, entry.name);
    const fileStat = await stat(filePath);
    let summary = {};
    try {
      summary = summarizeConfigBackup(definition.type, definition.normalize(await readJsonFile(filePath)));
    } catch {
      summary = { invalid: true };
    }
    backups.push({
      name: entry.name,
      size: fileStat.size,
      modified: fileStat.mtime.toISOString(),
      summary,
    });
  }

  backups.sort((a, b) => b.modified.localeCompare(a.modified) || b.name.localeCompare(a.name));
  return { type: definition.type, backups };
}

async function restoreConfigBackup(type, backupName) {
  const definition = getConfigDefinition(type);
  const safeName = basename(String(backupName || ""));
  if (!safeName || safeName !== backupName || !safeName.endsWith(`-${definition.fileName}`)) {
    throw new Error("Invalid backup name");
  }

  const backupPath = normalize(join(backupRoot, safeName));
  if (!backupPath.startsWith(normalize(backupRoot))) throw new Error("Invalid backup path");
  if (!existsSync(backupPath)) throw new Error("Backup was not found");

  const restored = definition.normalize(await readJsonFile(backupPath));
  await writeConfigWithBackup(definition.filePath, restored);
  return { type: definition.type, restoredFrom: safeName, config: restored };
}

function summarizeConfigBackup(type, config) {
  if (type === "hero-images") {
    return Object.fromEntries(
      Object.entries(config).map(([key, value]) => [
        key,
        {
          video: value.video || "",
          desktopImage: value.desktopImage || "",
          mobileImage: value.mobileImage || "",
          desktopFit: value.desktopFit || "",
          mobileFit: value.mobileFit || "",
        },
      ]),
    );
  }

  if (type === "home-hero") {
    return { video: config.video || "", poster: config.poster || "", title: config.title || "" };
  }

  if (type === "pastor-thought") {
    return { title: config.title || "", author: config.author || "", date: config.date || "" };
  }

  return config;
}

function normalizePastorThoughtConfig(config) {
  return {
    kicker: String(config?.kicker || "Pastor's Thought").trim(),
    title: String(config?.title || "A word of encouragement for this week.").trim(),
    author: String(config?.author || "LPC Pastoral Team").trim(),
    date: String(config?.date || "").trim(),
    body: String(
      config?.body ||
        "Use this space to share a short pastoral reflection, Scripture encouragement, or thought connected to the messages and worship life of the church.",
    ).trim(),
    ctaText: String(config?.ctaText || "Watch Sermons").trim(),
    ctaHref: String(config?.ctaHref || "#/watch").trim(),
  };
}

function normalizeSiteSettingsConfig(config) {
  return {
    topbarSlogan: String(config?.topbarSlogan || "Celebrating 25 Years of God's Faithfulness").trim(),
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function isAuthenticated(request) {
  const token = getCookie(request, "lpc_admin");
  if (revokedSessions.has(token)) return false;
  return Boolean(token && (sessions.has(token) || verifyAdminSessionToken(token)));
}

function createAdminSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      user: adminUsername,
      nonce: randomBytes(12).toString("hex"),
      exp: Date.now() + 8 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${signAdminSessionPayload(payload)}`;
}

function verifyAdminSessionToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, signAdminSessionPayload(payload))) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data?.user === adminUsername && Number(data?.exp || 0) > Date.now();
  } catch {
    return false;
  }
}

function signAdminSessionPayload(payload) {
  return createHmac("sha256", adminSessionSecret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookie(request, name) {
  const cookie = request.headers.cookie || "";
  const parts = cookie.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = parts.find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

const latestYouTubeCache=new Map();
async function resolveLatestYouTubeVideo(channelUrl, handle) {
  const baseUrl = normalizeChannelUrl(channelUrl, handle);
  const cached=latestYouTubeCache.get(baseUrl);if(cached&&cached.expires>Date.now())return cached.video;
  try {
  const live = await findFirstVideo(`${baseUrl}/streams`, true).catch(()=>null);
  if (live) {const video={ ...live, mode: "Live now", channelUrl: baseUrl };latestYouTubeCache.set(baseUrl,{video,expires:Date.now()+300000});return video;}

  const latest = await findFirstVideo(`${baseUrl}/streams?view=0&sort=dd&flow=grid`, false);
  if (!latest) throw new Error("No latest video found on channel live page");
  const video={ ...latest, mode: "Latest video", channelUrl: baseUrl };latestYouTubeCache.set(baseUrl,{video,expires:Date.now()+300000});return video;
  }catch(error){if(cached&&Date.now()-cached.expires<3600000)return cached.video;throw error;}
}

function normalizeChannelUrl(channelUrl, handle) {
  if (channelUrl) {
    const url = new URL(channelUrl);
    if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)||url.username||url.password||url.port)throw Error('Invalid YouTube channel URL');
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/(videos|streams|live)\/?$/, "").replace(/\/$/, "");
    return url.toString().replace(/\/$/, "");
  }

  if (!handle) throw new Error("Missing channel URL or handle");
  return `https://www.youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}`;
}

async function findFirstVideo(url, requireLive) {
  const html = await fetchYouTubeHtml(url);
  const data = extractYtInitialData(html);
  const renderers = [];
  collectVideoRenderers(data, renderers);

  const selected = requireLive ? renderers.find(isLiveRenderer) : renderers[0];
  if (selected?.videoId) {
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
    signal:AbortSignal.timeout(10000),
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

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const candidate=resolve(root,'.'+requested);
  if(candidate===volunteerRoot||candidate.startsWith(volunteerRoot+'/')||requested.split('/').some(p=>p==='.private-volunteers'||p==='volunteer-private')) {sendJson(response,404,{error:'Not found'});return;}

  const filePath = normalize(join(root, requested));

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const contentType = contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  const cacheControl = [".html", ".css", ".js", ".json"].includes(extname(filePath).toLowerCase())
    ? "no-cache"
    : "public, max-age=3600";
  response.writeHead(200, { "content-type": contentType, "cache-control": cacheControl });
  createReadStream(filePath).pipe(response);
}

async function serveUploaded(pathname, response) {
  const requested = decodeURIComponent(pathname.replace(/^\/uploads\//, ""));
  const filePath = normalize(join(uploadsRoot, requested));

  if (!filePath.startsWith(uploadsRoot) || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const contentType = contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, { "content-type": contentType, "cache-control": "public, max-age=3600" });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, status, data) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}
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

