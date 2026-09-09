import gc
import hashlib
import json
import statistics
import struct
import sys
import time
import tracemalloc
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps/backend/src'))
from pbdh_backend.contracts.resource_package import (
    DIGEST_DOMAIN, _canonicalize, _normalized_document,
    compute_resource_package_snapshot_digest,
)

def legacy(document, media):
    frames = []
    def frame(kind, payload):
        kind = kind.encode()
        frames.append(struct.pack('>I', len(kind)) + kind + struct.pack('>Q', len(payload)) + payload)
    frame('domain', DIGEST_DOMAIN.encode())
    frame('logical-document', _canonicalize(_normalized_document(document)).encode())
    for asset in sorted(document['assets'], key=lambda item: item['id']):
        frame('asset-id', asset['id'].encode())
        frame('asset-bytes', media[asset['id']])
    return 'sha256:' + hashlib.sha256(b''.join(frames)).hexdigest()

results = []
for count in [1, 8, 32]:
    media = {f'asset-{i:03}': bytes([i]) * (1024 * 1024) for i in range(count)}
    document = {'targets': [], 'assets': [{'id': key} for key in media], 'resources': [], 'emptyDirectories': []}
    assert legacy(document, media) == compute_resource_package_snapshot_digest(document, media)
    row = {'assets': count, 'mediaBytes': count * 1024 * 1024}
    for name, fn in [('legacyFramesAndJoin', legacy), ('streaming', compute_resource_package_snapshot_digest)]:
        samples = []
        peaks = []
        for _ in range(5):
            gc.collect()
            tracemalloc.start()
            started = time.perf_counter()
            fn(document, media)
            samples.append((time.perf_counter() - started) * 1000)
            peaks.append(tracemalloc.get_traced_memory()[1])
            tracemalloc.stop()
        row[name] = {'medianMs': round(statistics.median(samples), 3), 'peakAdditionalBytes': max(peaks)}
    results.append(row)
print(json.dumps({'python': sys.version, 'samples': 5, 'results': results}))
