import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  try {
    // simulate error before any write
    throw new Error('503 API error');
  } catch (err) {
    if (!res.headersSent) {
      console.log('Headers sent?', res.headersSent);
      res.removeHeader('Transfer-Encoding');
      res.status(500).json({ error: 'failed' });
    }
  }
});

app.listen(3001, () => {
  console.log('running');
  fetch('http://localhost:3001/').then(r => r.text()).then(r => {
    console.log(r);
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  })
});
