import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BlockBlobClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import {
  PrismaClient,
  type VoiceCategory,
} from "../src/generated/prisma/client";
import { CANONICAL_SYSTEM_VOICE_NAMES } from "../src/features/voices/data/voice-scoping";

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    AZURE_STORAGE_ACCOUNT_NAME: z.string().min(1),
    AZURE_STORAGE_ACCOUNT_KEY: z.string().min(1),
    AZURE_STORAGE_CONTAINER_NAME: z.string().min(1),
  })
  .parse(process.env);

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const credential = new StorageSharedKeyCredential(
  env.AZURE_STORAGE_ACCOUNT_NAME,
  env.AZURE_STORAGE_ACCOUNT_KEY,
);

const voicesDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "system-voices",
);

type SystemVoiceName = (typeof CANONICAL_SYSTEM_VOICE_NAMES)[number];

type VoiceMetadata = {
  description: string;
  category: VoiceCategory;
  language: string;
};

const SYSTEM_VOICE_METADATA = {
  Aaron: {
    description: "Warm, steady voice suited for narration and guided listening.",
    category: "AUDIOBOOK",
    language: "en-US",
  },
  Abigail: {
    description: "Clear, approachable voice with a conversational tone.",
    category: "CONVERSATIONAL",
    language: "en-US",
  },
  Anaya: {
    description: "Expressive, composed voice for general assistant responses.",
    category: "GENERAL",
    language: "en-US",
  },
  Andy: {
    description: "Friendly voice suited for support and product walkthroughs.",
    category: "CUSTOMER_SERVICE",
    language: "en-US",
  },
  Archer: {
    description: "Crisp, characterful voice for story-driven content.",
    category: "CHARACTERS",
    language: "en-US",
  },
  Brian: {
    description: "Calm, direct voice for instructional narration.",
    category: "VOICEOVER",
    language: "en-US",
  },
  Chloe: {
    description: "Bright, natural voice for conversational experiences.",
    category: "CONVERSATIONAL",
    language: "en-US",
  },
  Dylan: {
    description: "Grounded voice with a relaxed podcast feel.",
    category: "PODCAST",
    language: "en-US",
  },
  Emmanuel: {
    description: "Polished voice suited for corporate and professional content.",
    category: "CORPORATE",
    language: "en-US",
  },
  Ethan: {
    description: "Energetic voice for promotional and short-form copy.",
    category: "ADVERTISING",
    language: "en-US",
  },
  Evelyn: {
    description: "Gentle, balanced voice for stories and longer narration.",
    category: "NARRATIVE",
    language: "en-US",
  },
  Gavin: {
    description: "Confident, even voice for general narration.",
    category: "GENERAL",
    language: "en-US",
  },
  Gordon: {
    description: "Distinct voice for characters and dramatic reads.",
    category: "CHARACTERS",
    language: "en-US",
  },
  Ivan: {
    description: "Measured voice for audiobook and long-form listening.",
    category: "AUDIOBOOK",
    language: "en-US",
  },
  Laura: {
    description: "Soft, focused voice for mindfulness and calm experiences.",
    category: "MEDITATION",
    language: "en-US",
  },
  Lucy: {
    description: "Natural voice suited for assistants and casual narration.",
    category: "CONVERSATIONAL",
    language: "en-US",
  },
  Madison: {
    description: "Smooth voice for voiceover and narrated content.",
    category: "VOICEOVER",
    language: "en-US",
  },
  Marisol: {
    description: "Warm multilingual voice for friendly narration.",
    category: "NARRATIVE",
    language: "en-US",
  },
  Meera: {
    description: "Clear voice suited for guided, motivational content.",
    category: "MOTIVATIONAL",
    language: "en-US",
  },
  Walter: {
    description: "Authoritative voice for corporate and explainer content.",
    category: "CORPORATE",
    language: "en-US",
  },
} satisfies Record<SystemVoiceName, VoiceMetadata>;

async function readSystemVoiceAudio(name: SystemVoiceName): Promise<Buffer> {
  return readFile(path.join(voicesDirectory, `${name}.wav`));
}

async function uploadSystemVoiceAudio({
  buffer,
  key,
  contentType = "audio/wav",
}: {
  buffer: Buffer;
  key: string;
  contentType?: string;
}): Promise<void> {
  const blobClient = new BlockBlobClient(
    `https://${env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${env.AZURE_STORAGE_CONTAINER_NAME}/${key}`,
    credential,
  );

  await blobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  });
}

async function seedSystemVoice(name: SystemVoiceName): Promise<void> {
  const buffer = await readSystemVoiceAudio(name);
  const metadata = SYSTEM_VOICE_METADATA[name];

  const existingVoice = await prisma.voice.findFirst({
    where: {
      name,
      variant: "SYSTEM",
    },
  });

  if (existingVoice) {
    const storageObjectKey = `voices/system/${existingVoice.id}.wav`;

    await uploadSystemVoiceAudio({
      buffer,
      key: storageObjectKey,
    });

    await prisma.voice.update({
      where: {
        id: existingVoice.id,
      },
      data: {
        ...metadata,
        storageObjectKey,
      },
    });

    return;
  }

  const voice = await prisma.voice.create({
    data: {
      name,
      variant: "SYSTEM",
      orgId: null,
      ...metadata,
    },
  });

  const storageObjectKey = `voices/system/${voice.id}.wav`;

  try {
    await uploadSystemVoiceAudio({
      buffer,
      key: storageObjectKey,
    });

    await prisma.voice.update({
      where: {
        id: voice.id,
      },
      data: {
        storageObjectKey,
      },
    });
  } catch (error) {
    await prisma.voice.delete({
      where: {
        id: voice.id,
      },
    });

    throw error;
  }
}

async function main(): Promise<void> {
  console.log(`Seeding ${CANONICAL_SYSTEM_VOICE_NAMES.length} system voices...`);

  for (const name of CANONICAL_SYSTEM_VOICE_NAMES) {
    console.log(`- ${name}`);
    await seedSystemVoice(name);
  }

  console.log("System voice seed completed.");
}

main()
  .catch((error) => {
    console.error("Failed to seed system voices:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
