import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { getAccessToken } from './client';

export interface DingTalkFileInfo {
  fileName: string;
  downloadCode?: string;
  mediaId?: string;
  mimeType?: string;
  size?: number;
  raw: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function numberField(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

export function extractDingTalkFileInfo(event: unknown): DingTalkFileInfo | null {
  const root = asRecord(event);
  const candidates = [
    root,
    asRecord(root.content),
    asRecord(root.file),
    asRecord(root.attachment),
    asRecord(root.fileContent),
    asRecord(root.message),
  ];

  for (const candidate of candidates) {
    const downloadCode = stringField(candidate, ['downloadCode', 'download_code', 'fileDownloadCode']);
    const mediaId = stringField(candidate, ['mediaId', 'media_id', 'fileId', 'file_id']);
    const fileName = stringField(candidate, [
      'fileName',
      'filename',
      'name',
      'title',
      'file_name',
    ]);

    if (downloadCode || mediaId || fileName) {
      return {
        fileName: fileName ?? `${mediaId ?? downloadCode ?? 'dingtalk-file'}.bin`,
        downloadCode,
        mediaId,
        mimeType: stringField(candidate, ['mimeType', 'contentType', 'type']),
        size: numberField(candidate, ['fileSize', 'size', 'file_size']),
        raw: event,
      };
    }
  }

  return null;
}

export async function downloadDingTalkMessageFile(
  info: DingTalkFileInfo,
  destinationPath: string
): Promise<void> {
  if (!info.downloadCode) {
    throw new Error('DingTalk file event does not include downloadCode');
  }

  const token = await getAccessToken();
  const downloadRes = await axios.post(
    'https://api.dingtalk.com/v1.0/robot/messageFiles/download',
    {
      robotCode: process.env.DINGTALK_ROBOT_CODE,
      downloadCode: info.downloadCode,
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );

  const body = downloadRes.data as { downloadUrl?: string; url?: string; result?: { downloadUrl?: string } };
  const downloadUrl = body.downloadUrl ?? body.url ?? body.result?.downloadUrl;
  if (!downloadUrl) {
    throw new Error('DingTalk file download URL is missing');
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const fileRes = await axios.get<ArrayBuffer>(downloadUrl, { responseType: 'arraybuffer' });
  fs.writeFileSync(destinationPath, Buffer.from(fileRes.data));
}

