/**
 * Media Download & File Management - Phase 5
 * Downloads attachments from Discord CDN, manages temp files
 */

import { Attachment } from "discord.js";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Discord Nitro-free limit)

/** Allowed origins for attachment downloads (STA-017: prevent SSRF via poisoned URLs) */
const ALLOWED_CDN_ORIGINS = [
  "https://cdn.discordapp.com",
  "https://media.discordapp.net",
];

// Use private temp directory under PAI_DIR if available, otherwise fallback
const TEMP_DIR_BASE = process.env.PAI_DIR
  ? path.join(process.env.PAI_DIR, ".tmp", "discord-remote-control")
  : "/tmp/discord-remote-control";

// Supported MIME types
const SUPPORTED_TYPES = {
  image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"],
  document: [".pdf", ".txt", ".md", ".doc", ".docx", ".xls", ".xlsx", ".csv"],
  audio: [".mp3", ".wav", ".ogg", ".m4a", ".flac"],
  video: [".mp4", ".webm", ".avi", ".mov", ".mkv"],
  archive: [".zip", ".tar", ".gz", ".rar", ".7z"],
};

interface DownloadedFile {
  originalName: string;
  localPath: string;
  mimeType: string;
  size: number;
  type: "image" | "document" | "audio" | "video" | "archive" | "unknown";
  downloadedAt: number;
}

/**
 * Initialize temp directory
 */
export async function initializeTempDir(): Promise<string> {
  try {
    await fs.mkdir(TEMP_DIR_BASE, { recursive: true, mode: 0o700 });
    console.log(`Temp directory initialized: ${TEMP_DIR_BASE}`);
    return TEMP_DIR_BASE;
  } catch (error) {
    console.error("Failed to initialize temp directory:", error);
    throw error;
  }
}

/**
 * Download a single attachment from Discord
 */
export async function downloadAttachment(
  attachment: Attachment
): Promise<DownloadedFile | null> {
  try {
    // Validate file size
    if (attachment.size > MAX_FILE_SIZE) {
      console.warn(
        `⚠️  File too large: ${attachment.name} (${attachment.size} bytes > ${MAX_FILE_SIZE} bytes)`
      );
      return null;
    }

    // Validate attachment URL origin (STA-017: SSRF prevention)
    try {
      const url = new URL(attachment.url);
      const origin = `${url.protocol}//${url.hostname}`;
      if (!ALLOWED_CDN_ORIGINS.includes(origin)) {
        console.warn(`⚠️  Blocked download from non-Discord origin: ${origin}`);
        return null;
      }
    } catch {
      console.warn(`⚠️  Invalid attachment URL: ${attachment.url}`);
      return null;
    }

    // Download file
    console.log(`⬇️  Downloading: ${attachment.name} (${attachment.size} bytes)`);

    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(
        `Discord CDN returned ${response.status}: ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Determine file type
    const ext = path.extname(attachment.name).toLowerCase();
    let fileType: DownloadedFile["type"] = "unknown";

    for (const [type, exts] of Object.entries(SUPPORTED_TYPES)) {
      if (exts.includes(ext)) {
        fileType = type as DownloadedFile["type"];
        break;
      }
    }

    // Generate local path (sanitize filename)
    const sanitizedName = attachment.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .substring(0, 100);
    const fileId = randomUUID();
    const localPath = path.join(TEMP_DIR_BASE, `${fileId}_${sanitizedName}`);

    // Write file
    await fs.writeFile(localPath, data);

    console.log(`✅ Downloaded: ${attachment.name} → ${localPath}`);

    return {
      originalName: attachment.name,
      localPath,
      mimeType: attachment.contentType || "application/octet-stream",
      size: attachment.size,
      type: fileType,
      downloadedAt: Date.now(),
    };
  } catch (error) {
    console.error(`Failed to download ${attachment.name}:`, error);
    return null;
  }
}

/**
 * Download multiple attachments
 */
export async function downloadAttachments(
  attachments: Attachment[]
): Promise<DownloadedFile[]> {
  const results: DownloadedFile[] = [];

  for (const attachment of attachments) {
    const downloaded = await downloadAttachment(attachment);
    if (downloaded) {
      results.push(downloaded);
    }
  }

  console.log(`📦 Downloaded ${results.length} of ${attachments.length} attachments`);
  return results;
}

/**
 * Clean up temporary files
 */
export async function cleanupTempFile(localPath: string): Promise<boolean> {
  try {
    // Safety check: resolve to absolute path and verify it's within temp directory
    const resolved = path.resolve(localPath);
    const tempBase = path.resolve(TEMP_DIR_BASE) + path.sep;
    if (!resolved.startsWith(tempBase)) {
      console.warn(`Attempted to delete file outside temp dir: ${localPath}`);
      return false;
    }

    await fs.unlink(localPath);
    console.log(`🗑️  Deleted: ${localPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete ${localPath}:`, error);
    return false;
  }
}

/**
 * Clean up multiple temp files
 */
export async function cleanupTempFiles(paths: string[]): Promise<number> {
  let deletedCount = 0;

  for (const path of paths) {
    if (await cleanupTempFile(path)) {
      deletedCount++;
    }
  }

  console.log(`🧹 Cleanup: deleted ${deletedCount} temp files`);
  return deletedCount;
}

/**
 * Get file info without downloading
 */
export function getFileInfo(
  attachment: Attachment
): { type: DownloadedFile["type"]; size: number; mimeType: string } {
  const ext = path.extname(attachment.name).toLowerCase();
  let fileType: DownloadedFile["type"] = "unknown";

  for (const [type, exts] of Object.entries(SUPPORTED_TYPES)) {
    if (exts.includes(ext)) {
      fileType = type as DownloadedFile["type"];
      break;
    }
  }

  return {
    type: fileType,
    size: attachment.size,
    mimeType: attachment.contentType || "application/octet-stream",
  };
}

/**
 * Check if attachment is supported
 */
export function isAttachmentSupported(attachment: Attachment): boolean {
  // Check file size
  if (attachment.size > MAX_FILE_SIZE) {
    return false;
  }

  // Check file type
  const ext = path.extname(attachment.name).toLowerCase();
  return Object.values(SUPPORTED_TYPES).some((exts) => exts.includes(ext));
}

/**
 * Clean up old temp files (older than specified age)
 */
export async function cleanupOldFiles(
  maxAgeMs: number = 1 * 60 * 60 * 1000 // Default: 1 hour
): Promise<number> {
  try {
    const cutoffTime = Date.now() - maxAgeMs;
    let deletedCount = 0;

    const files = await fs.readdir(TEMP_DIR_BASE);

    for (const file of files) {
      const filePath = path.join(TEMP_DIR_BASE, file);
      const stat = await fs.stat(filePath);

      if (stat.mtimeMs < cutoffTime) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old temp files`);
    }

    return deletedCount;
  } catch (error) {
    console.error("Failed to cleanup old files:", error);
    return 0;
  }
}

/**
 * Get temp directory statistics
 */
export async function getTempDirStats(): Promise<{
  totalFiles: number;
  totalSize: number;
  oldestFile: number | null;
  newestFile: number | null;
}> {
  try {
    const files = await fs.readdir(TEMP_DIR_BASE);
    let totalSize = 0;
    let oldestFile: number | null = null;
    let newestFile: number | null = null;

    for (const file of files) {
      const filePath = path.join(TEMP_DIR_BASE, file);
      const stat = await fs.stat(filePath);
      totalSize += stat.size;

      if (!oldestFile || stat.mtimeMs < oldestFile) {
        oldestFile = stat.mtimeMs;
      }
      if (!newestFile || stat.mtimeMs > newestFile) {
        newestFile = stat.mtimeMs;
      }
    }

    return {
      totalFiles: files.length,
      totalSize,
      oldestFile,
      newestFile,
    };
  } catch (error) {
    console.error("Failed to get temp dir stats:", error);
    return {
      totalFiles: 0,
      totalSize: 0,
      oldestFile: null,
      newestFile: null,
    };
  }
}
