import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateAIPitch, buildSystemPrompt } from '../lib/ai-matcher.js';

describe('AI Matcher & Pitch Generator', () => {
  it('should build a comprehensive default system prompt with custom prompt if provided', () => {
    const prompt1 = buildSystemPrompt();
    assert.ok(prompt1.includes('freelance'));
    assert.ok(prompt1.includes('ngắn gọn'));

    const custom = 'Ưu tiên nhấn mạnh kinh nghiệm 5 năm làm React và Python';
    const prompt2 = buildSystemPrompt(custom);
    assert.ok(prompt2.includes(custom));
  });

  it('should fallback to spintax if ai is disabled or apiKey is missing', async () => {
    const config = {
      aiEnabled: false,
      aiApiKey: '',
      spintaxTemplates: ['{Chào bạn|Hi bạn}, mình nhận làm web.']
    };

    const res = await generateAIPitch('Cần làm web bán hàng', config);
    assert.equal(res.success, true);
    assert.equal(res.fallbackUsed, true);
    assert.ok(res.comment.includes('mình nhận làm web'));
  });

  it('should call DeepSeek API and parse comment output correctly when configured', async () => {
    const mockApiResponse = {
      choices: [
        {
          message: {
            content: 'Chào bạn, mình chuyên làm bot Python và cào dữ liệu tự động, đã từng build nhiều tool tương tự. Bạn check inbox mình trao đổi demo nhé!'
          }
        }
      ]
    };

    let capturedUrl = '';
    let capturedBody = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => mockApiResponse
      };
    };

    const config = {
      aiEnabled: true,
      aiProvider: 'deepseek',
      aiApiKey: 'sk-test-deepseek-key',
      spintaxTemplates: ['fallback comment']
    };

    const postText = 'Tìm người viết bot python telegram cào dữ liệu web';
    const res = await generateAIPitch(postText, config, mockFetch);

    assert.equal(res.success, true);
    assert.equal(res.fallbackUsed, false);
    assert.equal(res.provider, 'deepseek');
    assert.ok(res.comment.includes('bot Python'));
    assert.equal(capturedUrl, 'https://api.deepseek.com/chat/completions');
    assert.equal(capturedBody.model, 'deepseek-chat');
    assert.ok(capturedBody.messages[1].content.includes(postText));
  });

  it('should call OpenAI API correctly when configured', async () => {
    const mockApiResponse = {
      choices: [
        {
          message: {
            content: 'Hi bạn, bên mình chuyên Next.js fullstack. Check ib mình gửi portfolio nhé.'
          }
        }
      ]
    };

    const mockFetch = async (url, options) => {
      return {
        ok: true,
        json: async () => mockApiResponse
      };
    };

    const config = {
      aiEnabled: true,
      aiProvider: 'openai',
      aiApiKey: 'sk-openai-test-key'
    };

    const res = await generateAIPitch('Cần làm web Nextjs', config, mockFetch);
    assert.equal(res.success, true);
    assert.equal(res.provider, 'openai');
    assert.ok(res.comment.includes('Next.js fullstack'));
  });

  it('should fallback gracefully to spintax if API returns HTTP error or network failure', async () => {
    const failingFetch = async () => {
      throw new Error('Network timeout');
    };

    const config = {
      aiEnabled: true,
      aiProvider: 'deepseek',
      aiApiKey: 'sk-deepseek-bad',
      spintaxTemplates: ['{Chào bạn}, mình làm được nhé.']
    };

    const res = await generateAIPitch('Cần làm app mobile', config, failingFetch);
    assert.equal(res.success, true);
    assert.equal(res.fallbackUsed, true);
    assert.ok(res.comment.includes('mình làm được'));
    assert.ok(res.error.includes('Network timeout'));
  });

  it('should call custom endpoint and custom model when provider is custom', async () => {
    let capturedUrl = '';
    let capturedBody = null;
    let capturedHeaders = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      capturedHeaders = options.headers;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Custom Pitch for Flutter Job' } }]
        })
      };
    };

    const config = {
      aiConfig: {
        enabled: true,
        provider: 'custom',
        apiKey: 'sk-openrouter-key',
        customEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
        customModel: 'meta-llama/llama-3.3-70b-instruct'
      }
    };

    const res = await generateAIPitch('Tuyển dev Flutter', config, mockFetch);
    assert.equal(res.success, true);
    assert.equal(capturedUrl, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(capturedBody.model, 'meta-llama/llama-3.3-70b-instruct');
    assert.equal(capturedHeaders.Authorization, 'Bearer sk-openrouter-key');
    assert.equal(res.comment, 'Custom Pitch for Flutter Job');
  });

  it('should support local LLM (Ollama) with custom endpoint and no apiKey', async () => {
    let capturedUrl = '';
    let capturedHeaders = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Local Ollama Pitch' } }]
        })
      };
    };

    const config = {
      aiConfig: {
        enabled: true,
        provider: 'custom',
        apiKey: '',
        customEndpoint: 'http://localhost:11434/v1/chat/completions',
        customModel: 'qwen2.5:latest'
      }
    };

    const res = await generateAIPitch('Tuyển dev Python', config, mockFetch);
    assert.equal(res.success, true);
    assert.equal(capturedUrl, 'http://localhost:11434/v1/chat/completions');
    assert.equal(capturedHeaders.Authorization, undefined);
    assert.equal(res.comment, 'Local Ollama Pitch');
  });
});
