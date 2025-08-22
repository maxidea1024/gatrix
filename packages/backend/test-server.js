const express = require('express');

const app = express();
const port = 5000;

app.get('/', (req, res) => {
  res.json({ message: 'Test server is working!' });
});

app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});
