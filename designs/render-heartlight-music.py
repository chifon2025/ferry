"""Render an original, deterministic music sketch. No samples or network assets.

An original five-phrase melody, softly struck modal strings, quiet broken chords,
and a short damped room. This is a composition/timbre preview, not a loop master.
"""
from pathlib import Path
import json
import wave

import numpy as np

RATE = 44100
SECONDS = 60
RNG = np.random.default_rng(20260907)
mix = np.zeros((RATE * SECONDS, 2), dtype=np.float64)


def filter_spectrum(data, lowpass, highpass=0):
    spectrum = np.fft.rfft(data, axis=0)
    hz = np.fft.rfftfreq(len(data), 1 / RATE)
    gain = 1 / np.sqrt(1 + (hz / lowpass) ** 4)
    if highpass:
        gain *= hz / np.sqrt(hz ** 2 + highpass ** 2)
    if data.ndim == 2:
        gain = gain[:, None]
    return np.fft.irfft(spectrum * gain, n=len(data), axis=0)


def convolution(data, impulse):
    size = 1 << (len(data) + len(impulse) - 2).bit_length()
    return np.fft.irfft(np.fft.rfft(data, n=size) *
                        np.fft.rfft(impulse, n=size), n=size)[:len(data)]


def note(at, midi, level=0.1, pan=0.0, duration=8.0, soft=1.0):
    """Damped string modes with a soft attack and subtle sympathetic string."""
    t = np.arange(round(duration * RATE)) / RATE
    frequency = 440 * 2 ** ((midi - 69) / 12)
    voice = np.zeros(len(t))
    for harmonic in range(1, 13):
        f = frequency * harmonic * np.sqrt(1 + 0.000055 * harmonic * harmonic)
        decay = (2.5 + 90 / frequency) / (1 + 0.31 * (harmonic - 1))
        amplitude = np.exp(-0.32 * (harmonic - 1) * soft) / harmonic ** 1.12
        attack = 1 - np.exp(-t / (0.014 + 0.003 * soft))
        env = attack * np.exp(-t / decay)
        phase = 2 * np.pi * f * t
        # The secondary string is much quieter: warmth without audible beating.
        voice += amplitude * env * (np.sin(phase) + 0.10 * np.sin(phase * 1.0006))
    voice *= np.minimum(1, (duration - t) / 0.35)
    voice *= level
    first = round(at * RATE)
    length = min(len(voice), len(mix) - first)
    angle = (pan + 1) * np.pi / 4
    mix[first:first + length, 0] += voice[:length] * np.cos(angle)
    mix[first:first + length, 1] += voice[:length] * np.sin(angle)


# Each phrase has a small rise and a return; silence is part of the composition.
# F major pentatonic. MIDI notes are explicit to keep the tune reproducible.
phrases = [
    (1.0, [(0, 65), (1.55, 69), (3.4, 72), (5.7, 69), (7.2, 67), (9.4, 65)]),
    (13.0, [(0, 62), (2.0, 65), (3.6, 69), (6.2, 67), (9.0, 60)]),
    (25.0, [(0, 65), (1.7, 67), (3.5, 69), (6.0, 72), (8.1, 74), (9.9, 72)]),
    (37.0, [(0, 69), (2.0, 67), (4.5, 65), (7.2, 62), (9.5, 60)]),
    (49.0, [(0, 65), (2.4, 69), (4.4, 65)]),
]
for phrase_index, (start, melody) in enumerate(phrases):
    for i, (offset, pitch) in enumerate(melody):
        level = (0.095 if i == 0 else 0.079) * RNG.uniform(0.91, 1.04)
        note(start + offset, pitch, level, pan=0.12 * np.sin(i + phrase_index))

for start, chord in [(0.5, (41, 53, 60)), (12.5, (38, 50, 57)),
                     (24.5, (46, 53, 62)), (36.5, (48, 55, 62)),
                     (48.5, (41, 53, 60))]:
    for i, pitch in enumerate(chord):
        note(start + i * 0.22, pitch, 0.054 if i == 0 else 0.032,
             pan=-0.14 + i * 0.12, duration=10, soft=1.6)

# A finite impulse response only follows played notes; no continuous ambience.
room_length = round(2.8 * RATE)
rt = np.arange(room_length) / RATE
for channel in range(2):
    impulse = RNG.standard_normal(room_length)
    impulse = filter_spectrum(impulse, 2300)
    impulse *= np.exp(-rt * 3.0) * (1 - np.exp(-rt * 30))
    impulse[:round(0.035 * RATE)] = 0
    impulse /= np.sqrt(np.sum(impulse * impulse))
    for delay, amplitude in [(0.061, 0.15), (0.099, 0.10), (0.151, 0.06)]:
        impulse[round((delay + channel * 0.006) * RATE)] += amplitude
    wet = convolution(mix[:, channel], impulse)
    mix[:, channel] += wet * 0.13

mix = filter_spectrum(mix, 4500, 45)
mix -= np.mean(mix, axis=0)
mix[:RATE] *= np.linspace(0, 1, RATE)[:, None]
mix[-RATE * 5:] *= np.linspace(1, 0, RATE * 5)[:, None] ** 1.5
peak = np.max(np.abs(mix))
rms = np.sqrt(np.mean(mix ** 2))
gain = min(10 ** (-23 / 20) / rms, 10 ** (-6 / 20) / peak)
mix *= gain
assert np.isfinite(mix).all()
assert np.max(np.abs(mix)) < 0.51

output = Path(__file__).parent / 'heartlight-warm-strings-v2.wav'
with wave.open(str(output), 'wb') as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes((mix * 32767).astype('<i2').tobytes())
print(json.dumps({
    'file': str(output), 'seconds': SECONDS, 'sample_rate': RATE,
    'peak_dbfs': round(float(20 * np.log10(np.max(np.abs(mix)))), 2),
    'rms_dbfs': round(float(20 * np.log10(np.sqrt(np.mean(mix ** 2)))), 2),
    'clipped_samples': int(np.count_nonzero(np.abs(mix) >= 1)),
    'max_adjacent_sample_step': round(float(np.max(np.abs(np.diff(mix, axis=0)))), 5),
}, ensure_ascii=False))
