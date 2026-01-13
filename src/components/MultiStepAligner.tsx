import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Download, FileText, Code, Sparkles, Languages, Loader2, CheckCircle, Edit3, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  generateCSV, 
  generateHTML, 
  downloadFile,
  WordPair 
} from '@/lib/textAlignment';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const COLORS = [
  { name: 'red', hex: '#dc2626' },
  { name: 'blue', hex: '#2563eb' },
  { name: 'green', hex: '#16a34a' },
  { name: 'orange', hex: '#ea580c' },
  { name: 'purple', hex: '#9333ea' },
];

interface TranslationPair {
  arabic: string;
  english: string;
}

type Step = 'input' | 'editing' | 'output';

export function MultiStepAligner() {
  const [step, setStep] = useState<Step>('input');
  const [arabicText, setArabicText] = useState('');
  const [pairs, setPairs] = useState<TranslationPair[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalPairs, setFinalPairs] = useState<WordPair[]>([]);
  const { toast } = useToast();

  const handleSubmitArabic = async () => {
    if (!arabicText.trim()) {
      toast({
        title: "No text entered",
        description: "Please enter Arabic text to translate.",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('translate-arabic', {
        body: { arabicText }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Set pairs from AI response
      if (data.pairs && data.pairs.length > 0) {
        // Filter out newline markers for now
        const translationPairs = data.pairs.filter(
          (p: TranslationPair) => p.arabic !== '[NEWLINE]'
        );
        setPairs(translationPairs);
      } else {
        // Fallback: split the full translation
        const arabicWords = arabicText.trim().split(/\s+/);
        const englishWords = (data.fullTranslation || '').trim().split(/\s+/);
        
        const fallbackPairs: TranslationPair[] = arabicWords.map((arabic, idx) => ({
          arabic,
          english: englishWords[idx] || ''
        }));
        setPairs(fallbackPairs);
      }

      setStep('editing');
      toast({
        title: "Translation complete",
        description: "Review and edit the translations below.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation failed';
      setError(message);
      toast({
        title: "Translation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePairChange = (index: number, english: string) => {
    setPairs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], english };
      return updated;
    });
  };

  const handleSubmitTranslation = () => {
    const coloredPairs: WordPair[] = pairs.map((pair, idx) => ({
      arabic: pair.arabic,
      english: pair.english,
      color: COLORS[idx % COLORS.length].hex,
      colorName: COLORS[idx % COLORS.length].name,
    }));

    setFinalPairs(coloredPairs);
    setStep('output');
    toast({
      title: "Color-coding complete",
      description: "Your text is ready to download.",
    });
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV(finalPairs);
    downloadFile(csv, 'arabic-english-pairs.csv', 'text/csv;charset=utf-8;');
    toast({ title: "CSV downloaded" });
  };

  const handleDownloadHTML = () => {
    const html = generateHTML(finalPairs);
    downloadFile(html, 'arabic-english-pairs.html', 'text/html;charset=utf-8;');
    toast({ title: "HTML downloaded" });
  };

  const handleReset = () => {
    setStep('input');
    setArabicText('');
    setPairs([]);
    setFinalPairs([]);
    setError(null);
  };

  const colorClasses: Record<string, { text: string; bg: string }> = {
    red: { text: 'text-red-600', bg: 'bg-red-50' },
    blue: { text: 'text-blue-600', bg: 'bg-blue-50' },
    green: { text: 'text-green-600', bg: 'bg-green-50' },
    orange: { text: 'text-orange-500', bg: 'bg-orange-50' },
    purple: { text: 'text-purple-600', bg: 'bg-purple-50' },
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Arabic Text Color Coder
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            AI-powered translation with editable word-by-word alignment
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center items-center gap-4 mb-8">
          {[
            { key: 'input', label: 'Input Arabic', icon: Languages },
            { key: 'editing', label: 'Edit Translations', icon: Edit3 },
            { key: 'output', label: 'Download', icon: Download },
          ].map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                ${step === s.key 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : finalPairs.length > 0 && idx < ['input', 'editing', 'output'].indexOf(step)
                    ? 'bg-green-100 text-green-700 border-green-500'
                    : 'bg-muted text-muted-foreground border-border'}
              `}>
                <s.icon className="w-5 h-5" />
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${step === s.key ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {idx < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground ml-4" />}
            </div>
          ))}
        </div>

        {/* Step 1: Arabic Input */}
        {step === 'input' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Step 1: Enter Arabic Text
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="اكتب النص العربي هنا...&#10;&#10;(Enter your Arabic text here. Line breaks will be preserved.)"
                value={arabicText}
                onChange={(e) => setArabicText(e.target.value)}
                className="min-h-[250px] text-xl font-arabic text-right resize-none"
                dir="rtl"
              />
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                size="lg"
                onClick={handleSubmitArabic}
                disabled={isTranslating || !arabicText.trim()}
                className="w-full gap-2"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Translating with AI...
                  </>
                ) : (
                  <>
                    Submit for Translation
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Editable Translation Table */}
        {step === 'editing' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Step 2: Review & Edit Translations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Edit the English translations in the right column. The Arabic text on the left is read-only.
              </p>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-muted p-3 font-semibold text-sm">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-5 text-right pr-4">Arabic (عربي)</div>
                  <div className="col-span-6">English Translation</div>
                </div>
                <div className="max-h-[400px] overflow-y-auto divide-y">
                  {pairs.map((pair, idx) => (
                    <div 
                      key={idx} 
                      className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-muted/50 transition-colors"
                    >
                      <div className="col-span-1 text-center text-sm text-muted-foreground">
                        {idx + 1}
                      </div>
                      <div 
                        className="col-span-5 text-right pr-4 font-arabic text-lg"
                        dir="rtl"
                      >
                        {pair.arabic}
                      </div>
                      <div className="col-span-6">
                        <Input
                          value={pair.english}
                          onChange={(e) => handlePairChange(idx, e.target.value)}
                          placeholder="Enter translation..."
                          className="text-base"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep('input')}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handleSubmitTranslation}
                  className="flex-1 gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Submit Translation & Generate Colors
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Final Output */}
        {step === 'output' && (
          <div className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Color-Coded Output ({finalPairs.length} pairs)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {finalPairs.map((pair, idx) => {
                    const colors = colorClasses[pair.colorName] || colorClasses.red;
                    return (
                      <div 
                        key={idx}
                        className={`flex items-center gap-4 p-3 rounded-lg ${colors.bg}`}
                      >
                        <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
                        <span 
                          className={`font-arabic text-xl ${colors.text} font-semibold flex-1 text-right`}
                          dir="rtl"
                        >
                          {pair.arabic}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className={`text-lg ${colors.text} font-medium flex-1`}>
                          {pair.english}
                        </span>
                        <span 
                          className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text} border font-medium`}
                        >
                          {pair.colorName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" onClick={handleDownloadCSV} className="gap-2">
                <FileText className="w-5 h-5" />
                Download CSV
                <Download className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="secondary" onClick={handleDownloadHTML} className="gap-2">
                <Code className="w-5 h-5" />
                Download HTML
                <Download className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('editing')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Edit Translations
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Start Over
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
