import React, { useState, useEffect } from 'react';
import { metaPixelService } from "../services/metaPixelService";
import { X, CheckCircle2, Loader2, AlertCircle, Zap, Info, Copy, QrCode, Check, Smartphone, UserCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Raffle } from '../types';
import { raffleService } from '../services/raffleService';
import { useCustomerAuth } from '../context/CustomerContext';
import { motion, AnimatePresence } from 'motion/react';

interface CheckoutModalProps {
  raffle: Raffle;
  quantity: number;
  onClose: () => void;
  onSuccess: (numbers: number[], purchaseId: string) => void;
}

enum CheckoutStep {
  FORM = 'FORM',
  PROCESSING = 'PROCESSING',
  PAYMENT = 'PAYMENT',
  SUCCESS = 'SUCCESS'
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ raffle, quantity, onClose, onSuccess }) => {
  const { customer, refreshCustomer } = useCustomerAuth();
  const [step, setStep] = useState<CheckoutStep>(CheckoutStep.FORM);
  const [cpf, setCpf] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [createdPurchaseId, setCreatedPurchaseId] = useState<string | null>(null);

  useEffect(() => {
    metaPixelService.track('InitiateCheckout', {
      content_ids: [raffle.id],
      content_type: 'product',
      content_name: raffle.name,
      value: quantity * raffle.pricePerNumber,
      currency: 'BRL',
      num_items: quantity
    });
  }, []);

  // Auto pre-fill if logged in as customer
  useEffect(() => {
    if (customer) {
      if (customer.fullName && !customer.fullName.startsWith('Cliente ')) {
        setName(customer.fullName);
      }
      if (customer.cpf) {
        let clean = customer.cpf.replace(/\D/g, '');
        if (clean.length === 11) {
          let masked = clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
          setCpf(masked);
        }
      }
      if (customer.phone) {
        let p = customer.phone.replace(/\D/g, '');
        if (p.length === 11) {
          p = p.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else if (p.length === 10) {
          p = p.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
        }
        setPhone(p);
      }
      if (customer.email && !customer.email.includes('@example.invalid')) {
        setEmail(customer.email);
      }
    }
  }, [customer]);

  // PIX Data
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [manualCheckMsg, setManualCheckMsg] = useState<string | null>(null);

  const totalValue = quantity * raffle.pricePerNumber;

  // Format CPF
  const handleCpfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    const cleanCpf = value;
    
    let masked = value;
    if (value.length > 9) masked = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (value.length > 6) masked = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (value.length > 3) masked = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    
    setCpf(masked);
  };

  // Format Phone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    }
    setPhone(value);
  };

  // Submit Checkout Form -> Create reservation & Request PIX Payment
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (generatingPix) return;

    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (cleanCpf.length < 11) {
      setError('Informe um CPF válido com 11 dígitos.');
      return;
    }
    if (!cleanName || cleanName.length < 3) {
      setError('Informe seu nome completo.');
      return;
    }
    if (cleanPhone.length < 10) {
      setError('Informe um telefone válido com DDD.');
      return;
    }

    setError(null);
    setStep(CheckoutStep.PROCESSING);

    const placeholderEmail = `${cleanCpf}@example.invalid`;

    try {
      const finalEmail = (cleanEmail && cleanEmail.includes('@')) ? cleanEmail : placeholderEmail;

      // 1. We skip local DB insert and rely entirely on the backend to create the profile, purchase and PIX
      setGeneratingPix(true);
      const payRes = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raffleId: raffle.id,
          quantity: quantity,
          payer: {
            name: cleanName,
            email: finalEmail,
            cpf: cleanCpf,
            phone: cleanPhone
          }
        })
      });

      const payData = await payRes.json().catch(() => null);

      if (payData && payData.success) {
        const purchaseId = payData.purchaseId;
        setCreatedPurchaseId(purchaseId);
        
        const code = payData.pixCode || '';
        let qr = payData.qrCode || '';
        
        // If no direct QR image was provided by Simplify, build a QR code image from the copia e cola PIX code string
        if (!qr && code) {
          qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(code)}`;
        } else if (qr && !qr.startsWith('http') && !qr.startsWith('data:image')) {
          if (qr.startsWith('iVBOR') || qr.length > 50) {
            qr = `data:image/png;base64,${qr}`;
          } else if (qr.startsWith('000201')) {
            // It's a PIX string accidentally placed in qrCode
            qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
          }
        }

        setPixCode(code);
        setQrCodeUrl(qr);
        setStep(CheckoutStep.PAYMENT);
      } else {
        setError(payData?.error || 'Erro ao conectar com a Simplify para gerar o PIX.');
        setStep(CheckoutStep.FORM);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao processar checkout.');
      setStep(CheckoutStep.FORM);
    } finally {
      setGeneratingPix(false);
    }
  };

  // Copy PIX Code
  const handleCopyPix = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Check payment status manually
  const checkPaymentStatus = async () => {
    if (!createdPurchaseId) return;
    setCheckingStatus(true);
    setManualCheckMsg(null);
    try {
      const status = await raffleService.getPurchaseStatus(createdPurchaseId);
      const normalizedStatus = String(status || '').toLowerCase();
      if (normalizedStatus === 'paid' || normalizedStatus === 'confirmed') {
        const numbers = await raffleService.adminGetTicketsByPurchase(createdPurchaseId);
        metaPixelService.track('Purchase', {
  content_ids: [raffle.id],
  content_type: 'product',
  value: quantity * raffle.pricePerNumber,
  currency: 'BRL'
}, createdPurchaseId);
setStep(CheckoutStep.SUCCESS);
        onSuccess(numbers, createdPurchaseId);
      } else {
        setManualCheckMsg('Pagamento ainda não confirmado. Caso já tenha pago, aguarde a confirmação do banco.');
      }
    } catch (err) {
      console.error("Error checking payment status:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Polling payment status every 5 seconds when in PAYMENT step
  useEffect(() => {
    if (step !== CheckoutStep.PAYMENT || !createdPurchaseId) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const status = await raffleService.getPurchaseStatus(createdPurchaseId);
        const normalizedStatus = String(status || '').toLowerCase();
        if (isSubscribed && (normalizedStatus === 'paid' || normalizedStatus === 'confirmed')) {
          clearInterval(interval);
          const numbers = await raffleService.adminGetTicketsByPurchase(createdPurchaseId);
          metaPixelService.track('Purchase', {
  content_ids: [raffle.id],
  content_type: 'product',
  value: quantity * raffle.pricePerNumber,
  currency: 'BRL'
}, createdPurchaseId);
setStep(CheckoutStep.SUCCESS);
          onSuccess(numbers, createdPurchaseId);
        }
      } catch (err) {
        console.error("Polling status error:", err);
      }
    }, 5000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [step, createdPurchaseId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
      <div className="bg-brand-bg border border-brand-border w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative my-auto">
        {/* Header */}
        <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-black shadow-lg shadow-brand-primary/20">
              {step === CheckoutStep.PAYMENT ? <QrCode size={22} /> : <Zap size={24} fill="currentColor" />}
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight leading-none">
                {step === CheckoutStep.PAYMENT ? 'Pagamento via PIX' : 'Reserva de Cotas'}
              </h2>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {step === CheckoutStep.PAYMENT ? 'Finalize com o código PIX abaixo' : 'Preencha seus dados para pagar'}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white transition-colors rounded-xl hover:bg-zinc-800"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Order Summary - Info Box */}
          <div className="bg-brand-primary-dark/10 border border-brand-primary/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-primary-dark rounded-full flex items-center justify-center text-[#fff] flex-shrink-0 mt-0.5">
              <Info size={18} />
            </div>
            <div className="flex-1">
              <p className="text-brand-primary-light text-xs font-bold leading-tight">
                Você está reservando <span className="text-white font-black">{quantity}</span> cota(s) de <span className="text-white font-black uppercase">{raffle.name}</span>
              </p>
              <p className="text-white font-black text-sm mt-1">
                Total a pagar: <span className="text-brand-primary-light">R$ {totalValue.toFixed(2).replace('.', ',')}</span>
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === CheckoutStep.FORM && (
              <motion.form 
                key="form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleFormSubmit} 
                className="space-y-4"
              >
                {customer && (
                  <div className="p-3 bg-brand-primary/10 border border-brand-primary/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck size={18} className="text-brand-primary-light" />
                      <div>
                        <p className="text-xs font-black text-white">Comprando como <span className="text-brand-primary-light">{customer.fullName}</span></p>
                        <p className="text-[10px] text-zinc-400">Seus dados foram preenchidos automaticamente</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* CPF Field */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">CPF*</label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        autoFocus
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={handleCpfChange}
                        className="w-full bg-brand-card border-2 border-brand-border rounded-2xl px-5 py-3.5 text-white font-black text-base focus:border-brand-primary outline-none transition-all placeholder:text-zinc-700"
                      />
                      {loadingUser && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Loader2 className="animate-spin text-brand-primary" size={18} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Name Field */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Nome Completo*</label>
                    <input
                      type="text"
                      required
                      placeholder="Seu nome e sobrenome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-brand-card border-2 border-brand-border rounded-2xl px-5 py-3.5 text-white font-black text-base focus:border-brand-primary outline-none transition-all placeholder:text-zinc-700"
                    />
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Telefone (DDD)*</label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        placeholder="(00) 00000-0000"
                        value={phone}
                        onChange={handlePhoneChange}
                        className="w-full bg-brand-card border-2 border-brand-border rounded-2xl px-5 py-3.5 text-white font-black text-base focus:border-brand-primary outline-none transition-all placeholder:text-zinc-700"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={16} className="flex-shrink-0" /> {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={cpf.replace(/\D/g, '').length < 11 || !name.trim() || phone.replace(/\D/g, '').length < 10}
                  className="w-full bg-brand-primary hover:bg-brand-primary-dark disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-tight text-lg mt-4 cursor-pointer disabled:cursor-not-allowed"
                >
                  Pagar com PIX <Zap size={20} fill="currentColor" />
                </button>
              </motion.form>
            )}

            {step === CheckoutStep.PROCESSING && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 space-y-4 text-center"
              >
                <div className="relative">
                  <Loader2 className="w-16 h-16 text-brand-primary animate-spin" />
                  <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-primary" size={24} fill="currentColor" />
                </div>
                <div>
                  <p className="text-xl font-black text-white uppercase tracking-tight">Gerando PIX com a Simplify</p>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest animate-pulse mt-1">Aguarde um momento...</p>
                </div>
              </motion.div>
            )}

            {step === CheckoutStep.PAYMENT && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center space-y-5"
              >
                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Aguardando pagamento via PIX...
                </div>

                {/* QR Code Container */}
                {(pixCode || qrCodeUrl) && (
                  <div className="bg-[#ffffff] p-4 rounded-2xl border-4 border-brand-primary shadow-2xl inline-block">
                    {pixCode ? (
                      <QRCodeSVG
                        value={pixCode}
                        size={220}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="M"
                        includeMargin={false}
                      />
                    ) : qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code PIX Simplify" className="w-48 h-48 md:w-56 md:h-56 object-contain" />
                    ) : null}
                  </div>
                )}

                {/* Copy and paste */}
                <div className="w-full space-y-2">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest text-left ml-1">
                    Código Copia e Cola (PIX)
                  </label>
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={2}
                      value={pixCode || ''}
                      className="w-full bg-brand-card border border-brand-border rounded-2xl p-3 pr-10 text-xs font-mono text-white resize-none outline-none select-all"
                    />
                  </div>
                  <button
                    onClick={handleCopyPix}
                    className="w-full bg-brand-primary hover:bg-brand-primary-dark text-black font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-tight text-sm"
                  >
                    {copied ? (
                      <>
                        <Check size={18} strokeWidth={3} /> Código PIX Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={18} /> Copiar Código PIX
                      </>
                    )}
                  </button>
                </div>

                {manualCheckMsg && (
                  <div className="p-3 bg-zinc-800/80 border border-zinc-700 rounded-xl text-white text-xs font-bold text-center">
                    {manualCheckMsg}
                  </div>
                )}

                {/* Manual verify button */}
                <div className="w-full pt-2 flex flex-col gap-2">
                  <button
                    onClick={checkPaymentStatus}
                    disabled={checkingStatus}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs cursor-pointer disabled:opacity-50"
                  >
                    {checkingStatus ? <Loader2 className="animate-spin" size={16} /> : 'Já fiz o pagamento (Verificar)'}
                  </button>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    O pagamento é identificado automaticamente assim que confirmado pelo banco.
                  </p>
                </div>

                {/* Passo a Passo Tutorial PIX */}
                <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 text-left space-y-3 mt-3">
                  <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-wider">
                    <Smartphone size={16} />
                    <span className="text-white">Como pagar via PIX no seu Banco:</span>
                  </div>
                  <ol className="text-xs text-white space-y-2 list-decimal list-inside font-medium leading-relaxed">
                    <li>Copie o código PIX acima ou escaneie o QR Code.</li>
                    <li>Abra o aplicativo do seu banco ou carteira digital (<strong>PicPay, Nubank, Itaú, Banco do Brasil, Bradesco, Mercado Pago</strong>, etc.).</li>
                    <li>Acesse a opção <strong>PIX</strong> e escolha <strong>PIX Copia e Cola</strong> (ou Pagar com QR Code).</li>
                    <li>Cole o código copiado, confira os dados do pagamento e confirme a transferência.</li>
                    <li>Pronto! O sistema vai identificar seu pagamento automaticamente em poucos segundos.</li>
                  </ol>
                </div>
              </motion.div>
            )}

            {step === CheckoutStep.SUCCESS && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 space-y-4 text-center"
              >
                <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center text-green-400">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Pagamento Aprovado!</h3>
                  <p className="text-xs text-zinc-400 mt-2">
                    Código do pedido: <span className="font-mono text-white font-bold">{createdPurchaseId}</span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-4 px-6 py-3 bg-brand-primary text-black font-black rounded-xl uppercase tracking-wider text-sm hover:bg-brand-primary-dark transition-all"
                >
                  Continuar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
