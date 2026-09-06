"""Chatterbox TTS API - Text-to-speech with voice cloning on Modal."""

import modal

# Use this to add Azure Storage tokens:
# modal secret create azure-storage \
#   AZURE_STORAGE_ACCOUNT_NAME=<storage-account-name> \
#   AZURE_STORAGE_ACCOUNT_KEY=<storage-account-key> \
#   AZURE_STORAGE_CONTAINER_NAME=<container-name>

# Use this to test locally:
# modal run chatterbox_tts.py `
#   --prompt "Hello from Chatterbox [chuckle]." `
#   --voice-key "voices/system/<>"

# # Use this to test CURL:
# $body = @{
#   prompt = "Hello from Chatterbox [chuckle]."
#   voice_key = "voices/system/<your-voice-id>"
# } | ConvertTo-Json

# Invoke-WebRequest `
#   -Uri "<your-url>/generate" `
#   -Method POST `
#   -Headers @{ "X-Api-Key" = "<your-api-key>" } `
#   -ContentType "application/json" `
#   -Body $body `
#   -OutFile "output.wav"

# Modal setup
image = modal.Image.debian_slim(python_version="3.10").uv_pip_install(
    "azure-storage-blob==12.26.0",
    "chatterbox-tts==0.1.6",
    "fastapi[standard]==0.124.4",
    "peft==0.18.0",
)
app = modal.App("chatterbox-tts", image=image)

with image.imports():
    import io
    import os
    import tempfile
    from pathlib import Path

    from azure.storage.blob import BlobServiceClient
    import torchaudio as ta
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    from fastapi import (
        Depends,
        FastAPI,
        HTTPException,
        Security,
    )
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse
    from fastapi.security import APIKeyHeader
    from pydantic import BaseModel, Field

    api_key_scheme = APIKeyHeader(
        name="x-api-key",
        scheme_name="ApiKeyAuth",
        auto_error=False,
    )

    def verify_api_key(x_api_key: str | None = Security(api_key_scheme)):
        expected = os.environ.get("CHATTERBOX_API_KEY", "")
        if not expected or x_api_key != expected:
            raise HTTPException(status_code=403, detail="Invalid API key")
        return x_api_key

    class TTSRequest(BaseModel):
        """Request model for text-to-speech generation."""

        prompt: str = Field(..., min_length=1, max_length=5000)
        voice_key: str = Field(..., min_length=1, max_length=300)
        temperature: float = Field(default=0.8, ge=0.0, le=2.0)
        top_p: float = Field(default=0.95, ge=0.0, le=1.0)
        top_k: int = Field(default=1000, ge=1, le=10000)
        repetition_penalty: float = Field(default=1.2, ge=1.0, le=2.0)
        norm_loudness: bool = Field(default=True)


@app.cls(
    gpu="a10g",
    scaledown_window=60 * 5,
    secrets=[
        modal.Secret.from_name("hf-token"),
        modal.Secret.from_name("chatterbox-api-key"),
        modal.Secret.from_name("azure-storage"),
    ],
)
@modal.concurrent(max_inputs=10)
class Chatterbox:
    @modal.enter()
    def load_model(self):
        self.model = ChatterboxTurboTTS.from_pretrained(device="cuda")
        self.blob_service_client = BlobServiceClient(
            account_url=(
                "https://"
                f"{os.environ['AZURE_STORAGE_ACCOUNT_NAME']}"
                ".blob.core.windows.net"
            ),
            credential=os.environ["AZURE_STORAGE_ACCOUNT_KEY"],
        )
        self.container_name = os.environ["AZURE_STORAGE_CONTAINER_NAME"]

    def download_voice_prompt(self, voice_key: str) -> str:
        if ".." in Path(voice_key).parts:
            raise HTTPException(status_code=400, detail="Invalid voice key")

        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name,
            blob=voice_key,
        )

        try:
            voice_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            with voice_file:
                voice_file.write(blob_client.download_blob().readall())
            return voice_file.name
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Voice not found at '{voice_key}': {e}",
            )

    @modal.asgi_app()
    def serve(self):
        web_app = FastAPI(
            title="Chatterbox TTS API",
            description="Text-to-speech with voice cloning",
            docs_url="/docs",
            dependencies=[Depends(verify_api_key)],
        )
        web_app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @web_app.post("/generate", responses={200: {"content": {"audio/wav": {}}}})
        def generate_speech(request: TTSRequest):
            try:
                audio_bytes = self.generate.local(
                    request.prompt,
                    request.voice_key,
                    request.temperature,
                    request.top_p,
                    request.top_k,
                    request.repetition_penalty,
                    request.norm_loudness,
                )
                return StreamingResponse(
                    io.BytesIO(audio_bytes),
                    media_type="audio/wav",
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate audio: {e}",
                )

        return web_app

    @modal.method()
    def generate(
        self,
        prompt: str,
        voice_key: str,
        temperature: float = 0.8,
        top_p: float = 0.95,
        top_k: int = 1000,
        repetition_penalty: float = 1.2,
        norm_loudness: bool = True,
    ):
        audio_prompt_path = self.download_voice_prompt(voice_key)

        try:
            wav = self.model.generate(
                prompt,
                audio_prompt_path=audio_prompt_path,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                repetition_penalty=repetition_penalty,
                norm_loudness=norm_loudness,
            )
        finally:
            Path(audio_prompt_path).unlink(missing_ok=True)

        buffer = io.BytesIO()
        ta.save(buffer, wav, self.model.sr, format="wav")
        buffer.seek(0)
        return buffer.read()


@app.local_entrypoint()
def test(
    prompt: str = "Chatterbox running on Modal [chuckle].",
    voice_key: str = "voices/system/default.wav",
    output_path: str = "/tmp/chatterbox-tts/output.wav",
    temperature: float = 0.8,
    top_p: float = 0.95,
    top_k: int = 1000,
    repetition_penalty: float = 1.2,
    norm_loudness: bool = True,
):
    import pathlib

    chatterbox = Chatterbox()
    audio_bytes = chatterbox.generate.remote(
        prompt=prompt,
        voice_key=voice_key,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        repetition_penalty=repetition_penalty,
        norm_loudness=norm_loudness,
    )

    output_file = pathlib.Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_bytes(audio_bytes)
    print(f"Audio saved to {output_file}")
