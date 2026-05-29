const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Personal Task Manager API running' }));
app.use(express.static(path.join(__dirname, '../../frontend')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/index.html')));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
