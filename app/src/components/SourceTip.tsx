// A small (i) beside a block's title: hover or focus shows where the block's data comes from and its as-of date.
// The full list of sources lives on the Sources page; blocks carry no visible source sentences.
export default function SourceTip({ text, label = "Source" }: { text: string; label?: string }) {
  return <span className="srctip" tabIndex={0} title={text} aria-label={`${label}: ${text}`} role="note">i</span>;
}
