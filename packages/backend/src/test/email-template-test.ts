import EmailTemplateService from '../services/email-template-service';
import EmailService from '../services/email-service';
import { UserModel } from '../models/user';
import logger from '../config/logger';

/**
 * Test script for the new email template system
 */
async function testEmailTemplateSystem() {
  console.log('🧪 Testing Email Template System...\n');

  try {
    // Test 1: Template rendering for different languages
    console.log('📧 Test 1: Template rendering for different languages');

    const templateData = {
      name: 'John Doe',
      resetUrl: 'https://example.com/reset?token=abc123',
      loginUrl: 'https://example.com/login',
    };

    // Test English templates
    console.log('\n🇺🇸 Testing English templates:');
    const enPasswordReset = await EmailTemplateService.renderTemplate(
      'password-reset',
      'en',
      templateData
    );
    console.log(`✅ Password Reset (EN): ${enPasswordReset.subject}`);

    const enWelcome = await EmailTemplateService.renderTemplate(
      'welcome',
      'en',
      templateData
    );
    console.log(`✅ Welcome (EN): ${enWelcome.subject}`);

    const enAccountApproval = await EmailTemplateService.renderTemplate(
      'account-approval',
      'en',
      templateData
    );
    console.log(`✅ Account Approval (EN): ${enAccountApproval.subject}`);

    // Test Korean templates
    console.log('\n🇰🇷 Testing Korean templates:');
    const koPasswordReset = await EmailTemplateService.renderTemplate(
      'password-reset',
      'ko',
      templateData
    );
    console.log(`✅ Password Reset (KO): ${koPasswordReset.subject}`);

    const koWelcome = await EmailTemplateService.renderTemplate(
      'welcome',
      'ko',
      templateData
    );
    console.log(`✅ Welcome (KO): ${koWelcome.subject}`);

    const koAccountApproval = await EmailTemplateService.renderTemplate(
      'account-approval',
      'ko',
      templateData
    );
    console.log(`✅ Account Approval (KO): ${koAccountApproval.subject}`);

    // Test Chinese templates
    console.log('\n🇨🇳 Testing Chinese templates:');
    const zhPasswordReset = await EmailTemplateService.renderTemplate(
      'password-reset',
      'zh',
      templateData
    );
    console.log(`✅ Password Reset (ZH): ${zhPasswordReset.subject}`);

    const zhWelcome = await EmailTemplateService.renderTemplate(
      'welcome',
      'zh',
      templateData
    );
    console.log(`✅ Welcome (ZH): ${zhWelcome.subject}`);

    const zhAccountApproval = await EmailTemplateService.renderTemplate(
      'account-approval',
      'zh',
      templateData
    );
    console.log(`✅ Account Approval (ZH): ${zhAccountApproval.subject}`);

    // Test 2: Fallback functionality
    console.log('\n📧 Test 2: Fallback functionality');
    try {
      const fallbackTest =
        await EmailTemplateService.renderTemplateWithFallback(
          'password-reset',
          'fr' as any, // Unsupported language
          templateData
        );
      console.log(`✅ Fallback test passed: ${fallbackTest.subject}`);
    } catch (error) {
      console.log(`❌ Fallback test failed: ${error}`);
    }

    // Test 3: Available templates
    console.log('\n📧 Test 3: Available templates');
    const enTemplates = EmailTemplateService.getAvailableTemplates('en');
    console.log(`✅ Available EN templates: ${enTemplates.join(', ')}`);

    const koTemplates = EmailTemplateService.getAvailableTemplates('ko');
    console.log(`✅ Available KO templates: ${koTemplates.join(', ')}`);

    // Test 4: EmailService integration
    console.log('\n📧 Test 4: EmailService integration');

    // Test with a mock email (won't actually send in console mode)
    const testEmail = 'test@example.com';

    console.log('Testing password reset email...');
    const passwordResetResult = await EmailService.sendPasswordResetEmail(
      testEmail,
      'test-token-123'
    );
    console.log(`✅ Password reset email result: ${passwordResetResult}`);

    console.log('Testing welcome email...');
    const welcomeResult = await EmailService.sendWelcomeEmail(
      testEmail,
      'Test User'
    );
    console.log(`✅ Welcome email result: ${welcomeResult}`);

    console.log('Testing account approval email...');
    const approvalResult = await EmailService.sendAccountApprovalEmail(
      testEmail,
      'Test User'
    );
    console.log(`✅ Account approval email result: ${approvalResult}`);

    console.log('\n🎉 All email template tests completed successfully!');
  } catch (error) {
    console.error('❌ Email template test failed:', error);
    throw error;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testEmailTemplateSystem()
    .then(() => {
      console.log('\n✅ Email template system test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Email template system test failed:', error);
      process.exit(1);
    });
}

export { testEmailTemplateSystem };
