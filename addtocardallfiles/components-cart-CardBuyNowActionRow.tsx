'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import BuyNowModal, { type BuyNowVariantOption } from './BuyNowModal';
import CartStepper from './CartStepper';

interface CardBuyNowActionRowProps {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  maxStock?: number;
  hasRequiredVariants?: boolean;
  variants?: BuyNowVariantOption[];
  disabled?: boolean;
  className?: string;
  stepperClassName?: string;
  buttonClassName?: string;
}

export default function CardBuyNowActionRow({
  productId,
  productName,
  productImage,
  price,
  maxStock = 99,
  hasRequiredVariants = false,
  variants,
  disabled = false,
  className = '',
  stepperClassName = 'flex-1',
  buttonClassName = '',
}: CardBuyNowActionRowProps) {
  const [isBuyNowOpen, setIsBuyNowOpen] = useState(false);

  const canPurchase = variants?.length ? variants.some((variant) => variant.stock > 0) : maxStock > 0;
  const isDisabled = disabled || !canPurchase;

  return (
    <>
      <div className={`flex gap-2 ${className}`}>
        <CartStepper
          productId={productId}
          productName={productName}
          productImage={productImage}
          price={price}
          maxStock={maxStock}
          hasRequiredVariants={hasRequiredVariants}
          variants={variants}
          className={stepperClassName}
          disabled={isDisabled}
        />

        <button
          type="button"
          onClick={() => setIsBuyNowOpen(true)}
          disabled={isDisabled}
          className={`flex min-w-[104px] items-center justify-center gap-1.5 rounded-2xl bg-[#3D1F0E] px-4 py-3 text-sm font-semibold text-[#F5E6D3] transition-all duration-200 hover:bg-[#2A1509] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 ${buttonClassName}`}
        >
          <ShoppingBag size={15} />
          Buy Now
        </button>
      </div>

      <BuyNowModal
        isOpen={isBuyNowOpen}
        productId={productId}
        productName={productName}
        productImage={productImage}
        basePrice={price}
        variants={variants}
        onClose={() => setIsBuyNowOpen(false)}
      />
    </>
  );
}
