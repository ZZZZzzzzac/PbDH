// 物理尺寸只属于 PDF 输出；不改变规范卡面的设计坐标或内部排版。
export const packagePdfPage = { width: 210, height: 297, margin: 5, gap: 2, cardWidth: 63 } as const;

export type PdfCardSize = { width: number; height: number };
export type PdfCardPlacement = PdfCardSize & { index: number; page: number; x: number; y: number };

/** 按高度降序填入三列，回填前页空位；超长卡整张等比缩小，绝不跨页切割。 */
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
  }).sort((a, b) => b.height - a.height || a.index - b.index);
  const used: number[][] = [];
  return cards.map((card) => {
    let page = 0;
    let column = -1;
    for (; page < used.length; page += 1) {
      column = used[page]!.findIndex((filled) => filled + card.height <= availableHeight + 1e-8);
      if (column !== -1) break;
    }
    if (column === -1) {
      used.push(Array<number>(columns).fill(0));
      column = 0;
    }
    const y = margin + used[page]![column]!;
    used[page]![column]! += card.height + gap;
    return { ...card, page, x: left + column * (cardWidth + gap) + (cardWidth - card.width) / 2, y };
  });
}
