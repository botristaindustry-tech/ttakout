const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth Login Route
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

// Google OAuth Callback Route
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=unauthorized` 
  }),
  (req, res) => {
    // Successful authentication, redirect to frontend dashboard.
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  }
);

// Get current user session
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((err2) => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

module.exports = router;
