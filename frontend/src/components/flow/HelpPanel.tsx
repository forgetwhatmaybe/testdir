import { useEffect, useState } from 'react';
import { getHelpText } from '../../api/settings';

export default function HelpPanel() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => { getHelpText().then(setLines).catch(() => {}); }, []);
  return (
    <div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>使用说明</div>
      {lines.map((ln, i) => (
        <div key={i} className="help-line">{i + 1}. {ln}</div>
      ))}
    </div>
  );
}
