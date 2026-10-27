import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCampaignSchedule,
  generateBulkCampaignPosts,
  exportCampaignToCsv,
  exportMetaBulkCsv,
  updateCampaignPostStatus,
  PRIME_HOURS
} from '../lib/business-suite-planner.js';

test('PRIME_HOURS contains expected optimal posting time slots', () => {
  assert.ok(Array.isArray(PRIME_HOURS));
  assert.ok(PRIME_HOURS.length >= 3);
  assert.ok(PRIME_HOURS.includes('08:30'));
  assert.ok(PRIME_HOURS.includes('11:45'));
  assert.ok(PRIME_HOURS.includes('19:30'));
});

test('generateCampaignSchedule generates correct slots for N days', () => {
  const baseDate = new Date('2026-10-24T00:00:00Z');
  const slots = generateCampaignSchedule({
    startDate: baseDate,
    daysCount: 7,
    preferredHours: ['09:00', '14:00', '20:00']
  });

  assert.equal(slots.length, 7);
  assert.equal(slots[0].date, '2026-10-24');
  assert.equal(slots[0].time, '09:00');
  assert.equal(slots[1].date, '2026-10-25');
  assert.equal(slots[1].time, '14:00');
  assert.equal(slots[2].date, '2026-10-26');
  assert.equal(slots[2].time, '20:00');
  assert.equal(slots[3].date, '2026-10-27');
  assert.equal(slots[3].time, '09:00'); // cycles back
});

test('generateBulkCampaignPosts generates full campaign with distinct topics and fallback templates', async () => {
  const posts = await generateBulkCampaignPosts({
    count: 5,
    contactInfo: 'Zalo: 0987.654.321',
    serviceHighlights: 'Bàn giao mã nguồn 100%, bảo hành 1 năm'
  });

  assert.equal(posts.length, 5);
  posts.forEach((post, idx) => {
    assert.ok(post.id, `post ${idx} should have id`);
    assert.ok(post.scheduledDate, `post ${idx} should have scheduledDate`);
    assert.ok(post.scheduledTime, `post ${idx} should have scheduledTime`);
    assert.ok(post.content.length > 50, `post ${idx} content should be substantial`);
    assert.ok(post.content.includes('0987.654.321'), `post ${idx} should include contact info`);
    assert.equal(post.status, 'pending');
  });

  // Verify topics are varied
  const topics = posts.map(p => p.topic);
  const uniqueTopics = new Set(topics);
  assert.ok(uniqueTopics.size >= 3, 'Should have multiple unique topics across posts');
});

test('exportCampaignToCsv produces valid RFC-4180 compliant CSV', () => {
  const mockPosts = [
    {
      id: 'p1',
      scheduledDate: '2026-10-24',
      scheduledTime: '08:30',
      title: 'Thiết kế Web "Chuẩn SEO"',
      content: 'Dòng 1, có dấu phẩy\nDòng 2, có "ngoặc kép"',
      status: 'pending'
    },
    {
      id: 'p2',
      scheduledDate: '2026-10-25',
      scheduledTime: '11:45',
      title: 'Tool Automation',
      content: 'Tool tự động hóa không có ký tự đặc biệt',
      status: 'scheduled'
    }
  ];

  const csv = exportCampaignToCsv(mockPosts);
  assert.ok(csv.startsWith('Date,Time,Title,Content,Status\n'));
  assert.ok(csv.includes('"2026-10-24"'));
  assert.ok(csv.includes('"08:30"'));
  assert.ok(csv.includes('""Chuẩn SEO""')); // escaped quotes
  assert.ok(csv.includes('""ngoặc kép""'));
  assert.ok(csv.includes('Dòng 1, có dấu phẩy'));
});

test('updateCampaignPostStatus updates post status correctly', () => {
  const posts = [
    { id: 'p1', status: 'pending' },
    { id: 'p2', status: 'pending' }
  ];

  const updated = updateCampaignPostStatus(posts, 'p1', 'scheduled');
  assert.equal(updated.find(p => p.id === 'p1').status, 'scheduled');
  assert.equal(updated.find(p => p.id === 'p2').status, 'pending');
});

test('exportMetaBulkCsv generates Meta bulk_post_composer upload format with single timestamp column', () => {
  const mockPosts = [
    {
      id: 'p1',
      scheduledDate: '2026-10-24',
      scheduledTime: '08:30',
      title: 'Thiết kế Web "Chuẩn SEO"',
      content: '🚀 TIÊU ĐỀ BÀI ĐĂNG\nNội dung bài viết chi tiết...',
      status: 'pending'
    },
    {
      id: 'p2',
      scheduledDate: '2026-10-25',
      scheduledTime: '11:45',
      title: 'Tool Automation',
      content: '⚡ TIÊU ĐỀ TOOL\nNội dung bài số 2',
      status: 'pending'
    }
  ];

  const csv = exportMetaBulkCsv(mockPosts);
  assert.ok(csv.startsWith('Date and time,Text\n'));
  assert.ok(csv.includes('"2026-10-24 08:30"'));
  assert.ok(csv.includes('"2026-10-25 11:45"'));
  assert.ok(csv.includes('TIÊU ĐỀ BÀI ĐĂNG'));
});

