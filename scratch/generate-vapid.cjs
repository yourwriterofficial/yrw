const { webcrypto } = require('crypto');

function base64urlEncode(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateVapidKeys() {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const publicKey = await webcrypto.subtle.exportKey('raw', keyPair.publicKey);
  const privateKey = await webcrypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  console.log('PUBLIC KEY (65 bytes, base64url):');
  console.log(base64urlEncode(new Uint8Array(publicKey)));
  console.log('PUBLIC KEY length:', base64urlEncode(new Uint8Array(publicKey)).length);

  console.log('\nPRIVATE KEY (PKCS#8, base64url):');
  console.log(base64urlEncode(new Uint8Array(privateKey)));
}

generateVapidKeys();
