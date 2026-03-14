import { useState } from 'react';
import { buildIcsUrl } from '../utils/ics-url.ts';

interface Props {
  selected: string[];
  category?: string;
}

export default function CopyLinkButton({ selected, category = "yoga" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = buildIcsUrl(selected, category);
    const full = `${window.location.origin}${url}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="copy-btn-wrapper">
      <button
        className="copy-btn"
        disabled={selected.length === 0}
        onClick={handleCopy}
      >
        {copied ? 'Copied!' : 'Copy Calendar Link'}
      </button>
    </div>
  );
}
