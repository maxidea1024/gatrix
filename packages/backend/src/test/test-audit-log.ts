import axios from 'axios';

const API_URL = 'http://localhost:5001/api/v1';

interface LoginResponse {
  data: {
    token: string;
    user: {
      id: number;
      email: string;
      name: string;
      role: string;
    };
  };
}

async function testAuditLog() {
  try {
    console.log('🔐 Logging in as admin...');

    // Login as admin
    const loginResponse = await axios.post<LoginResponse>(`${API_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123',
    });

    const token = loginResponse.data.data.token;
    const adminId = loginResponse.data.data.user.id;

    console.log('✅ Logged in successfully');
    console.log('Admin ID:', adminId);

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    // Get all users
    console.log('\n📋 Getting all users...');
    const usersResponse = await axios.get(`${API_URL}/admin/users`, {
      headers,
    });
    const users = usersResponse.data.data.users;

    console.log(`Found ${users.length} users`);

    // Find a test user (not admin)
    const testUser = users.find((u: any) => u.id !== adminId && u.role === 'user');

    if (!testUser) {
      console.log('❌ No test user found. Creating one...');

      // Create a test user
      const createResponse = await axios.post(
        `${API_URL}/admin/users`,
        {
          email: 'testuser@example.com',
          name: 'Test User',
          password: 'test123',
          role: 'user',
          status: 'active',
        },
        { headers }
      );

      const newUser = createResponse.data.data.user;
      console.log('✅ Created test user:', newUser.id);

      // Test 1: Update user
      console.log('\n🔄 Test 1: Updating user...');
      await axios.put(
        `${API_URL}/admin/users/${newUser.id}`,
        {
          name: 'Test User Updated',
          tags: ['test', 'audit'],
        },
        { headers }
      );
      console.log('✅ User updated');

      // Test 2: Promote user
      console.log('\n⬆️ Test 2: Promoting user to admin...');
      await axios.post(`${API_URL}/admin/users/${newUser.id}/promote`, {}, { headers });
      console.log('✅ User promoted');

      // Test 3: Demote user
      console.log('\n⬇️ Test 3: Demoting user back to user...');
      await axios.post(`${API_URL}/admin/users/${newUser.id}/demote`, {}, { headers });
      console.log('✅ User demoted');

      // Test 4: Suspend user
      console.log('\n⏸️ Test 4: Suspending user...');
      await axios.post(`${API_URL}/admin/users/${newUser.id}/suspend`, {}, { headers });
      console.log('✅ User suspended');

      // Test 5: Unsuspend user
      console.log('\n▶️ Test 5: Unsuspending user...');
      await axios.post(`${API_URL}/admin/users/${newUser.id}/activate`, {}, { headers });
      console.log('✅ User unsuspended');

      // Test 6: Delete user
      console.log('\n🗑️ Test 6: Deleting user...');
      await axios.delete(`${API_URL}/admin/users/${newUser.id}`, { headers });
      console.log('✅ User deleted');
    } else {
      console.log('Found test user:', testUser.id, testUser.email);

      // Test 1: Update user
      console.log('\n🔄 Test 1: Updating user...');
      await axios.put(
        `${API_URL}/admin/users/${testUser.id}`,
        {
          name: testUser.name + ' (Updated)',
          tags: ['test', 'audit', 'updated'],
        },
        { headers }
      );
      console.log('✅ User updated');

      // Test 2: Suspend user
      console.log('\n⏸️ Test 2: Suspending user...');
      await axios.post(`${API_URL}/admin/users/${testUser.id}/suspend`, {}, { headers });
      console.log('✅ User suspended');

      // Test 3: Unsuspend user
      console.log('\n▶️ Test 3: Unsuspending user...');
      await axios.post(`${API_URL}/admin/users/${testUser.id}/activate`, {}, { headers });
      console.log('✅ User unsuspended');
    }

    // Test Game World operations
    console.log('\n🌍 Testing Game World operations...');

    // Get game worlds
    const worldsResponse = await axios.get(`${API_URL}/admin/game-worlds`, {
      headers,
    });
    const worlds = worldsResponse.data.data;

    if (worlds.length > 0) {
      const testWorld = worlds[0];
      console.log('Found test world:', testWorld.id, testWorld.name);

      // Test 7: Toggle visibility
      console.log('\n👁️ Test 7: Toggling world visibility...');
      await axios.patch(
        `${API_URL}/admin/game-worlds/${testWorld.id}/toggle-visibility`,
        {},
        { headers }
      );
      console.log('✅ World visibility toggled');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Toggle back
      console.log('\n👁️ Test 8: Toggling world visibility back...');
      await axios.patch(
        `${API_URL}/admin/game-worlds/${testWorld.id}/toggle-visibility`,
        {},
        { headers }
      );
      console.log('✅ World visibility toggled back');

      // Test 9: Toggle maintenance
      console.log('\n🔧 Test 9: Toggling world maintenance...');
      await axios.patch(
        `${API_URL}/admin/game-worlds/${testWorld.id}/toggle-maintenance`,
        {},
        { headers }
      );
      console.log('✅ World maintenance toggled');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Toggle back
      console.log('\n🔧 Test 10: Toggling world maintenance back...');
      await axios.patch(
        `${API_URL}/admin/game-worlds/${testWorld.id}/toggle-maintenance`,
        {},
        { headers }
      );
      console.log('✅ World maintenance toggled back');

      // Test 11: Update world
      console.log('\n📝 Test 11: Updating world...');
      await axios.put(
        `${API_URL}/admin/game-worlds/${testWorld.id}`,
        {
          name: testWorld.name + ' (Updated)',
          description: 'Updated description for audit log test',
        },
        { headers }
      );
      console.log('✅ World updated');
    } else {
      console.log('⚠️ No game worlds found. Skipping game world tests.');
    }

    // Test Invitation operations
    console.log('\n📧 Testing Invitation operations...');

    // Test 12: Create invitation
    console.log('\n➕ Test 12: Creating invitation...');
    const inviteResponse = await axios.post(
      `${API_URL}/admin/invitations`,
      {
        email: 'newinvite@example.com',
        role: 'user',
        expirationHours: 168,
      },
      { headers }
    );
    const invitation = inviteResponse.data.invitation;
    console.log('✅ Invitation created:', invitation.id);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 13: Delete invitation
    console.log('\n🗑️ Test 13: Deleting invitation...');
    await axios.delete(`${API_URL}/admin/invitations/${invitation.id}`, {
      headers,
    });
    console.log('✅ Invitation deleted');

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Now check the Realtime Events page to see the audit logs with diff view!');
    console.log('🌐 Open: http://localhost:3000/admin/realtime-events');
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Run the test
testAuditLog().catch(console.error);
