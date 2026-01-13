export interface WordPair {
  arabic: string;
  english: string;
  color: string;
  colorName: string;
}

const COLORS = [
  { name: 'red', hex: '#dc2626', class: 'pair-red' },
  { name: 'blue', hex: '#2563eb', class: 'pair-blue' },
  { name: 'green', hex: '#16a34a', class: 'pair-green' },
  { name: 'orange', hex: '#ea580c', class: 'pair-orange' },
  { name: 'purple', hex: '#9333ea', class: 'pair-purple' },
];

export function splitIntoTokens(text: string): string[] {
  // Split by whitespace but keep punctuation attached to words
  const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);
  return tokens;
}

export function alignTexts(arabicText: string, englishText: string): WordPair[] {
  const arabicTokens = splitIntoTokens(arabicText);
  const englishTokens = splitIntoTokens(englishText);
  
  const pairs: WordPair[] = [];
  const maxLen = Math.max(arabicTokens.length, englishTokens.length);
  
  if (maxLen === 0) return pairs;
  
  // If counts differ significantly, try to distribute evenly
  const arabicRatio = arabicTokens.length / maxLen;
  const englishRatio = englishTokens.length / maxLen;
  
  let arabicIdx = 0;
  let englishIdx = 0;
  
  for (let i = 0; i < maxLen; i++) {
    const color = COLORS[i % COLORS.length];
    
    // Calculate how many tokens to group
    const targetArabic = Math.round((i + 1) * arabicRatio);
    const targetEnglish = Math.round((i + 1) * englishRatio);
    
    const arabicCount = Math.max(1, targetArabic - arabicIdx);
    const englishCount = Math.max(1, targetEnglish - englishIdx);
    
    // Get tokens for this pair
    const arabicSlice = arabicTokens.slice(arabicIdx, arabicIdx + arabicCount);
    const englishSlice = englishTokens.slice(englishIdx, englishIdx + englishCount);
    
    if (arabicSlice.length > 0 || englishSlice.length > 0) {
      pairs.push({
        arabic: arabicSlice.join(' ') || '',
        english: englishSlice.join(' ') || '',
        color: color.hex,
        colorName: color.name,
      });
    }
    
    arabicIdx += arabicCount;
    englishIdx += englishCount;
    
    // Break if we've exhausted both arrays
    if (arabicIdx >= arabicTokens.length && englishIdx >= englishTokens.length) {
      break;
    }
  }
  
  // Handle any remaining tokens
  if (arabicIdx < arabicTokens.length || englishIdx < englishTokens.length) {
    const remainingArabic = arabicTokens.slice(arabicIdx).join(' ');
    const remainingEnglish = englishTokens.slice(englishIdx).join(' ');
    const color = COLORS[pairs.length % COLORS.length];
    
    pairs.push({
      arabic: remainingArabic,
      english: remainingEnglish,
      color: color.hex,
      colorName: color.name,
    });
  }
  
  return pairs;
}

export function generateCSV(pairs: WordPair[]): string {
  const header = 'Arabic,English,Color';
  const rows = pairs.map(pair => {
    // Escape quotes in CSV
    const arabic = `"${pair.arabic.replace(/"/g, '""')}"`;
    const english = `"${pair.english.replace(/"/g, '""')}"`;
    return `${arabic},${english},${pair.colorName}`;
  });
  return [header, ...rows].join('\n');
}

export function generateHTML(pairs: WordPair[]): string {
  const content = pairs
    .map(pair => {
      return `<span style="color:${pair.color}">${pair.arabic}</span> → <span style="color:${pair.color}">${pair.english}</span>`;
    })
    .join('<br>\n');
  
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arabic-English Word Pairs</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 2;
      font-size: 1.25rem;
      background: #fafaf9;
    }
    span {
      font-weight: 500;
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
