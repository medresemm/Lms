import { randomUUID } from "crypto";
import { PassThrough, type Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function s3Client() {
  const endpoint = process.env.SUPABASE_S3_ENDPOINT;
  const region = process.env.SUPABASE_S3_REGION ?? "us-east-1";
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Fayl yaddaşı üçün SUPABASE_S3_* dəyişənləri təyin edilməyib.");
  }
  return new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bucketName() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET təyin edilməyib.");
  return bucket;
}

async function signedPutUrl(key: string, contentType?: string) {
  const client = s3Client();
  const command = new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: 15 * 60 });
}

export interface StoredFile {
  getMetadata(): Promise<[{ size?: number; contentType?: string }]>;
  createReadStream(): Readable;
  exists(): Promise<[boolean]>;
  delete(opts?: { ignoreNotFound?: boolean }): Promise<void>;
}

function makeStoredFile(key: string): StoredFile {
  return {
    async getMetadata() {
      try {
        const head = await s3Client().send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
        return [{ size: head.ContentLength, contentType: head.ContentType }];
      } catch {
        throw new Error("Fayl tapılmadı.");
      }
    },
    async exists() {
      try {
        await s3Client().send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
        return [true];
      } catch {
        return [false];
      }
    },
    createReadStream() {
      const pass = new PassThrough();
      s3Client()
        .send(new GetObjectCommand({ Bucket: bucketName(), Key: key }))
        .then((result) => {
          const body = result.Body as Readable | undefined;
          if (!body) {
            pass.emit("error", new Error("Fayl boşdur."));
            return;
          }
          body.on("error", (err) => pass.emit("error", err));
          body.pipe(pass);
        })
        .catch((err) => pass.emit("error", err));
      return pass;
    },
    async delete(opts) {
      try {
        await s3Client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
      } catch (error) {
        if (!opts?.ignoreNotFound) throw error;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function createApplicationUploadUrl() {
  const key = `applications/${randomUUID()}`;
  return { uploadURL: await signedPutUrl(key), objectPath: `/objects/${key}` };
}

export async function getApplicationFile(objectPath: string): Promise<StoredFile> {
  if (!/^\/objects\/applications\/[a-zA-Z0-9-]+$/.test(objectPath)) throw new Error("Yanlış fayl yolu.");
  const key = objectPath.replace("/objects/", "");
  const file = makeStoredFile(key);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Fayl tapılmadı.");
  return file;
}

export async function deleteApplicationFile(objectPath: string) {
  const file = await getApplicationFile(objectPath);
  await file.delete({ ignoreNotFound: true });
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function createCourseUploadUrl() {
  const objectName = `${randomUUID()}.pdf`;
  const key = `courses/${objectName}`;
  return { uploadURL: await signedPutUrl(key, "application/pdf"), objectPath: `/objects/courses/${objectName}` };
}

export async function getCourseFile(objectPath: string): Promise<StoredFile> {
  if (!/^\/objects\/courses\/[a-zA-Z0-9-]+\.pdf$/.test(objectPath)) throw new Error("Yanlış kurs faylı yolu.");
  const key = objectPath.replace("/objects/", "");
  const file = makeStoredFile(key);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Fayl tapılmadı.");
  return file;
}

export async function deleteCourseFile(objectPath: string) {
  const file = await getCourseFile(objectPath);
  await file.delete({ ignoreNotFound: true });
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

const assignmentObjectPathPattern = /^\/objects\/assignments\/[a-zA-Z0-9-]+\.(pdf|doc|docx|png|jpg|jpeg|txt)$/;

function assignmentExtension(contentType: string) {
  return ({
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/png": "png",
    "image/jpeg": "jpg",
    "text/plain": "txt",
  } as Record<string, string>)[contentType] ?? null;
}

export async function createAssignmentUploadUrl(contentType: string) {
  const extension = assignmentExtension(contentType);
  if (!extension) throw new Error("Tapşırıq faylının formatı dəstəklənmir.");
  const objectName = `${randomUUID()}.${extension}`;
  const key = `assignments/${objectName}`;
  return {
    uploadURL: await signedPutUrl(key, contentType),
    objectPath: `/objects/assignments/${objectName}`,
  };
}

export async function getAssignmentFile(objectPath: string): Promise<StoredFile> {
  if (!assignmentObjectPathPattern.test(objectPath)) throw new Error("Yanlış tapşırıq faylı yolu.");
  const key = objectPath.replace("/objects/", "");
  const file = makeStoredFile(key);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Fayl tapılmadı.");
  return file;
}

export async function deleteAssignmentFile(objectPath: string) {
  const file = await getAssignmentFile(objectPath);
  await file.delete({ ignoreNotFound: true });
}
