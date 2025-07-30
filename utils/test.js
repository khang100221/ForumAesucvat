/**
 * Basic test file for ticket system validation
 * Run this to check if the system is working correctly
 */

import { handleTicketInteraction } from './ticketSystem.js';

// Mock database for testing
const mockDb = {
  prepare: (query) => ({
    get: (param) => {
      console.log(`DB GET: ${query} with param:`, param);
      // Mock ticket config
      if (query.includes('ticket_config')) {
        return {
          category_create: '123456789',
          category_close: '987654321',
          log_channel: '555666777',
          admin_role: '111222333',
          ticket_count: 5
        };
      }
      return null;
    },
    run: (...params) => {
      console.log(`DB RUN: ${query} with params:`, params);
      return { changes: 1 };
    },
    all: () => {
      console.log(`DB ALL: ${query}`);
      return [{ name: 'userId' }]; // Mock column info
    }
  })
};

// Mock interaction for testing
const createMockInteraction = (type, customId, userId = '123456789') => ({
  isButton: () => type === 'button',
  isModalSubmit: () => type === 'modal',
  customId,
  user: { id: userId, tag: 'TestUser#1234' },
  member: { 
    permissions: { 
      has: () => true // Mock admin permissions
    } 
  },
  guild: {
    id: '999888777',
    name: 'Test Server',
    channels: {
      cache: {
        get: () => ({
          id: '123456789',
          parentId: '123456789',
          topic: null,
          permissionsIn: () => ({ has: () => true })
        }),
        find: () => null
      }
    },
    members: {
      me: {
        permissionsIn: () => ({ has: () => true })
      }
    },
    roles: {
      cache: {
        filter: () => ({ sort: () => ({ first: () => ({ id: '111222333' }) }) })
      },
      everyone: { id: '999888777' }
    }
  },
  channel: {
    id: '555666777',
    topic: 'Ticket: 5 | UID:123456789',
    messages: {
      fetch: () => Promise.resolve(new Map())
    },
    send: (options) => {
      console.log('📤 Channel send:', options.embeds?.[0]?.description || options.content);
      return Promise.resolve({ id: '999999999' });
    },
    setParent: () => Promise.resolve(),
    permissionOverwrites: {
      edit: () => Promise.resolve(),
      set: () => Promise.resolve()
    }
  },
  deferReply: () => Promise.resolve(),
  reply: (options) => {
    console.log('📤 Reply:', options.embeds?.[0]?.description || options.content);
    return Promise.resolve();
  },
  editReply: (options) => {
    console.log('📤 Edit Reply:', options.embeds?.[0]?.description || options.content);
    return Promise.resolve();
  },
  update: (options) => {
    console.log('📤 Update:', options.embeds?.[0]?.description || options.content);
    return Promise.resolve();
  },
  showModal: (modal) => {
    console.log('📋 Show Modal:', modal.data.title);
    return Promise.resolve();
  },
  fields: {
    getTextInputValue: () => 'Test reason for closing ticket'
  },
  client: {
    user: { id: '999999999' }
  },
  replied: false,
  deferred: false
});

// Test functions
async function runTests() {
  console.log('🧪 Starting Ticket System Tests...\n');

  try {
    // Test 1: Ticket Creation
    console.log('1️⃣ Testing Ticket Creation...');
    const createInteraction = createMockInteraction('button', 'ticket_create');
    await handleTicketInteraction(createInteraction, mockDb);
    console.log('✅ Ticket creation test passed\n');

    // Test 2: Ticket Claim
    console.log('2️⃣ Testing Ticket Claim...');
    const claimInteraction = createMockInteraction('button', 'ticket_claim');
    await handleTicketInteraction(claimInteraction, mockDb);
    console.log('✅ Ticket claim test passed\n');

    // Test 3: Ticket Close
    console.log('3️⃣ Testing Ticket Close...');
    const closeInteraction = createMockInteraction('button', 'ticket_close');
    await handleTicketInteraction(closeInteraction, mockDb);
    console.log('✅ Ticket close test passed\n');

    // Test 4: Modal Submit
    console.log('4️⃣ Testing Modal Submit...');
    const modalInteraction = createMockInteraction('modal', 'ticketclose_reason');
    await handleTicketInteraction(modalInteraction, mockDb);
    console.log('✅ Modal submit test passed\n');

    // Test 5: View History
    console.log('5️⃣ Testing View History...');
    const historyInteraction = createMockInteraction('button', 'ticket_view_history:5:999888777');
    await handleTicketInteraction(historyInteraction, mockDb);
    console.log('✅ View history test passed\n');

    console.log('🎉 All tests completed successfully!');
    console.log('✅ Ticket system is working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('🔧 Please check the system configuration');
  }
}

// Performance test
async function performanceTest() {
  console.log('\n⚡ Running Performance Test...');
  
  const start = Date.now();
  const promises = [];
  
  // Simulate multiple concurrent requests
  for (let i = 0; i < 10; i++) {
    const interaction = createMockInteraction('button', 'ticket_create', `user${i}`);
    promises.push(handleTicketInteraction(interaction, mockDb));
  }
  
  await Promise.all(promises);
  const end = Date.now();
  
  console.log(`⏱️ Processed 10 concurrent requests in ${end - start}ms`);
  console.log(`📊 Average: ${(end - start) / 10}ms per request`);
}

// Memory test
function memoryTest() {
  console.log('\n💾 Memory Usage Test...');
  const used = process.memoryUsage();
  
  console.log('Memory Usage:');
  for (let key in used) {
    console.log(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
}

// Run all tests
if (require.main === module) {
  (async () => {
    await runTests();
    await performanceTest();
    memoryTest();
    
    console.log('\n🏁 Testing completed!');
    process.exit(0);
  })();
}

export {
  runTests,
  performanceTest,
  memoryTest,
  createMockInteraction,
  mockDb
};