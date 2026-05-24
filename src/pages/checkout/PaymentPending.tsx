import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import { GlassFilter } from "../../components/ui/liquid-glass";
import { NmaGlassButton, NmaGlassSurface } from "../../components/ui/nma-glass";
import LogoLoader from "../../components/ui/LogoLoader";
import { paymentService } from "../../services/paymentService";

export default function PaymentPending() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const orderId = searchParams.get("order");
  const courseSlug = searchParams.get("course");

  const refreshStatus = React.useCallback(async () => {
    if (!orderId) return;

    setChecking(true);
    setError(null);

    try {
      const payment = await paymentService.getPaymentStatus(orderId);
      if (["paid", "confirmed"].includes(payment.status)) {
        navigate(`/payment/success?order=${orderId}&course=${courseSlug ?? ""}`);
        return;
      }

      if (["failed", "canceled", "expired", "refunded"].includes(payment.status)) {
        navigate(`/payment/failed?order=${orderId}&course=${courseSlug ?? ""}`);
        return;
      }
    } catch (e) {
      console.error(e);
      setError("Nu am putut verifica plata in acest moment.");
    } finally {
      setChecking(false);
    }
  }, [courseSlug, navigate, orderId]);

  React.useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <div className="min-h-[100dvh] bg-[#030305] pt-32 pb-20 flex flex-col items-center justify-center px-6">
      <GlassFilter />
      <NmaGlassSurface radius="3xl" tone="clear" className="p-10 max-w-lg w-full text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-nma-purple/20 blur-3xl rounded-full" />

        <LogoLoader className="relative z-10 mb-8" size={160} minHeight={0} />

        <div className="space-y-4 relative z-10">
          <h1 className="text-2xl font-bold text-white">Plata este in procesare</h1>
          <p className="text-sm text-gray-400">
            Asteptam confirmarea Netopia. Accesul la curs se activeaza automat dupa confirmarea platii.
          </p>
          {error && <p className="text-sm text-red-300">{error}</p>}

          <NmaGlassButton
            glow="neutral"
            onClick={refreshStatus}
            disabled={checking || !orderId}
            className="w-full py-4 rounded-xl font-bold tracking-wider uppercase text-xs transition-all flex items-center justify-center gap-2"
          >
            {checking ? <LogoLoader size={22} minHeight={0} /> : <>Verifica plata <RefreshCw className="w-4 h-4" /></>}
          </NmaGlassButton>

          <NmaGlassButton
            glow="purple"
            onClick={() => navigate(courseSlug ? `/course/${courseSlug}` : "/dashboard/courses")}
            className="w-full py-4 rounded-xl font-bold tracking-wider uppercase text-xs transition-all flex items-center justify-center gap-2"
          >
            Mergi la cursuri <ArrowRight className="w-4 h-4" />
          </NmaGlassButton>
        </div>
      </NmaGlassSurface>
    </div>
  );
}
