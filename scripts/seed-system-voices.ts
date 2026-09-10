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
    language: "en-GB",
  },
  Anaya: {
    description: "Expressive, composed voice for general assistant responses.",
    category: "GENERAL",
    language: "en-IN",
  },
  Andy: {
    description: "Friendly voice suited for support and product walkthroughs.",
    category: "CUSTOMER_SERVICE",
    language: "en-CA",
  },
  Archer: {
    description: "Crisp, characterful voice for story-driven content.",
    category: "CHARACTERS",
    language: "en-AU",
  },
  Brian: {
    description: "Calm, direct voice for instructional narration.",
    category: "VOICEOVER",
    language: "en-IE",
  },
  Chloe: {
    description: "Bright, natural voice for conversational experiences.",
    category: "CONVERSATIONAL",
    language: "fr-CA",
  },
  Dylan: {
    description: "Grounded voice with a relaxed podcast feel.",
    category: "PODCAST",
    language: "en-NZ",
  },
  Emmanuel: {
    description: "Polished voice suited for corporate and professional content.",
    category: "CORPORATE",
    language: "en-NG",
  },
  Ethan: {
    description: "Energetic voice for promotional and short-form copy.",
    category: "ADVERTISING",
    language: "en-ZA",
  },
  Evelyn: {
    description: "Gentle, balanced voice for stories and longer narration.",
    category: "NARRATIVE",
    language: "en-PH",
  },
  Gavin: {
    description: "Confident, even voice for general narration.",
    category: "GENERAL",
    language: "en-SG",
  },
  Gordon: {
    description: "Distinct voice for characters and dramatic reads.",
    category: "CHARACTERS",
    language: "en-JM",
  },
  Ivan: {
    description: "Measured voice for audiobook and long-form listening.",
    category: "AUDIOBOOK",
    language: "en-KE",
  },
  Laura: {
    description: "Soft, focused voice for mindfulness and calm experiences.",
    category: "MEDITATION",
    language: "es-ES",
  },
  Lucy: {
    description: "Natural voice suited for assistants and casual narration.",
    category: "CONVERSATIONAL",
    language: "en-US",
  },
  Madison: {
    description: "Smooth voice for voiceover and narrated content.",
    category: "VOICEOVER",
    language: "en-GB",
  },
  Marisol: {
    description: "Warm multilingual voice for friendly narration.",
    category: "NARRATIVE",
    language: "es-MX",
  },
  Meera: {
    description: "Clear voice suited for guided, motivational content.",
    category: "MOTIVATIONAL",
    language: "hi-IN",
  },
  Walter: {
    description: "Authoritative voice for corporate and explainer content.",
    category: "CORPORATE",
    language: "en-DE",
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
