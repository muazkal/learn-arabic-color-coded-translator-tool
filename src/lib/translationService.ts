const MAX_CHUNK_SIZE = 400; // MyMemory limit is 500 chars, leave buffer

function splitIntoChunks(text: string): string[] {
  const sentences = text.split(/([.،؛!؟\n])/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    if ((currentChunk + sentence).length <= MAX_CHUNK_SIZE) {
      currentChunk += sentence;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // If no chunks or single chunk is still too long, split by words
  if (chunks.length === 0 || chunks.some(c => c.length > MAX_CHUNK_SIZE)) {
    const words = text.split(/\s+/);
    chunks.length = 0;
    currentChunk = '';
    
    for (const word of words) {
      if ((currentChunk + ' ' + word).length <= MAX_CHUNK_SIZE) {
        currentChunk = currentChunk ? currentChunk + ' ' + word : word;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = word;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
  }
  
  return chunks.length > 0 ? chunks : [text.slice(0, MAX_CHUNK_SIZE)];
}

async function translateChunk(chunk: string): Promise<string> {
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=ar|en`
  );

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    // Check for quota exceeded message
    if (data.responseData.translatedText.includes('MYMEMORY WARNING')) {
      throw new Error('Translation quota exceeded');
    }
    return data.responseData.translatedText;
  }
  
  throw new Error(data.responseDetails || 'Translation failed');
}

export async function translateArabicToEnglish(arabicText: string): Promise<string> {
  if (!arabicText.trim()) {
    return '';
  }

  const chunks = splitIntoChunks(arabicText.trim());
  const translations: string[] = [];
  
  for (const chunk of chunks) {
    try {
      // Add small delay between requests to avoid rate limiting
      if (translations.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      const translated = await translateChunk(chunk);
      translations.push(translated);
    } catch (error) {
      console.error('Chunk translation error:', error);
      throw error;
    }
  }
  
  return translations.join(' ');
}
