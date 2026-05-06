const http = require('http');

const data = JSON.stringify({
  identifier: 'test@example.com',
  password: 'password123'
});

const options = {
  hostname: '127.0.0.1',
  port: 5001,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
