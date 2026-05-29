const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../config/db');
const { isEmail } = require('../utils/validators');

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '1d' });
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || name.trim().length < 2) return res.status(400).json({ message: 'Name is required.' });
    if (!email || !isEmail(email)) return res.status(400).json({ message: 'Valid email is required.' });
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const exists = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (exists) return res.status(409).json({ message: 'Email already registered.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name.trim(), email.toLowerCase(), hash]);
    const user = { id: result.id, name: name.trim(), email: email.toLowerCase() };
    return res.status(201).json({ message: 'Registered successfully.', token: signToken(user), user });
  } catch (err) {
    return res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials.' });
    return res.json({ message: 'Login successful.', token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    return res.status(500).json({ message: 'Login failed.', error: err.message });
  }
};
