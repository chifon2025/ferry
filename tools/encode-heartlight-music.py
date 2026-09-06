"""Encode the approved original WAV preview for the offline mobile app.

Requires lameenc (build-time only); accepts the preview and output paths.
"""
import sys
import wave
from pathlib import Path
import lameenc

source, target = map(Path, sys.argv[1:3])
with wave.open(str(source), 'rb') as wav:
    assert wav.getsampwidth() == 2
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(128)
    encoder.set_in_sample_rate(wav.getframerate())
    encoder.set_channels(wav.getnchannels())
    encoder.set_quality(2)
    data = encoder.encode(wav.readframes(wav.getnframes())) + encoder.flush()
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(data)
print(f'Encoded {len(data)} bytes')
