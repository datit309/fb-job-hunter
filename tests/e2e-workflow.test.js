import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePost } from '../lib/filter-engine.js';
import { generateAIPitch } from '../lib/ai-matcher.js';
import { SafetyController } from '../content/safety.js';
import { generatePostId } from '../content/dom-scanner.js';

describe('E2E Workflow: Scan -> Filter -> AI Pitch -> Safety & Deduplication', () => {
  const config = {
    enabled: true,
    whitelistKeywords: ['cần dev', 'tìm dev', 'làm tool', 'làm web', 'làm app', 'python', 'nodejs'],
    blacklistKeywords: ['tuyển sale', 'fulltime', 'bất động sản', 'khóa học'],
    spintaxTemplates: ['{Chào bạn|Hi bạn}, mình chuyên nhận làm tool/web. Check inbox mình trao đổi chi tiết nhé!'],
    aiConfig: {
      enabled: false // test fallback spintax deterministically
    },
    minCommentDelaySec: 60,
    maxCommentDelaySec: 180,
    dailyCommentLimit: 30
  };

  it('should correctly process a stream of mixed Facebook posts through the complete pipeline', async () => {
    const safety = new SafetyController({
      dailyLimit: config.dailyCommentLimit,
      minDelaySec: 1, // for fast test
      maxDelaySec: 2
    });

    const feedPosts = [
      {
        id: 'post_101',
        author: 'Nguyễn Văn A',
        text: 'Cần tìm dev làm tool auto bot Facebook bằng Python hoặc NodeJS, ngân sách 10 triệu.',
        url: 'https://facebook.com/groups/dev/posts/101'
      },
      {
        id: 'post_102',
        author: 'Trần Thị B',
        text: 'Cần dev làm web nhưng công ty tuyển fulltime tại HCM, không nhận freelance.',
        url: 'https://facebook.com/groups/dev/posts/102'
      },
      {
        id: 'post_103',
        author: 'Lê Văn C',
        text: 'Cuối tuần có ai rảnh đi cafe chém gió không nhỉ mọi người?',
        url: 'https://facebook.com/groups/dev/posts/103'
      },
      {
        id: 'post_101', // Duplicate of post 101
        author: 'Nguyễn Văn A',
        text: 'Cần tìm dev làm tool auto bot Facebook bằng Python hoặc NodeJS, ngân sách 10 triệu.',
        url: 'https://facebook.com/groups/dev/posts/101'
      }
    ];

    const processedResults = [];

    for (const post of feedPosts) {
      // 1. Evaluate filter rules
      const evalResult = evaluatePost(post.text, config);

      if (!evalResult.matched) {
        processedResults.push({ id: post.id, status: 'filtered_out', reason: evalResult.reason });
        continue;
      }

      // 2. Safety & Duplicate check
      const safetyCheck = safety.canComment(post.id);
      if (!safetyCheck.allowed) {
        processedResults.push({ id: post.id, status: 'blocked_by_safety', reason: safetyCheck.reason });
        continue;
      }

      // 3. AI / Spintax pitch generation
      const pitchResult = await generateAIPitch(post.text, config);

      // 4. Record comment
      safety.recordComment(post.id, pitchResult.comment, post.url);
      processedResults.push({
        id: post.id,
        status: 'commented',
        author: post.author,
        comment: pitchResult.comment,
        matchedKeywords: evalResult.matchedWhitelist
      });
    }

    // Verify Post 101 was successfully commented
    assert.equal(processedResults[0].status, 'commented');
    assert.ok(processedResults[0].comment.includes('mình chuyên nhận làm tool/web'));
    assert.ok(processedResults[0].matchedKeywords.length > 0);

    // Verify Post 102 was rejected due to blacklist
    assert.equal(processedResults[1].status, 'filtered_out');
    assert.ok(processedResults[1].reason.includes('Blacklist'));

    // Verify Post 103 was rejected due to whitelist absence
    assert.equal(processedResults[2].status, 'filtered_out');
    assert.ok(processedResults[2].reason.includes('Whitelist'));

    // Verify duplicate Post 101 was blocked by safety deduplication
    assert.equal(processedResults[3].status, 'blocked_by_safety');
    assert.ok(processedResults[3].reason.includes('đã bình luận trước đó'));
  });
});
