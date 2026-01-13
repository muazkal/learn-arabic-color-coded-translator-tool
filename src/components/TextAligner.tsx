import { useState, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Code, Sparkles, Languages, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
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
    setTranslationError(null);
    
    try {
      const translation = await translateArabicToEnglish(arabicText);
      setEnglishText(translation);
      setShowManualInput(false);
      toast({
        title: "Translation complete",
        description: "Arabic text has been translated to English.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTranslationError(errorMessage);
      setShowManualInput(true);
      toast({
        title: "Translation failed",
        description: "Please enter the English translation manually below.",
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
    toast({ title: "CSV downloaded successfully" });
  };

  const handleDownloadHTML = () => {
    if (pairs.length === 0) return;
    const html = generateHTML(pairs);
    downloadFile(html, 'word-pairs.html', 'text/html;charset=utf-8;');
    toast({ title: "HTML downloaded successfully" });
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Arabic-English Text Aligner
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Enter Arabic text, translate to English, and get color-coded word pairs.
            Download as CSV or HTML for language learning.
          </p>
        </div>

        {/* Arabic Input */}
        <Card className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="font-arabic">عربي</span>
              <span className="text-muted-foreground font-normal">Arabic Input</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="اكتب النص العربي هنا... (Enter Arabic text here)"
              value={arabicText}
              onChange={(e) => setArabicText(e.target.value)}
              className="min-h-[180px] text-area-arabic text-lg resize-none"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleTranslate}
                disabled={isTranslating || !arabicText.trim()}
                className="flex-1 gap-2"
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
                    Auto-Translate to English
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowManualInput(!showManualInput)}
                size="lg"
              >
                {showManualInput ? 'Hide' : 'Manual'} Input
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Translation Error Alert */}
        {translationError && (
          <Alert variant="destructive" className="mb-6 animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Translation failed: {translationError}. Please enter the English translation manually below.
            </AlertDescription>
          </Alert>
        )}

        {/* English Input (Manual or Result) */}
        {(showManualInput || englishText) && (
          <Card className="mb-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span>English</span>
                <span className="text-muted-foreground font-normal">
                  {englishText && !showManualInput ? 'Translation (editable)' : 'Enter translation manually'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter or edit the English translation here..."
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
              <CardTitle className="text-lg">Color-Coded Pairs Preview ({pairs.length} pairs)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
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
            <p>Enter Arabic text above and click "Auto-Translate" or use "Manual Input" to get started.</p>
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
      style={{ animationDelay: `${Math.min(index * 0.03, 0.5)}s` }}
    >
      <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
      <span className={`font-arabic text-xl ${colors.text} font-semibold flex-1 text-right`}>
        {pair.arabic || '—'}
      </span>
      <span className="text-muted-foreground">→</span>
      <span className={`text-lg ${colors.text} font-medium flex-1`}>
        {pair.english || '—'}
      </span>
      <span className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text} border`}>
        {pair.colorName}
      </span>
    </div>
  );
}
