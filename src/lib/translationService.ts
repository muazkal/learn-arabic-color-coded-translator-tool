export async function translateArabicToEnglish(arabicText: string): Promise<string> {
  if (!arabicText.trim()) {
    return '';
  }

  try {
    // Using MyMemory Translation API (free, no API key required for basic usage)
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(arabicText)}&langpair=ar|en`
    );

    if (!response.ok) {
      throw new Error('Translation request failed');
    }

    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    
    throw new Error(data.responseDetails || 'Translation failed');
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}
