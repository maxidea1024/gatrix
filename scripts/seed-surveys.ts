/**
 * Script to seed 1000 surveys via API (docker-compose.dev.yml environment)
 *
 * Usage:
 * 1. Make sure docker-compose.dev.yml is running
 * 2. Run: npx tsx scripts/seed-surveys.ts
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:5000/api/v1';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'YOUR_ADMIN_TOKEN_HERE';

interface TriggerCondition {
  type: 'userLevel' | 'joinDays';
  value: number;
}

interface ParticipationReward {
  rewardType: string;
  itemId: string;
  quantity: number;
}

interface CreateSurveyInput {
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent: string;
  triggerConditions: TriggerCondition[];
  participationRewards: ParticipationReward[];
  rewardMailTitle: string;
  rewardMailContent: string;
  isActive: boolean;
}

// Create axios instance with auth
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Generate random survey data
function generateSurveyData(index: number): CreateSurveyInput {
  const surveyId = `SURVEY_${String(index).padStart(5, '0')}`;

  // Random level between 1-100
  const minLevel = Math.floor(Math.random() * 50) + 1;

  // Random days between 1-30
  const minDays = Math.floor(Math.random() * 30) + 1;

  // Randomly decide which conditions to include
  const includeLevel = Math.random() > 0.3; // 70% chance
  const includeDays = Math.random() > 0.5; // 50% chance

  const triggerConditions: TriggerCondition[] = [];
  if (includeLevel) {
    triggerConditions.push({ type: 'userLevel', value: minLevel });
  }
  if (includeDays && !includeLevel) { // Only add days if level is not included (to have variety)
    triggerConditions.push({ type: 'joinDays', value: minDays });
  }

  // Ensure at least one condition
  if (triggerConditions.length === 0) {
    triggerConditions.push({ type: 'userLevel', value: 1 });
  }

  // Generate random rewards (1-3 rewards)
  const rewardCount = Math.floor(Math.random() * 3) + 1;
  const participationRewards: ParticipationReward[] = [];

  const rewardTypes = ['1', '2', '3', '4', '5']; // Different reward types
  const itemIds = ['100001', '100002', '100003', '100004', '100005', '100006', '100007', '100008'];

  for (let i = 0; i < rewardCount; i++) {
    participationRewards.push({
      rewardType: rewardTypes[Math.floor(Math.random() * rewardTypes.length)],
      itemId: itemIds[Math.floor(Math.random() * itemIds.length)],
      quantity: (Math.floor(Math.random() * 10) + 1) * 100, // 100-1000 in increments of 100
    });
  }

  // Random active status (90% active)
  const isActive = Math.random() > 0.1;

  return {
    platformSurveyId: surveyId,
    surveyTitle: `【有奖调研】诚邀提督大人参与《大航海时代：起源》问卷调研 #${index}`,
    surveyContent: `敬请通过以下问卷链接参与调查，完成后将获赠奖励。这是第 ${index} 个问卷调查。`,
    triggerConditions,
    participationRewards,
    rewardMailTitle: '问卷完成奖励',
    rewardMailContent: '感谢您参与问卷调查。',
    isActive,
  };
}

// Create a single survey via API
async function createSurvey(data: CreateSurveyInput, index: number): Promise<boolean> {
  try {
    await api.post('/admin/surveys', data);

    if (index % 100 === 0) {
      console.log(`✅ [${index}/1000] Created survey: ${data.platformSurveyId}`);
    }
    return true;
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message || 'Unknown error';

    // Only log first error in detail
    if (index === 1) {
      console.error(`\n❌ Detailed error for first survey:`);
      console.error(`Status: ${error.response?.status}`);
      console.error(`URL: ${error.config?.url}`);
      console.error(`Message:`, errorMsg);
      console.error(`\n`);
    }

    console.error(`❌ [${index}/1000] Failed: ${errorMsg}`);
    return false;
  }
}

// Main function to seed surveys
async function seedSurveys() {
  console.log('🚀 Starting to seed 1000 surveys via API...\n');

  // Check if token is set
  if (ACCESS_TOKEN === 'YOUR_ADMIN_TOKEN_HERE') {
    console.error('❌ Error: Please set ACCESS_TOKEN environment variable');
    console.log('\nRun the token generation script first:');
    console.log('  cd scripts');
    console.log('  npx tsx generate-admin-token.ts');
    console.log('\nThen run this script with the token:');
    console.log('  $env:ACCESS_TOKEN="your_token"; npx tsx seed-surveys.ts\n');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  const totalSurveys = 1000;
  const batchSize = 5; // Smaller batch size to avoid overwhelming the server

  for (let i = 0; i < totalSurveys; i += batchSize) {
    const batch = [];
    const batchEnd = Math.min(i + batchSize, totalSurveys);

    for (let j = i; j < batchEnd; j++) {
      const surveyData = generateSurveyData(j + 1);
      batch.push(createSurvey(surveyData, j + 1));
    }

    // Wait for batch to complete
    const results = await Promise.all(batch);
    successCount += results.filter(r => r).length;
    failCount += results.filter(r => !r).length;

    // Small delay between batches
    if (i + batchSize < totalSurveys) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Successfully created: ${successCount} surveys`);
  console.log(`❌ Failed: ${failCount} surveys`);
  console.log(`📈 Success rate: ${((successCount / totalSurveys) * 100).toFixed(2)}%`);
}

// Run the script
seedSurveys()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });

