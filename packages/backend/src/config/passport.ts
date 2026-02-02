import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as QQStrategy } from "passport-qq";
// import { Strategy as WeChatStrategy } from 'passport-wechat';
// import { Strategy as BaiduStrategy } from 'passport-baidu';
import { UserModel } from "../models/User";
import { config } from "./index";
import logger from "./logger";
import { JwtPayload } from "../utils/jwt";

// Local Strategy for email/password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email: string, password: string, done) => {
      try {
        const user = await UserModel.findByEmail(email);

        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }

        if (user.status !== "active") {
          return done(null, false, { message: "Account is not active" });
        }

        const isValidPassword = await UserModel.verifyPassword(user, password);
        if (!isValidPassword) {
          return done(null, false, { message: "Invalid email or password" });
        }

        // Remove password hash before returning user
        const { passwordHash: _passwordHash, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        logger.error("Local strategy error:", error);
        return done(error);
      }
    },
  ),
);

// JWT Strategy for API authentication
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwt.secret,
      issuer: "admin-panel",
      audience: "admin-panel-users",
    },
    async (payload: JwtPayload, done) => {
      try {
        const user = await UserModel.findById(payload.userId);

        if (!user) {
          return done(null, false);
        }

        if (user.status !== "active") {
          return done(null, false);
        }

        return done(null, user);
      } catch (error) {
        logger.error("JWT strategy error:", error);
        return done(error);
      }
    },
  ),
);

// Google OAuth Strategy
if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.oauth.google.clientId,
        clientSecret: config.oauth.google.clientSecret,
        callbackURL: "/api/v1/auth/google/callback",
      },
      async (accessToken: string, refreshToken: string, profile: any, done) => {
        try {
          // Check if user already exists with this Google account
          const existingUser = await UserModel.findByEmail(
            profile.emails[0].value,
          );

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
            status: "pending", // New OAuth users need admin approval
            authType: "google",
          });

          logger.info("New user created via Google OAuth:", {
            userId: newUser.id,
            email: newUser.email,
          });

          return done(null, newUser);
        } catch (error) {
          logger.error("Google OAuth strategy error:", error);
          return done(error);
        }
      },
    ),
  );
}

// GitHub OAuth Strategy
if (config.oauth.github.clientId && config.oauth.github.clientSecret) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: config.oauth.github.clientId,
        clientSecret: config.oauth.github.clientSecret,
        callbackURL: "/api/v1/auth/github/callback",
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: any,
      ) => {
        try {
          // GitHub might not provide email in profile, so we need to handle that
          const email =
            profile.emails?.[0]?.value || `${profile.username}@github.local`;

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
            status: "pending", // New OAuth users need admin approval
            authType: "github",
          });

          logger.info("New user created via GitHub OAuth:", {
            userId: newUser.id,
            email: newUser.email,
          });

          return done(null, newUser);
        } catch (error) {
          logger.error("GitHub OAuth strategy error:", error);
          return done(error);
        }
      },
    ),
  );
}

// QQ OAuth Strategy
if (config.oauth.qq.clientId && config.oauth.qq.clientSecret) {
  passport.use(
    new QQStrategy(
      {
        clientID: config.oauth.qq.clientId,
        clientSecret: config.oauth.qq.clientSecret,
        callbackURL: "/api/v1/auth/qq/callback",
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: any,
      ) => {
        try {
          // QQ profile structure: { id, nickname, figureurl_qq_1, gender, etc. }
          const email = `${profile.id}@qq.local`; // QQ doesn't provide email by default

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
            name: profile.nickname || profile.id,
            avatarUrl: profile.figureurl_qq_1 || profile.figureurl_qq_2,
            emailVerified: false, // QQ doesn't provide email verification
            status: "pending", // New OAuth users need admin approval
            authType: "qq",
          });

          logger.info("New user created via QQ OAuth:", {
            userId: newUser.id,
            email: newUser.email,
          });

          return done(null, newUser);
        } catch (error) {
          logger.error("QQ OAuth strategy error:", error);
          return done(error);
        }
      },
    ),
  );
}

// WeChat OAuth Strategy - TODO: Implement when passport-wechat is available
// if (config.oauth.wechat.clientId && config.oauth.wechat.clientSecret) {
//   passport.use(new WeChatStrategy(
//     {
//       clientID: config.oauth.wechat.clientId,
//       clientSecret: config.oauth.wechat.clientSecret,
//       callbackURL: '/api/v1/auth/wechat/callback',
//       scope: 'snsapi_userinfo',
//     },
//     async (accessToken: string, refreshToken: string, profile: any, done: any) => {
//       try {
//         // WeChat profile structure: { openid, nickname, headimgurl, etc. }
//         const email = `${profile.openid}@wechat.local`; // WeChat doesn't provide email by default
//
//         // Check if user already exists
//         const existingUser = await UserModel.findByEmail(email);
//
//         if (existingUser) {
//           // User exists, update last login
//           await UserModel.updateLastLogin(existingUser.id);
//           return done(null, existingUser);
//         }

//         // Create new user
//         const newUser = await UserModel.create({
//           email,
//           name: profile.nickname || profile.openid,
//           avatarUrl: profile.headimgurl,
//           emailVerified: false, // WeChat doesn't provide email verification
//           status: 'pending', // New OAuth users need admin approval
//           authType: 'wechat',
//         });

//         logger.info('New user created via WeChat OAuth:', {
//           userId: newUser.id,
//           email: newUser.email,
//         });

//         return done(null, newUser);
//       } catch (error) {
//         logger.error('WeChat OAuth strategy error:', error);
//         return done(error);
//       }
//     }
//   ));
// }

// Baidu OAuth Strategy - TODO: Implement when passport-baidu is available
// if (config.oauth.baidu.clientId && config.oauth.baidu.clientSecret) {
//   passport.use(new BaiduStrategy(
//     {
//       clientID: config.oauth.baidu.clientId,
//       clientSecret: config.oauth.baidu.clientSecret,
//       callbackURL: '/api/v1/auth/baidu/callback',
//     },
//     async (accessToken: string, refreshToken: string, profile: any, done: any) => {
//       try {
//         // Baidu profile structure: { userid, username, portrait, etc. }
//         const email = `${profile.userid}@baidu.local`; // Baidu doesn't provide email by default
//
//         // Check if user already exists
//         const existingUser = await UserModel.findByEmail(email);
//
//         if (existingUser) {
//           // User exists, update last login
//           await UserModel.updateLastLogin(existingUser.id);
//           return done(null, existingUser);
//         }

//         // Create new user
//         const newUser = await UserModel.create({
//           email,
//           name: profile.username || profile.userid,
//           avatarUrl: profile.portrait ? `https://himg.bdimg.com/sys/portrait/item/${profile.portrait}` : undefined,
//           emailVerified: false, // Baidu doesn't provide email verification
//           status: 'pending', // New OAuth users need admin approval
//           authType: 'baidu',
//         });

//         logger.info('New user created via Baidu OAuth:', {
//           userId: newUser.id,
//           email: newUser.email,
//         });

//         return done(null, newUser);
//       } catch (error) {
//         logger.error('Baidu OAuth strategy error:', error);
//         return done(error);
//       }
//     }
//   ));
// }

// Note: Session serialization/deserialization removed
// This application uses JWT-based authentication (stateless)
// Sessions are not needed for JWT authentication

export default passport;
