// A small (i) beside a block's title: hover or focus shows where the block's data comes from and its as-of date.
// The full list of sources lives on the Sources page; blocks carry no visible source sentences.
export default function SourceTip({ text }: { text: string }) {
  return <span className="srctip" tabIndex={0} title={text} aria-label={`Source: ${text}`} role="note">i</span>;
}
