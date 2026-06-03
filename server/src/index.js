require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const authRoutes        = require('./routes/auth');
const matterRoutes      = require('./routes/matters');
const documentRoutes    = require('./routes/documents');
const messageRoutes     = require('./routes/messages');
const appointmentRoutes = require('./routes/appointments');
const taskRoutes        = require('./routes/tasks');
const dashboardRoutes   = require('./routes/dashboard');
const userRoutes        = require('./routes/users');
const paymentRoutes     = require('./routes/payments');
const adminRoutes       = require('./routes/admin');
const { initDatabase }  = require('./database');

const app          = express();
const PORT         = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const isDev        = !isProduction;

app.use(helmet({ contentSecurityPolicy: false }));
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(cors({ origin: isProduction ? true : (process.env.CLIENT_URL || 'http://localhost:5173'), credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter     = rateLimit({ windowMs: 15*60*1000, max: isDev ? 2000 : 200, standardHeaders: true });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: isDev ? 200  : 20,  standardHeaders: true });
app.use('/api/', limiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth',         authRoutes);
app.use('/api/matters',      matterRoutes);
app.use('/api/documents',    documentRoutes);
app.use('/api/messages',     messageRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/tasks',        taskRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/admin',        adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

if (isProduction) {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: isProduction ? 'Internal server error' : err.message });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 TriVanta running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
