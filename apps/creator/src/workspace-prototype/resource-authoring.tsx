export function ReplacementEditor({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (targetResourceId: string | null) => void;
}) {
  return <section className="replacement-editor field-group">
    <h2>换卡</h2>
    <label className="compact-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">不设置</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
    <p>点击桌面上的“{label}”时，现场读取这张目标卡。</p>
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
