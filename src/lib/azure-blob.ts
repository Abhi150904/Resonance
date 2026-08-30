import "server-only";

import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

import { env } from "./env";

const credential = new StorageSharedKeyCredential(
  env.AZURE_STORAGE_ACCOUNT_NAME,
  env.AZURE_STORAGE_ACCOUNT_KEY,
);

const blobServiceClient = new BlobServiceClient(
  `https://${env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
  credential,
);

const containerClient = blobServiceClient.getContainerClient(
  env.AZURE_STORAGE_CONTAINER_NAME,
);

type UploadAudioOptions = {
  buffer: Buffer;
  key: string;
  contentType?: string;
};

export async function uploadAudio({
  buffer,
  key,
  contentType = "audio/wav",
}: UploadAudioOptions): Promise<void> {
  const blockBlobClient = containerClient.getBlockBlobClient(key);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  });
}

export async function deleteAudio(key: string): Promise<void> {
  await containerClient.deleteBlob(key, {
    deleteSnapshots: "include",
  });
}

export async function getSignedAudioUrl(key: string): Promise<string> {
  const blobClient = containerClient.getBlobClient(key);
  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + 60 * 60 * 1000);

  const sas = generateBlobSASQueryParameters(
    {
      containerName: env.AZURE_STORAGE_CONTAINER_NAME,
      blobName: key,
      permissions: BlobSASPermissions.parse("r"),
      startsOn,
      expiresOn,
    },
    credential,
  );

  return `${blobClient.url}?${sas.toString()}`;
}
