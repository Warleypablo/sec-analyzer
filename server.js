'use strict'
require('dotenv').config()
const express = require('express')
const app = express()
app.use(express.json())
app.get('/health', (_req, res) => res.json({ ok: true }))
const PORT = process.env.PORT || 3000
if (require.main === module) {
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`))
}
module.exports = app
