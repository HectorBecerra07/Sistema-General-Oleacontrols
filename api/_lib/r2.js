import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
dotenv.config();

let r2Client = null;

function getR2Client() {
  if (r2Client) return r2Client;

  const endpoint = (process.env.R2_ENDPOINT || '').trim();
  const accessKey = (process.env.R2_ACCESS_KEY || '').trim();
  const secretKey = (process.env.R2_SECRET_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET_NAME || '').trim();

  console.log(`[R2-Check] Conectando al Bucket: "${bucket}"`);

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    console.error("❌ ERROR CRÍTICO: Faltan variables de R2 en .env. Revisa Endpoint, AccessKey, SecretKey y BucketName.");
    throw new Error("R2 Credentials missing");
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });
  return r2Client;
}

export async function uploadToR2(base64Data, folder = "general") {
  if (!base64Data) return null;

  try {
    const client = getR2Client();
    const bucketName = (process.env.R2_BUCKET_NAME || '').trim();
    // ... resto del código
    // 1. Extraer metadata del base64
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      // Si no es base64, asumimos que es una URL o ya está procesado
      if (base64Data.startsWith('http')) return base64Data;
      throw new Error("Formato de imagen inválido");
    }

    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    // 2. Generar nombre de archivo único
    const extension = contentType.split('/')[1] || 'png';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

    // 3. Subir a Cloudflare R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await client.send(command);

    // 4. Devolver la URL pública
    const publicUrl = process.env.R2_PUBLIC_URL 
        ? `${process.env.R2_PUBLIC_URL}/${fileName}`
        : `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${fileName}`;
        
    return publicUrl;
  } catch (error) {
    console.error("R2 Upload Error:", error);
    throw error;
  }
}
