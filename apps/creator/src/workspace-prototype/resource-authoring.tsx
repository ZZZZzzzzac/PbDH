export function CardBackEditor({
  label,
  value,
  hasImage,
  options,
  onChange,
}: {
  label: string;
  value: string;
  hasImage?: boolean;
  options: Array<{ id: string; name: string }>;
  onChange: (targetResourceId: string | null) => void;
}) {
  return <section className="replacement-editor field-group">
    <h2>卡背</h2>
    <label className="compact-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{hasImage ? "使用现有卡背图片" : "不设置"}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
    {hasImage && <button type="button" onClick={() => onChange(null)}>清除卡背图片</button>}
    <p>将这张卡作为背面。翻面保留状态和指示物，再翻一次返回原正面；不会继续使用背面卡自己的卡背。</p>
  </section>;
}

export function ResourceAttributionEditor({
  artworkCredit,
  sourceLabel,
  onChange,
}: {
  artworkCredit: string;
  sourceLabel: string;
  onChange: (field: "artworkCredit" | "sourceLabel", value: string) => void;
}) {
  return <section className="resource-attribution-editor" aria-labelledby="resource-attribution-heading">
    <h2 id="resource-attribution-heading">卡面署名</h2>
    <div>
      <label><span>图片作者或来源</span><input value={artworkCredit} onChange={(event) => onChange("artworkCredit", event.target.value)} /></label>
      <label><span>卡牌来源或所属</span><input value={sourceLabel} onChange={(event) => onChange("sourceLabel", event.target.value)} /></label>
    </div>
  </section>;
}
