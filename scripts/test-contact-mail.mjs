import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { sendContact, validateContact } from '../worker/contact-mail.mjs';
import { handleContact,sendMicrosoftContact } from '../worker/contact-http.mjs';

test('Hosted public contact endpoint needs no admin login and reports missing delivery setup honestly',async()=>{
 const data=new Map(),env={BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v)}};
 const request=(body,origin='https://church.test')=>new Request('https://church.test/api/contact',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const input={name:'Visitor',email:'visitor@example.test',message:'Test'};
 const response=await handleContact(request(input),env);
 assert.equal(response.status,503);assert.match((await response.json()).error,/not configured/);
 assert.equal((await handleContact(request(input,'https://other.test'),env)).status,403);
 assert.equal((await handleContact(request({...input,email:'invalid'}),env)).status,400);
 assert.equal((await handleContact(request({...input,website:'spam'}),env)).status,200);
 for(let i=0;i<2;i++)await handleContact(request(input),env);
 assert.equal((await handleContact(request(input),env)).status,429);
});

test('Hosted Microsoft delivery only confirms success after mail service acceptance',async()=>{
 const original=globalThis.fetch,calls=[];
 try {
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return calls.length===1?Response.json({access_token:'synthetic-test-token'}):new Response(null,{status:202});};
  const result=await sendMicrosoftContact({name:'Visitor',email:'visitor@example.test',message:'Test'},{CONTACT_MAIL_PROVIDER:'microsoft365',MS_TENANT_ID:'00000000-0000-0000-0000-000000000000',MS_CLIENT_ID:'test',MS_CLIENT_SECRET:'test',MS_MAIL_SENDER:'office@example.test'});
  assert.equal(result.sent,true);
  const sent=JSON.parse(calls[1].options.body);
  assert.equal(sent.message.toRecipients[0].emailAddress.address,'office@londonpentecostalchurch.org');
  assert.equal(sent.message.replyTo[0].emailAddress.address,'visitor@example.test');
 } finally {globalThis.fetch=original;}
});

test('Updated mail library preserves the fixed recipient and structured reply-to without sending mail', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  let message;
  const result = await sendContact({name:'Example "Church" Visitor',email:'visitor@example.test',message:'A test enquiry'},
    {SMTP_FROM:'website@example.test'}, {
      async sendMail(options) {
        message = await transport.sendMail(options);
        return {...message,accepted:['office@londonpentecostalchurch.org']};
      },
    });
  assert.deepEqual(result,{status:200,sent:true});
  assert.deepEqual(message.envelope.to,['office@londonpentecostalchurch.org']);
  assert.match(message.message.toString(),/Reply-To:.*visitor@example\.test/);
  assert.match(message.message.toString(),/A test enquiry/);
});

test('Contact validation and the unconfigured-email fallback remain intact', async () => {
  assert.throws(()=>validateContact({name:'Injected\nName',email:'visitor@example.test',message:'Test'}));
  assert.throws(()=>validateContact({name:'Visitor',email:'invalid',message:'Test'}));
  const result=await sendContact({name:'Visitor',email:'visitor@example.test',message:'Test'},{});
  assert.equal(result.status,503);
  assert.match(result.error,/office@londonpentecostalchurch.org/);
});
