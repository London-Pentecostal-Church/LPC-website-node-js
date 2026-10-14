import nodemailer from 'nodemailer';
export function validateContact(input){
 const name=String(input.name||'').trim(),email=String(input.email||'').trim(),message=String(input.message||'').trim();
 if(!name||name.length>150||/[\r\n]/.test(name)||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!message||message.length>10000)throw Error('Enter your name, a valid email address and a message (up to 10,000 characters).');
 return {name,email,message};
}
export async function sendContact(input,env=process.env,transport){
 const value=validateContact(input);
 if(!transport && env.CONTACT_MAIL_PROVIDER==='microsoft365'){
   if(!env.MS_TENANT_ID||!env.MS_CLIENT_ID||!env.MS_CLIENT_SECRET||!env.MS_MAIL_SENDER)return {status:503,error:'Email delivery is not configured yet. Please email office@londonpentecostalchurch.org directly.'};
   if(!/^[0-9a-f-]{36}$/i.test(env.MS_TENANT_ID))throw Error('Invalid tenant configuration');
   const tokenResponse=await fetch('https://login.microsoftonline.com/'+env.MS_TENANT_ID+'/oauth2/v2.0/token',{method:'POST',body:new URLSearchParams({client_id:env.MS_CLIENT_ID,client_secret:env.MS_CLIENT_SECRET,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(10000)});
   if(!tokenResponse.ok)throw Error('Microsoft authentication failed');const token=await tokenResponse.json();
   const response=await fetch('https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(env.MS_MAIL_SENDER)+'/sendMail',{method:'POST',headers:{authorization:'Bearer '+token.access_token,'content-type':'application/json'},body:JSON.stringify({message:{subject:'LPC website enquiry',body:{contentType:'Text',content:`Name: ${value.name}\nEmail: ${value.email}\n\n${value.message}`},toRecipients:[{emailAddress:{address:'office@londonpentecostalchurch.org'}}],replyTo:[{emailAddress:{name:value.name,address:value.email}}]},saveToSentItems:true}),signal:AbortSignal.timeout(15000)});
   if(response.status!==202)throw Error('Microsoft did not accept the message');return {status:200,sent:true};
 }
 if(!transport && (!env.SMTP_HOST||!env.SMTP_USER||!env.SMTP_PASSWORD||!env.SMTP_FROM))return {status:503,error:'Email delivery is not configured yet. Please email office@londonpentecostalchurch.org directly.'};
 const port=Number(env.SMTP_PORT||587);
 const mailer=transport||nodemailer.createTransport({host:env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
 const result=await mailer.sendMail({from:env.SMTP_FROM,to:'office@londonpentecostalchurch.org',replyTo:{name:value.name,address:value.email},subject:'LPC website enquiry',text:`Name: ${value.name}\nEmail: ${value.email}\n\n${value.message}`});
 if(!result.accepted?.includes('office@londonpentecostalchurch.org'))throw Error('Email was not accepted');
 return {status:200,sent:true};
}
