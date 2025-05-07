const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Log environment variables status for debugging (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('Google OAuth Environment Variables Status:');
  console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set ✓' : 'Not set ✗');
  console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set ✓' : 'Not set ✗');
  console.log('API_URL:', process.env.API_URL || 'using default: http://localhost:5000');
  console.log('CLIENT_URL:', process.env.CLIENT_URL || 'using default: http://localhost:3000');
}

// Configure Google OAuth Strategy with fallback values for development
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'MISSING_CLIENT_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'MISSING_CLIENT_SECRET',
    callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/google/callback`,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this email
      const existingUser = await User.findOne({ email: profile.emails[0].value });

      if (existingUser) {
        // User exists, log them in
        return done(null, existingUser);
      } else {
        // Create new user
        const newUser = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          // Generate a random password for Google users
          password: crypto.randomBytes(16).toString('hex'),
        });

        await newUser.save();
        return done(null, newUser);
      }
    } catch (error) {
      return done(error, null);
    }
  }
));

// Initialize passport
exports.initializePassport = (app) => {
  // Check if Google credentials are set
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('⚠️ WARNING: Google OAuth credentials are not properly configured in your environment variables.');
    console.warn('Google authentication will not work without valid credentials.');
  }
  
  app.use(passport.initialize());
};

// Register a new user
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id }, 
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    // Return user data and token (exclude password)
    res.status(201).json({
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    // Return user data and token
    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Get current user data
exports.getCurrentUser = async (req, res) => {
  try {
    // User data comes from the auth middleware
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error getting user data' });
  }
};

// Verify token is valid
exports.verifyToken = async (req, res) => {
  try {
    res.status(200).json({ valid: true, user: req.user });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ message: 'Server error during token verification' });
  }
};

// Logout user - This is mostly handled client-side by removing the token from storage
exports.logout = async (req, res) => {
  try {
    // On the server side, we don't need to do much since we're using stateless JWTs
    // In a production app, you might want to add the token to a blacklist until it expires
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

// Request password reset
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // For security reasons, still return success even if email is not found
      return res.status(200).json({ message: 'If a user with that email exists, a password reset link was sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token and save to user document
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Token expires in 1 hour
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    // Create reset URL
    const resetURL = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
    
    // In a production environment, you would send an email with the reset link
    // For development, we'll just return the URL in the response
    
    // TODO: Add actual email sending in production
    // const transporter = nodemailer.createTransport({});
    // const mailOptions = { to: user.email, subject: 'Password Reset', text: resetURL };
    // await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'If a user with that email exists, a password reset link was sent.',
      resetURL // Only include in development
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    // Hash the token to compare with the one in DB
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    // Clear the reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    // Generate JWT token for auto-login after password reset
    const jwtToken = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Password reset successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token: jwtToken
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const userId = req.userId;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic info if provided
    if (name) user.name = name;
    
    // Check if email is being changed
    if (email && email !== user.email) {
      // Check if email is already in use
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }

    // Update password if new one is provided
    if (newPassword && currentPassword) {
      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    // Save updated user
    await user.save();

    // Return updated user (exclude password)
    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
};

// Start Google OAuth authentication
exports.googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
});

// Google OAuth callback
exports.googleCallback = (req, res) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      // Handle error - redirect to login with error
      const htmlWithScript = `
        <html>
        <body>
          <script>
            window.opener.postMessage({ error: "${err?.message || 'Authentication failed'}" }, "${process.env.CLIENT_URL || 'http://localhost:3000'}");
            window.close();
          </script>
        </body>
        </html>
      `;
      return res.send(htmlWithScript);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Create HTML response with script to post message to opener
    const htmlWithScript = `
      <html>
      <body>
        <script>
          window.opener.postMessage({ 
            user: {
              id: "${user.id}",
              name: "${user.name}",
              email: "${user.email}"
            },
            token: "${token}"
          }, "${process.env.CLIENT_URL || 'http://localhost:3000'}");
          window.close();
        </script>
      </body>
      </html>
    `;

    res.send(htmlWithScript);
  })(req, res);
};