from io import BytesIO
import warnings

from PIL import Image


MAX_WEBP_BYTES = 2 * 1024 * 1024
RESOURCE_IMAGE_WIDTH = 630


class InvalidWebP(ValueError):
    pass


def webp_dimensions(content: bytes) -> tuple[int, int]:
    if not content or len(content) > MAX_WEBP_BYTES:
        raise InvalidWebP("WebP byte length is outside the admitted range")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content), formats=["WEBP"]) as image:
                if image.width != RESOURCE_IMAGE_WIDTH or image.n_frames != 1:
                    raise InvalidWebP("expected a static 630-pixel-wide WebP")
                image.load()
                return image.size
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise InvalidWebP("invalid or non-normalized WebP image") from error


def validate_normalized_webp(content: bytes) -> tuple[int, int]:
    return webp_dimensions(content)
