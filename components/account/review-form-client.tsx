'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Star } from 'lucide-react';

interface ReviewFormClientProps {
  mode: 'create' | 'edit';
  product: {
    id: string;
    name: string;
    image: string | null;
  };
  initialValues: {
    rating: number;
    title: string;
    comment: string;
  };
  reviewId?: string;
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  if (src && (src.startsWith('/') || src.startsWith('http'))) {
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100 text-sm font-medium text-purple-600">
      {alt.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ReviewFormClient({
  mode,
  product,
  initialValues,
  reviewId,
}: ReviewFormClientProps) {
  const router = useRouter();
  const [rating, setRating] = useState(initialValues.rating);
  const [title, setTitle] = useState(initialValues.title);
  const [comment, setComment] = useState(initialValues.comment);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const heading = mode === 'edit' ? 'Edit Review' : 'Write a Review';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (rating < 1 || rating > 5) {
      setErrorMessage('Please select a rating.');
      return;
    }

    if (!comment.trim()) {
      setErrorMessage('Please write a short review before submitting.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === 'edit' && reviewId ? `/api/reviews/${reviewId}` : '/api/reviews',
        {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            rating,
            title: title.trim(),
            comment: comment.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save review');
      }

      router.push('/account/reviews');
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{heading}</h1>
          <p className="text-gray-600">Share your experience with this product</p>
        </div>
        <Link
          href="/account/reviews"
          className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reviews
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
          <div className="h-20 w-20 overflow-hidden rounded-lg bg-gray-100">
            <ProductImage src={product.image} alt={product.name} />
          </div>
          <div>
            <p className="text-sm font-medium text-purple-600">
              {mode === 'edit' ? 'Updating your review for' : 'Reviewing'}
            </p>
            <h2 className="text-xl font-semibold text-gray-900">{product.name}</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pt-6">
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">Your Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="rounded-full p-1 transition hover:scale-105"
                  aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`h-7 w-7 ${
                      value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-500">
                {rating > 0 ? `${rating} out of 5` : 'Select a rating'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-700">
              Review Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Summarize your experience"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label htmlFor="comment" className="mb-2 block text-sm font-medium text-gray-700">
              Your Review
            </label>
            <textarea
              id="comment"
              rows={6}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What did you like? How was the quality, packaging, or result?"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-70"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'edit' ? 'Update Review' : 'Submit Review'}
            </button>
            <Link
              href="/account/reviews"
              className="inline-flex items-center rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
