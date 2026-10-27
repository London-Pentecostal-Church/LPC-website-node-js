import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { sendContact, validateContact } from '../worker/contact-mail.mjs';

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
