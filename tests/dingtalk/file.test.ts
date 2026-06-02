import { extractDingTalkFileInfo } from '../../src/dingtalk/file';

describe('dingtalk file', () => {
  it('extracts file info from Stream file messages', () => {
    const event = {
      msgtype: 'file',
      content: {
        fileName: '学员手册.pdf',
        downloadCode: 'download-code',
        fileId: 'file-123',
      },
    };

    expect(extractDingTalkFileInfo(event)).toEqual({
      fileName: '学员手册.pdf',
      downloadCode: 'download-code',
      mediaId: 'file-123',
      mimeType: undefined,
      size: undefined,
      raw: event,
    });
  });
});

