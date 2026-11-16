import { useState } from 'react';
import { Clock, Copy, Mail, MapPin, Navigation, Phone, TramFront } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useT } from '@/hooks/useT';
import { useTestLang } from '@/hooks/useTestLang';
import { useToast } from '@/hooks/use-toast';
import { EXAM_CENTERS, googleMapsUrl, telHref, yandexMapsUrl, type ExamCenter } from '@/features/centers/centers';

const ExamCentersPage = () => {
  const t = useT();
  const [lang] = useTestLang();
  const { toast } = useToast();
  const [open, setOpen] = useState<ExamCenter | null>(null);
  const name = (c: ExamCenter) => (lang === 'ru' ? c.nameRu : c.name);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t('Нусхаланди', 'Скопировано') });
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  return (
    <PageShell title="Imtihon markazlari" icon={<MapPin className="h-5 w-5" />}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t(
          `Ўзбекистон бўйлаб ${EXAM_CENTERS.length} та расмий имтиҳон маркази`,
          `${EXAM_CENTERS.length} официальных экзаменационных центров по Узбекистану`,
        )}
      </p>
      <div className="space-y-3">
        {EXAM_CENTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpen(c)}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-left transition-colors active:bg-secondary/60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <MapPin className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold leading-tight text-foreground">{name(c)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{c.address}</span>
            </span>
          </button>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{name(open)}</DialogTitle>
                <p className="text-sm text-muted-foreground">{t('Имтиҳон маркази', 'Экзаменационный центр')}</p>
              </DialogHeader>

              <Row icon={MapPin} label={t('Манзил', 'Адрес')}>
                <span className="flex items-start gap-2">
                  <span className="flex-1">{open.address}</span>
                  <button
                    type="button"
                    onClick={() => copy(open.address)}
                    aria-label={t('Нусхалаш', 'Копировать')}
                    className="text-muted-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </span>
              </Row>
              <Row icon={Clock} label={t('Иш вақти', 'Время работы')}>
                {t('Душанба – Шанба, 9:00 – 18:00', 'Понедельник – суббота, 9:00 – 18:00')}
              </Row>
              {open.transport && (
                <Row icon={TramFront} label={t('Транспорт', 'Транспорт')}>
                  {lang === 'ru' && open.transportRu ? open.transportRu : open.transport}
                </Row>
              )}
              {open.phones.map((p) => (
                <Row key={p} icon={Phone} label={t('Телефон', 'Телефон')}>
                  <a href={telHref(p)} className="font-semibold text-primary">
                    {p}
                  </a>
                </Row>
              ))}
              <Row icon={Mail} label={t('Электрон почта', 'Электронная почта')}>
                <a href={`mailto:${open.email}`} className="font-semibold text-primary">
                  {open.email}
                </a>
              </Row>

              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('Харитада очиш', 'Открыть на карте')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button asChild variant="outline" className="h-12">
                  <a href={yandexMapsUrl(open)} target="_blank" rel="noopener noreferrer">
                    <Navigation className="mr-2 h-4 w-4 text-destructive" />
                    Yandex
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-12">
                  <a href={googleMapsUrl(open)} target="_blank" rel="noopener noreferrer">
                    <Navigation className="mr-2 h-4 w-4 text-primary" />
                    Google
                  </a>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

function Row({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

export default ExamCentersPage;
