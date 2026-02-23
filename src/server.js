const express = require('express');
const path = require('path');
const session = require('express-session');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'totem-admin-secret-key';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'totem-admin-secret-key') {
    throw new Error('SESSION_SECRET must be set to a strong value in production');
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin') {
    throw new Error('ADMIN_PASSWORD must be changed in production');
  }
}

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '200kb' }));
app.use(compression());

// Session configuration
app.use(session({
  name: 'totem.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: 'auto',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

const publicPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicPath, {
  etag: true,
  lastModified: true,
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
      return;
    }
    if (/\.(js|css|avif|png|jpg|jpeg|webp|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  },
}));

// Middleware de autenticación
function requireAuth(req, res, next) {
  const requestPath = (req.originalUrl || '').split('?')[0];
  const isPublicReadRoute =
    req.method === 'GET' &&
    /^\/api\/tramites(\/[^/]+)?$/.test(requestPath);

  if (isPublicReadRoute) {
    return next();
  }

  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

// Rutas de autenticación
app.post('/api/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      req.session.isAdmin = true;
      res.json({ success: true });
    });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Error logging out' });
    } else {
      res.clearCookie('totem.sid');
      res.json({ success: true });
    }
  });
});

app.get('/api/auth-check', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

// Mount API routes (protegidas)
try {
  const apiRouter = require('./routes');
  app.use('/api', requireAuth, apiRouter);
} catch (e) {
  console.warn('API routes not mounted:', e && e.stack ? e.stack : e.message || e);
}

// Admin page (protegida)
app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.sendFile(path.join(publicPath, 'admin.html'), (err) => {
      if (err) res.status(500).send('Error loading admin.html');
    });
  } else {
    res.sendFile(path.join(publicPath, 'login.html'), (err) => {
      if (err) res.status(500).send('Error loading login.html');
    });
  }
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(publicPath, 'login.html'), (err) => {
    if (err) res.status(500).send('Error loading login.html');
  });
});

// SPA fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) res.status(500).send('Error loading index.html');
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
