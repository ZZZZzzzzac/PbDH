/** 将已呈现的规范卡面保存为 PNG，保留当前排版、状态和自适应高度。 */
export async function renderCanonicalCardToPng(host: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const shadow = host.shadowRoot;
  const surface = shadow?.querySelector<HTMLElement>(".pbdh-surface-root");
  if (!surface || shadow?.querySelector(".pbdh-surface-status")) {
    throw new Error("卡面尚未加载完成，请稍后重试。");
  }
  await Promise.all(Array.from(surface.querySelectorAll("img"), (image) => image.decode()));
  const surfaceStyle = getComputedStyle(surface);
  const width = parseFloat(surfaceStyle.width);
  const height = parseFloat(surfaceStyle.height);
  if (!width || !height) throw new Error("卡面尺寸不可用，请稍后重试。");

  // 克隆已经完成文字自适应的 DOM，避免重新渲染丢失预览状态。
  const clone = surface.cloneNode(true) as HTMLElement;
  const originals = [surface, ...surface.querySelectorAll<HTMLElement | SVGElement>("*")];
  const copies = [clone, ...clone.querySelectorAll<HTMLElement | SVGElement>("*")];
  originals.forEach((element, index) => {
    const style = getComputedStyle(element);
    const copy = copies[index]!;
    for (const property of Array.from(style)) copy.style.setProperty(property, style.getPropertyValue(property));
  });
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  const images = Array.from(clone.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    const response = await fetch(image.src);
    if (!response.ok) throw new Error("卡图读取失败，请稍后重试。");
    image.src = await blobDataUrl(await response.blob());
    image.removeAttribute("srcset");
    image.removeAttribute("loading");
  }));
  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.cssText = `width:${width}px;height:${height}px;overflow:hidden`;
  // 保留伪元素规则；普通元素使用实际计算样式，隔离页面缩放和容器单位。
  shadow!.querySelectorAll("style").forEach((style) => wrapper.appendChild(style.cloneNode(true)));
  wrapper.appendChild(clone);
  const markup = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  const scale = 1080 / width;
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法生成卡图。");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("卡图生成失败，请重试。");
  return blob;
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("卡图读取失败，请稍后重试。"));
    reader.readAsDataURL(blob);
  });
}
