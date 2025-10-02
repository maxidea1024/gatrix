const { databaseManager } = require('../dist/config/database');

async function cleanupInvitations() {
  try {
    await databaseManager.initialize();
    const knex = databaseManager.getKnex();
    
    console.log('🔍 Checking existing invitations...');
    
    // 모든 초대 조회
    const allInvitations = await knex('chat_channel_invitations').select('*');
    console.log(`📊 Total invitations: ${allInvitations.length}`);
    
    // 상태별 카운트
    const statusCounts = await knex('chat_channel_invitations')
      .select('status')
      .count('* as count')
      .groupBy('status');
    
    console.log('📈 Status counts:');
    statusCounts.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });
    
    // pending 초대들 상세 조회
    const pendingInvitations = await knex('chat_channel_invitations')
      .where('status', 'pending')
      .select('*');
    
    console.log('\n🔍 Pending invitations:');
    pendingInvitations.forEach(inv => {
      console.log(`  ID: ${inv.id}, Channel: ${inv.channelId}, Inviter: ${inv.inviterId}, Invitee: ${inv.inviteeId}, Created: ${inv.createdAt}`);
    });
    
    // 중복 pending 초대 확인
    const duplicates = await knex('chat_channel_invitations')
      .select('channelId', 'inviteeId')
      .count('* as count')
      .where('status', 'pending')
      .groupBy('channelId', 'inviteeId')
      .having('count', '>', 1);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️ Duplicate pending invitations found:');
      duplicates.forEach(dup => {
        console.log(`  Channel ${dup.channelId}, Invitee ${dup.inviteeId}: ${dup.count} invitations`);
      });
      
      // 중복 제거 (가장 최근 것만 남기고 나머지 cancelled로 변경)
      for (const dup of duplicates) {
        const invitations = await knex('chat_channel_invitations')
          .where({
            channelId: dup.channelId,
            inviteeId: dup.inviteeId,
            status: 'pending'
          })
          .orderBy('createdAt', 'desc');
        
        // 첫 번째(가장 최근)를 제외한 나머지를 cancelled로 변경
        const toCancel = invitations.slice(1);
        for (const inv of toCancel) {
          await knex('chat_channel_invitations')
            .where('id', inv.id)
            .update({
              status: 'cancelled',
              updatedAt: new Date()
            });
          console.log(`  ✅ Cancelled duplicate invitation ID: ${inv.id}`);
        }
      }
    } else {
      console.log('\n✅ No duplicate pending invitations found');
    }
    
    console.log('\n🎉 Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    // databaseManager.disconnect()는 없으므로 knex 직접 종료
    const knex = databaseManager.getKnex();
    await knex.destroy();
    process.exit(0);
  }
}

cleanupInvitations();
