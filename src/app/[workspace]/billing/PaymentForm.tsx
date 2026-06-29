"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface PaymentFormProps {
  onCancel: () => void;
}

export function PaymentForm({ onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?success=true`,
      },
    });

    if (confirmError) {
      setError(confirmError.message || "An unexpected error occurred.");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-200 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-4 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="px-4 py-2 text-sm font-medium border border-zinc-800 text-zinc-300 hover:bg-zinc-900 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-lg transition-colors disabled:opacity-50"
        >
          {processing && (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
          )}
          {processing ? "Processing..." : "Pay & Subscribe"}
        </button>
      </div>
    </form>
  );
}
