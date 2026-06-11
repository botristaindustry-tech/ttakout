require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  }
});

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Trust proxy (Render runs behind a reverse proxy)
app.set('trust proxy', 1);

// Session Management
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    httpOnly: true
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'mock',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock',
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5005'}/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, cb) => {
    try {
      // Find or create user
      const query = `SELECT * FROM users WHERE google_id = $1 OR email = $2`;
      const { rows } = await db.query(query, [profile.id, profile.emails[0].value]);
      
      let user;
      if (rows.length > 0) {
        user = rows[0];
        
        // Update google_id if it was null (e.g., admin pre-created the account with just email)
        if (!user.google_id) {
          await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [profile.id, user.id]);
          user.google_id = profile.id;
        }
      } else {
        // User not found in the pre-approved database, reject login
        console.error(`Unauthorized login attempt by: ${profile.emails[0].value}`);
        return cb(null, false, { message: 'Unauthorized. Your email is not whitelisted.' });
      }
      return cb(null, user);
    } catch (err) {
      return cb(err, null);
    }
  }
));

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
  try {
    const { rows } = await db.query(
      `SELECT u.*, r.permissions as role_permissions 
       FROM users u 
       LEFT JOIN roles r ON u.role = r.name 
       WHERE u.id = $1`, [id]
    );
    const user = rows[0];
    if (user) {
      user.permissions = user.role_permissions || [];
      delete user.role_permissions;
    }
    cb(null, user);
  } catch (err) {
    cb(err, null);
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Routes
const authRoutes = require('./routes/auth');
const webhooksRoutes = require('./routes/webhooks')(io);
const ordersRoutes = require('./routes/orders')(io);
const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const settingsRoutes = require('./routes/settings');
const flaggedPhonesRoutes = require('./routes/flaggedPhones');
const menuRoutes = require('./routes/menu');

app.use('/auth', authRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/roles', rolesRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/flagged-phones', flaggedPhonesRoutes);
app.use('/api/v1/menu', menuRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 5001;

// Ensure flagged_phones table exists
const createFlaggedPhonesTableQuery = `
  CREATE TABLE IF NOT EXISTS flagged_phones (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      phone_number VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;
db.query(createFlaggedPhonesTableQuery)
  .then(() => console.log('Successfully ensured flagged_phones table exists.'))
  .catch(err => console.error('Error creating flagged_phones table:', err));

// Drop the restrictive role constraint on the users table to allow dynamic roles like 'Kitchen'
db.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check')
  .then(() => console.log('Successfully ensured dynamic roles are allowed (dropped users_role_check).'))
  .catch(err => console.error('Error dropping users_role_check constraint:', err));

// Drop and recreate restrictive orders status constraint to allow FLAGGED status
db.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check')
  .then(() => db.query("ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'KITCHEN_QUEUED', 'REJECTED', 'READY_FOR_PICKUP', 'PAID', 'FLAGGED'))"))
  .then(() => console.log("Successfully ensured FLAGGED order status is allowed."))
  .catch(err => console.error("Error updating orders_status_check constraint:", err));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize MenuService with active file from DB
  const menuService = require('./services/menuService');
  db.query("SELECT value FROM app_settings WHERE key = 'active_menu_file'")
    .then(res => {
      if (res.rows.length > 0 && res.rows[0].value) {
        // Strip quotes if any due to JSON stringification
        let filename = res.rows[0].value;
        if (typeof filename === 'string' && filename.startsWith('"')) {
           filename = JSON.parse(filename);
        }
        menuService.setActiveMenuFile(filename);
        console.log(`[Init] Loaded active menu file: ${filename}`);
      }
    })
    .catch(err => console.error('Error loading active menu file:', err));
});
