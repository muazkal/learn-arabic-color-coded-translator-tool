import { useState, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Code, Sparkles, Languages, Loader2 } from 'lucide-react';
import { 
  alignTexts, 
  generateCSV, 
  generateHTML, 
  downloadFile,
  WordPair 
} from '@/lib/textAlignment';
import { translateArabicToEnglish } from '@/lib/translationService';
import { useToast } from '@/hooks/use-toast';

const colorClasses: Record<string, { text: string; bg: string }> = {
  red: { text: 'pair-red', bg: 'bg-pair-red' },
  blue: { text: 'pair-blue', bg: 'bg-pair-blue' },
  green: { text: 'pair-green', bg: 'bg-pair-green' },
  orange: { text: 'pair-orange', bg: 'bg-pair-orange' },
  purple: { text: 'pair-purple', bg: 'bg-pair-purple' },
};

export function TextAligner() {
  const [arabicText, setArabicText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();

  const pairs = useMemo(() => {
    if (!arabicText.trim() || !englishText.trim()) return [];
    return alignTexts(arabicText, englishText);
  }, [arabicText, englishText]);

  const handleTranslate = async () => {
    if (!arabicText.trim()) {
      toast({
        title: "No text to translate",
        description: "Please enter Arabic text first.",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);
    try {
      const translation = await translateArabicToEnglish(arabicText);
      setEnglishText(translation);
      toast({
        title: "Translation complete",
        description: "Arabic text has been translated to English.",
      });
    } catch (error) {
      toast({
        title: "Translation failed",
        description: "Could not translate the text. Please try again or enter translation manually.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownloadCSV = () => {
    if (pairs.length === 0) return;
    const csv = generateCSV(pairs);
    downloadFile(csv, 'word-pairs.csv', 'text/csv;charset=utf-8;');
  };

  const handleDownloadHTML = () => {
    if (pairs.length === 0) return;
    const html = generateHTML(pairs);
    downloadFile(html, 'word-pairs.html', 'text/html;charset=utf-8;');
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Text Aligner
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Enter Arabic text, auto-translate to English, and get color-coded word pairs.
            Perfect for language learning and translation visualization.
          </p>
        </div>

        {/* Input Section */}
        <Card className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="font-arabic">عربي</span>
              <span className="text-muted-foreground font-normal">Arabic Input</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="اكتب النص العربي هنا..."
              value={arabicText}
              onChange={(e) => setArabicText(e.target.value)}
              className="min-h-[180px] text-area-arabic text-lg resize-none"
            />
            <Button
              onClick={handleTranslate}
              disabled={isTranslating || !arabicText.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Languages className="w-5 h-5" />
                  Translate to English
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Translation Result */}
        {englishText && (
          <Card className="mb-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span>English</span>
                <span className="text-muted-foreground font-normal">Translation (editable)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Translation will appear here..."
                value={englishText}
                onChange={(e) => setEnglishText(e.target.value)}
                className="min-h-[120px] text-lg resize-none"
              />
            </CardContent>
          </Card>
        )}

        {/* Preview Section */}
        {pairs.length > 0 && (
          <Card className="mb-8 animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Color-Coded Pairs Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pairs.map((pair, index) => (
                  <PairPreview key={index} pair={pair} index={index} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Download Buttons */}
        {pairs.length > 0 && (
          <div 
            className="flex flex-wrap justify-center gap-4 animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            <Button
              size="lg"
              onClick={handleDownloadCSV}
              className="gap-2"
            >
              <FileText className="w-5 h-5" />
              Download CSV
              <Download className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={handleDownloadHTML}
              className="gap-2"
            >
              <Code className="w-5 h-5" />
              Download HTML
              <Download className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Instructions */}
        {!arabicText.trim() && (
          <div className="text-center mt-8 text-muted-foreground animate-fade-in">
            <p>Enter Arabic text above and click "Translate" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PairPreview({ pair, index }: { pair: WordPair; index: number }) {
  const colors = colorClasses[pair.colorName] || colorClasses.red;
  
  return (
    <div 
      className={`flex items-center gap-4 p-3 rounded-lg ${colors.bg} animate-fade-in`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <span className={`font-arabic text-xl ${colors.text} font-semibold flex-1 text-right`}>
        {pair.arabic || '—'}
      </span>
      <span className="text-muted-foreground">→</span>
      <span className={`text-lg ${colors.text} font-medium flex-1`}>
        {pair.english || '—'}
      </span>
    </div>
  );
}
