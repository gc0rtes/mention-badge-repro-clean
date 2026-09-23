/* eslint-env node */
// Simple JWT token generator for Stream Chat
// This is for development purposes only
// In production, tokens should be generated on your backend

const crypto = require('crypto');

const userId = process.env.STREAM_USER_ID;
// Get this from your Stream Dashboard. Never commit a real secret to this file.
const secret = process.env.STREAM_APP_SECRET;

if (!userId || !secret) {
  console.error(
    'Usage: STREAM_USER_ID=<user id> STREAM_APP_SECRET=<secret from Stream Dashboard> node generateToken.js',
  );
  process.exit(1);
}

// Simple JWT implementation (for development only)
function generateJWT(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const payload = {
  user_id: userId  
};

console.log('Generated token for user:', userId);
console.log('Token:', generateJWT(payload, secret));
