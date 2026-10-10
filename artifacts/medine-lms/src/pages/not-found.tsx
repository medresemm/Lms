import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { HomeLink } from '@/components/home-link';
import { LanguageSwitch } from '@/lib/i18n';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              404 — Səhifə tapılmadı
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Axtardığınız səhifə tapılmadı.
          </p>
          <div className="mt-6 flex items-center gap-2"><LanguageSwitch /><HomeLink /></div>
        </CardContent>
      </Card>
    </div>
  );
}
