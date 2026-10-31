export const contactUnavailable='Email delivery is not configured yet. Please email office@londonpentecostalchurch.org directly.';
export function validateContact(input){
 const name=String(input?.name||'').trim(),email=String(input?.email||'').trim(),message=String(input?.message||'').trim();
 if(!name||name.length>150||/[\r\n]/.test(name)||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!message||message.length>10000)throw Error('Enter your name, a valid email address and a message (up to 10,000 characters).');
 return {name,email,message};
}
export async function sendMicrosoftContact(input,env){
 const value=validateContact(input);
 if(env.CONTACT_MAIL_PROVIDER!=='microsoft365'||!env.MS_TENANT_ID||!env.MS_CLIENT_ID||!env.MS_CLIENT_SECRET||!env.MS_MAIL_SENDER)return {status:503,error:contactUnavailable};
 if(!/^[0-9a-f-]{36}$/i.test(env.MS_TENANT_ID))throw Error('Invalid tenant configuration');
 const tokenResponse=await fetch('https://login.microsoftonline.com/'+env.MS_TENANT_ID+'/oauth2/v2.0/token',{method:'POST',body:new URLSearchParams({client_id:env.MS_CLIENT_ID,client_secret:env.MS_CLIENT_SECRET,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(10000)});
 if(!tokenResponse.ok)throw Error('Microsoft authentication failed');
 const token=await tokenResponse.json();
 const response=await fetch('https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(env.MS_MAIL_SENDER)+'/sendMail',{method:'POST',headers:{authorization:'Bearer '+token.access_token,'content-type':'application/json'},body:JSON.stringify({message:{subject:'LPC website enquiry',body:{contentType:'Text',content:`Name: ${value.name}\nEmail: ${value.email}\n\n${value.message}`},toRecipients:[{emailAddress:{address:'office@londonpentecostalchurch.org'}}],replyTo:[{emailAddress:{name:value.name,address:value.email}}]},saveToSentItems:true}),signal:AbortSignal.timeout(15000)});
 if(response.status!==202)throw Error('Microsoft did not accept the message');
 return {status:200,sent:true};
}

export async function handleContact(request,env){
 const json=(value,status)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Invalid request origin'},403);
 const ip=request.headers.get('cf-connecting-ip')||'unknown',key='contact-attempts/'+encodeURIComponent(ip),now=Date.now();
 const stored=await env.BUCKET.get(key),previous=stored?await stored.json():null;
 const attempts=previous?.until>now?previous:{count:0,until:now+600000};
 if(attempts.count>=5)return json({error:'Please wait a few minutes before trying again.'},429);
 await env.BUCKET.put(key,JSON.stringify({...attempts,count:attempts.count+1}));
 const raw=await request.text();
 if(raw.length>16000)return json({error:'Message is too large'},413);
 let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid message'},400);}
 if(input?.website)return json({sent:true},200);
 try {
   const result=await sendMicrosoftContact(input,env);
   return json(result,result.status);
 } catch(error){
   const invalid=error.message.startsWith('Enter your name');
   return json({error:invalid?error.message:'Email could not be sent. Please try again or email office@londonpentecostalchurch.org.'},invalid?400:502);
 }
}
