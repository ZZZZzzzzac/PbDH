import { lazy, Suspense, type Ref } from "react";

const RestrictedMarkdownRenderer = lazy(() => import("./RestrictedMarkdownRenderer").then((module) => ({
  default: module.RestrictedMarkdownRenderer,
})));

interface RestrictedMarkdownProps {
  value: string;
  className?: string;
  elementRef?: Ref<HTMLDivElement>;
}

export function RestrictedMarkdown({ value, className, elementRef }: RestrictedMarkdownProps) {
  return (
    <div className={className} data-restricted-markdown="true" ref={elementRef}>
      <Suspense fallback={<span style={{ whiteSpace: "pre-wrap" }}>{value}</span>}>
        <RestrictedMarkdownRenderer value={value} />
      </Suspense>
    </div>
  );
}
