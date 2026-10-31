import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateChatCompletion, mockGetVlmModel } = vi.hoisted(() => ({
  mockCreateChatCompletion: vi.fn(),
  mockGetVlmModel: vi.fn()
}));

vi.mock('@fastgpt/service/core/ai/llm/request/createChatCompletion', () => ({
  createChatCompletion: mockCreateChatCompletion
}));

vi.mock('@fastgpt/service/core/ai/model', () => ({
  getVlmModel: mockGetVlmModel
}));

import { isVlmOcrAvailable, recognizeImageWithVlm } from '@fastgpt/service/common/file/read/vlmOcr';

const visionModel = {
  model: 'qwen-vl-max',
  name: 'qwen-vl-max',
  vision: true
};

const createCompletionResponse = (content: string) => ({
  response: {
    choices: [{ message: { role: 'assistant', content } }]
  },
  isStreamResponse: false,
  requestMeta: { usedUserOpenAIKey: false }
});

describe('isVlmOcrAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('配置了视觉模型时返回 true', () => {
    mockGetVlmModel.mockReturnValue(visionModel);
    expect(isVlmOcrAvailable()).toBe(true);
    expect(mockGetVlmModel).toHaveBeenCalledWith('qwen3.5-ocr');
  });

  it('优先按专用读图模型名解析视觉模型', () => {
    mockGetVlmModel.mockReturnValue(visionModel);
    isVlmOcrAvailable();
    expect(mockGetVlmModel).toHaveBeenCalledWith('qwen3.5-ocr');
  });

  it('没有配置视觉模型时返回 false', () => {
    mockGetVlmModel.mockReturnValue(undefined);
    expect(isVlmOcrAvailable()).toBe(false);
  });
});

describe('recognizeImageWithVlm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVlmModel.mockReturnValue(visionModel);
  });

  it('把图片转为 data URL 提交视觉模型并返回识别文本', async () => {
    mockCreateChatCompletion.mockResolvedValueOnce(
      createCompletionResponse('  第一行文字\n第二行文字  ')
    );
    const buffer = Buffer.from('png-bytes');

    const result = await recognizeImageWithVlm({
      buffer,
      mime: 'image/png'
    });

    expect(result).toBe('第一行文字\n第二行文字');
    expect(mockGetVlmModel).toHaveBeenCalledWith('qwen3.5-ocr');
    expect(mockCreateChatCompletion).toHaveBeenCalledTimes(1);

    const props = mockCreateChatCompletion.mock.calls[0][0];
    expect(props.modelData).toBe(visionModel);
    const content = props.body.messages[0].content;
    expect(content[0].text).toContain('只输出图片中真实存在的文字');
    expect(content[1].image_url.url).toBe(
      `data:image/png;base64,${buffer.toString('base64')}`
    );
  });

  it('没有可用视觉模型时返回空文本且不发起请求', async () => {
    mockGetVlmModel.mockReturnValue(undefined);

    const result = await recognizeImageWithVlm({
      buffer: Buffer.from('x'),
      mime: 'image/jpeg'
    });

    expect(result).toBe('');
    expect(mockCreateChatCompletion).not.toHaveBeenCalled();
  });

  it('模型明确表示没有文字时归一化为空文本', async () => {
    mockCreateChatCompletion.mockResolvedValueOnce(createCompletionResponse('NO_TEXT'));

    const result = await recognizeImageWithVlm({
      buffer: Buffer.from('x'),
      mime: 'image/png'
    });

    expect(result).toBe('');
  });

  it('模型返回版式 JSON 噪声时视为没有文字', async () => {
    mockCreateChatCompletion.mockResolvedValueOnce(
      createCompletionResponse(
        '```json\n[{"rotate_rect": [527, 328, 85, 172, 90], "text": "100%"}]\n```'
      )
    );

    const result = await recognizeImageWithVlm({
      buffer: Buffer.from('x'),
      mime: 'image/png'
    });

    expect(result).toBe('');
  });

  it('模型返回无围栏版式 JSON 时也视为没有文字', async () => {
    mockCreateChatCompletion.mockResolvedValueOnce(
      createCompletionResponse('[{"rotate_rect": [1, 2, 3, 4, 90], "text": "O"}]')
    );

    const result = await recognizeImageWithVlm({
      buffer: Buffer.from('x'),
      mime: 'image/png'
    });

    expect(result).toBe('');
  });

  it('普通 JSON 内容不被当作版式噪声丢弃', async () => {
    mockCreateChatCompletion.mockResolvedValueOnce(
      createCompletionResponse('{"name": "Lugang", "version": 3}')
    );

    const result = await recognizeImageWithVlm({
      buffer: Buffer.from('x'),
      mime: 'image/png'
    });

    expect(result).toBe('{"name": "Lugang", "version": 3}');
  });

  it('识别请求失败时返回空文本而不是抛出', async () => {
    mockCreateChatCompletion.mockRejectedValueOnce(new Error('request timeout'));

    await expect(
      recognizeImageWithVlm({
        buffer: Buffer.from('x'),
        mime: 'image/png'
      })
    ).resolves.toBe('');
  });
});
