const http = require('http');

const postData = JSON.stringify({
  action: 'login',
  identifier: '10000000000',
  password: '11999999999'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Response:", data);
  });
});

req.on('error', console.error);
req.write(postData);
req.end();
