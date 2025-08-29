# Email Setup Guide

This guide explains how to configure email sending for the Gatrix application.
You can choose between **SendGrid (Recommended)** or **Gmail SMTP**.

## 🚀 Option 1: SendGrid Setup (Recommended)

### **1. Create SendGrid Account**
1. Sign up at [SendGrid](https://sendgrid.com/)
2. Free plan: Up to 100 emails per month
3. Complete email verification

### **2. Generate API Key**
1. Log in to SendGrid dashboard
2. Navigate to **Settings** > **API Keys**
3. Click **Create API Key**
4. **API Key Name**: `Gatrix Application`
5. **API Key Permissions**: Select **Full Access**
6. Click **Create & View**
7. Copy the generated API key (shown only once)

### **3. Configure Sender Identity**
1. Navigate to **Settings** > **Sender Authentication**
2. Select **Single Sender Verification**
3. Enter sender information:
   - **From Name**: `Gatrix`
   - **From Email**: Your actual email address
   - **Reply To**: Same email address
4. Click **Create** and complete email verification

### **4. Configure .env File**
```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your-api-key-here
SENDGRID_FROM=Gatrix <noreply@yourdomain.com>
SENDGRID_VERIFIED_SENDER=noreply@yourdomain.com
```

---

## 📧 Option 2: Gmail SMTP Setup

### 1. Google Account Setup
1. Go to [Google Account Management](https://myaccount.google.com/)
2. Navigate to **Security** tab
3. Ensure **2-Step Verification** is enabled (required)

### 2. Generate App Password
1. Go to **Security** > **Signing in to Google** > **App passwords**
2. Select **App** > **Other (Custom name)**
3. Enter app name: `Gatrix Application`
4. Click **Generate**
5. Copy the generated 16-digit password (remove spaces)

## ⚙️ Environment Variable Configuration

### **Automatic Provider Selection**
The system automatically selects email providers in the following priority:
1. **SendGrid** (if SENDGRID_API_KEY is configured)
2. **SMTP** (if SMTP configuration is complete)
3. **Console** (if no configuration - for development)

### **SendGrid Configuration (Recommended)**
```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your-sendgrid-api-key-here
SENDGRID_FROM=Gatrix <noreply@yourdomain.com>
SENDGRID_VERIFIED_SENDER=noreply@yourdomain.com
```

### **Gmail SMTP Configuration**
```env
# SMTP Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-digit-app-password
SMTP_FROM=Gatrix <your-gmail@gmail.com>
```

### **Configuration Value Descriptions**

#### SendGrid:
- **SENDGRID_API_KEY**: API key generated from SendGrid
- **SENDGRID_FROM**: Sender information (verified email)
- **SENDGRID_VERIFIED_SENDER**: Verified sender email

#### SMTP:
- **SMTP_HOST**: SMTP server address
- **SMTP_PORT**: SMTP port (587 recommended)
- **SMTP_SECURE**: Whether to use TLS
- **SMTP_USER**: Email account
- **SMTP_PASS**: App password
- **SMTP_FROM**: Sender information

## 📨 Types of Emails Sent

### 1. Password Reset Email
- Sent when users request password reset
- Contains reset link (valid for 1 hour)

### 2. Account Approval Notification Email
- Sent when admin approves user accounts
- Contains login link
- Welcome message and available features guide

## 🚨 Important Notes

### Security
- Never share app passwords
- Do not commit .env files to Git
- Use dedicated email accounts for production environments

### Limitations
- Gmail has daily sending limits (personal accounts: 500 emails/day)
- Consider professional email services for bulk sending

## 🔍 Testing Methods

### **1. Provider Verification**
```bash
# Start backend server
npm run dev

# Check email provider in logs
# "Email provider initialized: SendGrid" or
# "Email provider initialized: SMTP" or
# "No email provider configured"
```

### **2. Approval Email Test**
1. Create new account (pending status)
2. Login as admin
3. Approve account in user management
4. Verify email reception

### **3. Provider-specific Log Verification**
- **SendGrid**: `Email sent successfully via SendGrid`
- **SMTP**: `Email sent successfully via SMTP`
- **Console**: `EMAIL CONTENT (NO PROVIDER CONFIGURED)`

## 🛠️ Troubleshooting

### **SendGrid Errors**
```
Error: Forbidden
```
- Verify API key is correct
- Ensure Sender Identity is verified
- Check API key has Full Access permissions

### **SMTP Connection Errors**
```
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```
- Verify app password is correct
- Ensure 2-Step Verification is enabled

### **Sender Authentication Errors**
```
Error: The from address does not match a verified Sender Identity
```
- Sender email verification required in SendGrid
- Ensure SENDGRID_FROM matches verified email

### **Environment Variables Not Recognized**
- Check .env file location (`packages/backend/.env`)
- Server restart required
- Check for typos in environment variable names

## 📞 Support

If you have configuration issues or need additional help:
1. Check log files
2. Re-verify environment variable settings
3. Check Gmail account security settings
