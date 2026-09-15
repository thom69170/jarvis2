"""Serveur local minimal pour Bark (https://github.com/suno-ai/bark),
expose une API compatible OpenAI (POST /v1/audio/speech) pour que
J.A.R.V.I.S puisse l'utiliser exactement comme Kokoro ou Piper.

ATTENTION PERFORMANCES : Bark tourne sur le GPU (CUDA) si disponible.
S'il est utilisé en meme temps qu'un jeu sur la meme carte graphique,
attends-toi a des saccades ou des chutes de FPS pendant la generation
de chaque phrase. Sur CPU seul, la generation est encore plus lente
(plusieurs secondes a plusieurs dizaines de secondes par phrase).

Installation :
    pip install fastapi uvicorn scipy "git+https://github.com/suno-ai/bark.git"

Lancement :
    python server.py

Le serveur ecoute par defaut sur http://localhost:8882 (voir BARK_SERVER_PORT
ci-dessous), a renseigner comme "Adresse du serveur" dans le panneau
d'administration de J.A.R.V.I.S (avec le suffixe /v1).
"""

import io
import os

import numpy as np
import scipy.io.wavfile
import torch

# PyTorch 2.6+ changed torch.load()'s default weights_only to True for
# security (blocks unpickling arbitrary objects). Bark's own code (last
# updated well before that change) calls torch.load() without setting it,
# so loading its official checkpoints now raises UnpicklingError. Safe here
# since these checkpoints only ever come from Suno's official HuggingFace
# repo (suno/bark), not from user-supplied data.
_original_torch_load = torch.load


def _torch_load_weights_only_false(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _original_torch_load(*args, **kwargs)


torch.load = _torch_load_weights_only_false

from bark import SAMPLE_RATE, generate_audio, preload_models
from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel

PORT = int(os.environ.get("BARK_SERVER_PORT", "8882"))

app = FastAPI()

print("Chargement des modeles Bark (peut prendre plusieurs minutes la premiere fois, ~5 Go a telecharger)...")
preload_models()
print("Bark est pret.")


class SpeechRequest(BaseModel):
    model: str = "bark"
    voice: str = "v2/fr_speaker_1"
    input: str


@app.post("/v1/audio/speech")
def synthesize(req: SpeechRequest) -> Response:
    audio_array = generate_audio(req.input, history_prompt=req.voice)
    buffer = io.BytesIO()
    scipy.io.wavfile.write(buffer, SAMPLE_RATE, audio_array.astype(np.float32))
    return Response(content=buffer.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
