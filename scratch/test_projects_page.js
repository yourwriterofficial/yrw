const http = require('http');

http.get('http://localhost:3000/projects', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers['content-type']);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Data length:', data.length);
    if (data.includes('Database Search &amp; Availability')) {
      console.log('✓ Found page title / content context.');
    } else {
      console.log('✗ Could not find expected page title.');
    }
  });
}).on('error', (err) => {
  console.error('Error connecting to dev server:', err.message);
});
