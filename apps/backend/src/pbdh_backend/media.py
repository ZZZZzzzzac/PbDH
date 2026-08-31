MAX_WEBP_BYTES = 2 * 1024 * 1024
RESOURCE_IMAGE_WIDTH = 630


class InvalidWebP(ValueError):
    pass


def webp_dimensions(content: bytes) -> tuple[int, int]:
    if (
        len(content) < 20
        or content[:4] != b"RIFF"
        or content[8:12] != b"WEBP"
        or int.from_bytes(content[4:8], "little") + 8 != len(content)
    ):
        raise InvalidWebP("invalid WebP container")

    offset = 12
    canvas_dimensions: tuple[int, int] | None = None
    image_dimensions: tuple[int, int] | None = None
    while offset + 8 <= len(content):
        chunk_type = content[offset:offset + 4]
        chunk_size = int.from_bytes(content[offset + 4:offset + 8], "little")
        chunk_start = offset + 8
        chunk_end = chunk_start + chunk_size
        if chunk_end > len(content):
            raise InvalidWebP("truncated WebP chunk")
        chunk = content[chunk_start:chunk_end]

        if chunk_type == b"VP8X" and len(chunk) >= 10:
            width = int.from_bytes(chunk[4:7], "little") + 1
            height = int.from_bytes(chunk[7:10], "little") + 1
            canvas_dimensions = (width, height)
        elif chunk_type == b"VP8L" and len(chunk) >= 5 and chunk[0] == 0x2F:
            bits = int.from_bytes(chunk[1:5], "little")
            image_dimensions = ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
        elif chunk_type == b"VP8 " and len(chunk) >= 10 and chunk[3:6] == b"\x9d\x01\x2a":
            width = int.from_bytes(chunk[6:8], "little") & 0x3FFF
            height = int.from_bytes(chunk[8:10], "little") & 0x3FFF
            if width > 0 and height > 0:
                image_dimensions = (width, height)

        offset = chunk_end + (chunk_size & 1)

    if offset != len(content) or image_dimensions is None:
        raise InvalidWebP("missing or invalid WebP image data")
    return canvas_dimensions if canvas_dimensions is not None else image_dimensions


def validate_normalized_webp(content: bytes) -> tuple[int, int]:
    if not content or len(content) > MAX_WEBP_BYTES:
        raise InvalidWebP("WebP byte length is outside the admitted range")
    dimensions = webp_dimensions(content)
    if dimensions[0] != RESOURCE_IMAGE_WIDTH:
        raise InvalidWebP("normalized resource image width must be 630 pixels")
    return dimensions
