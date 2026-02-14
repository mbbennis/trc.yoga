import { useState } from 'react';
import { buildIcsUrl } from '../utils/ics-url.ts';

interface Props {
  selected: string[];
}

export default function CopyLinkButton({ selected }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = buildIcsUrl(selected);
    const full = `${window.location.origin}${url}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      className="copy-btn"
      disabled={selected.length === 0}
      onClick={handleCopy}
    >
      {copied ? 'Copied!' : 'Copy Calendar Link'}
    </button>
  );
}
