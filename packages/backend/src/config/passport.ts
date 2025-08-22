import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { UserModel } from '../models/User';
import { config } from './index';
import logger from './logger';
import { JwtPayload } from '../utils/jwt';

// Local Strategy for email/password authentication
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  async (email: string, password: string, done) => {
    try {
      const user = await UserModel.findByEmail(email);
      
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      if (user.status !== 'active') {
        return done(null, false, { message: 'Account is not active' });
      }

      const isValidPassword = await UserModel.verifyPassword(user, password);
      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Remove password hash before returning user
      const { passwordHash, ...userWithoutPassword } = user;
      return done(null, userWithoutPassword);
    } catch (error) {
      logger.error('Local strategy error:', error);
      return done(error);
    }
  }
));

// JWT Strategy for API authentication
passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.jwt.secret,
    issuer: 'admin-panel',
    audience: 'admin-panel-users',
  },
  async (payload: JwtPayload, done) => {
    try {
      const user = await UserModel.findById(payload.userId);
      
      if (!user) {
        return done(null, false);
      }

      if (user.status !== 'active') {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      logger.error('JWT strategy error:', error);
      return done(error);
    }
  }
));

// Google OAuth Strategy
if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
  passport.use(new GoogleStrategy(
    {
      clientID: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      callbackURL: '/api/v1/auth/google/callback',
    },
    async (accessToken: string, refreshToken: string, profile: any, done) => {
      try {
        // Check if user already exists with this Google account
        const existingUser = await UserModel.findByEmail(profile.emails[0].value);
        
        if (existingUser) {
          // User exists, update last login
          await UserModel.updateLastLogin(existingUser.id);
          return done(null, existingUser);
        }

        // Create new user
        const newUser = await UserModel.create({
          email: profile.emails[0].value,
          name: profile.displayName,
          avatarUrl: profile.photos[0]?.value,
          emailVerified: true,
          status: 'pending', // New OAuth users need admin approval
        });

        logger.info('New user created via Google OAuth:', {
          userId: newUser.id,
          email: newUser.email,
        });

        return done(null, newUser);
      } catch (error) {
        logger.error('Google OAuth strategy error:', error);
        return done(error);
      }
    }
  ));
}

// GitHub OAuth Strategy
if (config.oauth.github.clientId && config.oauth.github.clientSecret) {
  passport.use(new GitHubStrategy(
    {
      clientID: config.oauth.github.clientId,
      clientSecret: config.oauth.github.clientSecret,
      callbackURL: '/api/v1/auth/github/callback',
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        // GitHub might not provide email in profile, so we need to handle that
        const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;
        
        // Check if user already exists
        const existingUser = await UserModel.findByEmail(email);
        
        if (existingUser) {
          // User exists, update last login
          await UserModel.updateLastLogin(existingUser.id);
          return done(null, existingUser);
        }

        // Create new user
        const newUser = await UserModel.create({
          email,
          name: profile.displayName || profile.username,
          avatarUrl: profile.photos[0]?.value,
          emailVerified: !!profile.emails?.[0]?.value, // Only verified if email is provided
          status: 'pending', // New OAuth users need admin approval
        });

        logger.info('New user created via GitHub OAuth:', {
          userId: newUser.id,
          email: newUser.email,
        });

        return done(null, newUser);
      } catch (error) {
        logger.error('GitHub OAuth strategy error:', error);
        return done(error);
      }
    }
  ));
}

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (error) {
    logger.error('User deserialization error:', error);
    done(error);
  }
});

export default passport;
