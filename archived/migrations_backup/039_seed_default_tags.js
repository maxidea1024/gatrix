// Seed default tags for the system
exports.name = 'Seed default tags';

exports.up = async function (connection) {
  console.log('Seeding default tags...');

  try {
    // Check if tags already exist
    const [existingTags] = await connection.execute('SELECT COUNT(*) as count FROM g_tags');

    if (existingTags[0].count > 0) {
      console.log('✓ Tags already exist, skipping seed');
      return;
    }

    // Default tags to seed
    const defaultTags = [
      {
        name: 'Event',
        color: '#FF6B6B',
        description: 'Event-related items',
      },
      {
        name: 'Promotion',
        color: '#4ECDC4',
        description: 'Promotional items and campaigns',
      },
      {
        name: 'Maintenance',
        color: '#FFE66D',
        description: 'Maintenance-related items',
      },
      {
        name: 'Bug Fix',
        color: '#95E1D3',
        description: 'Bug fix and patch items',
      },
      {
        name: 'Feature',
        color: '#A8E6CF',
        description: 'New feature items',
      },
      {
        name: 'Important',
        color: '#FF8B94',
        description: 'Important items requiring attention',
      },
      {
        name: 'Testing',
        color: '#C7CEEA',
        description: 'Testing and QA items',
      },
      {
        name: 'Documentation',
        color: '#B5EAD7',
        description: 'Documentation and guides',
      },
      {
        name: 'New',
        color: '#90EE90',
        description: 'Newly added features',
      },
      {
        name: 'Deprecated',
        color: '#D3D3D3',
        description: 'Deprecated items to be removed',
      },
      {
        name: 'Disabled',
        color: '#A9A9A9',
        description: 'Disabled or inactive items',
      },
      {
        name: 'Enabled',
        color: '#32CD32',
        description: 'Enabled or active items',
      },
    ];

    // Insert default tags
    for (const tag of defaultTags) {
      await connection.execute(
        'INSERT INTO g_tags (name, color, description, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())',
        [tag.name, tag.color, tag.description]
      );
      console.log(`✓ Created tag: ${tag.name}`);
    }

    console.log('✅ Default tags seeded successfully');
  } catch (error) {
    console.error('Error seeding default tags:', error);
    throw error;
  }
};

exports.down = async function (connection) {
  console.log('Rolling back default tags...');

  try {
    const defaultTagNames = [
      'Event',
      'Promotion',
      'Maintenance',
      'Bug Fix',
      'Feature',
      'Important',
      'Testing',
      'Documentation',
      'New',
      'Deprecated',
      'Disabled',
      'Enabled',
    ];

    for (const tagName of defaultTagNames) {
      await connection.execute('DELETE FROM g_tags WHERE name = ?', [tagName]);
      console.log(`✓ Deleted tag: ${tagName}`);
    }

    console.log('✅ Default tags rollback completed');
  } catch (error) {
    console.error('Error rolling back default tags:', error);
    throw error;
  }
};
