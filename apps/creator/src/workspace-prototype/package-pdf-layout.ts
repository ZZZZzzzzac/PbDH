// 物理尺寸只属于 PDF 输出；不改变规范卡面的设计坐标或内部排版。
export const packagePdfPage = { width: 210, height: 297, margin: 5, gap: 2, cardWidth: 63 } as const;

export type PdfCardSize = { width: number; height: number };
export type PdfCardPlacement = PdfCardSize & { index: number; page: number; x: number; y: number };

/** 按输入顺序从左到右逐行排版；不重排、不回填，超长卡整张等比缩小。 */
export function layoutPackagePdf(sizes: readonly PdfCardSize[]): PdfCardPlacement[] {
  const { width, height, margin, gap, cardWidth } = packagePdfPage;
  const availableHeight = height - 2 * margin;
  const columns = Math.floor((width - 2 * margin + gap) / (cardWidth + gap));
  const left = (width - columns * cardWidth - (columns - 1) * gap) / 2;
  const cards = sizes.map((size, index) => {
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
      throw new Error("卡牌尺寸无效，无法导出 PDF。");
    }
    const scale = Math.min(cardWidth / size.width, availableHeight / size.height);
    return { index, width: size.width * scale, height: size.height * scale };
  });
  let page = 0;
  let column = 0;
  let y = margin;
  let rowHeight = 0;
  return cards.map((card) => {
    if (column === columns) {
      y += rowHeight + gap;
      column = 0;
      rowHeight = 0;
    }
    if (y + card.height > height - margin + 1e-8) {
      page += 1;
      y = margin;
      column = 0;
      rowHeight = 0;
    }
    const placement = { ...card, page, x: left + column * (cardWidth + gap) + (cardWidth - card.width) / 2, y };
    column += 1;
    rowHeight = Math.max(rowHeight, card.height);
    return placement;
  });
}
