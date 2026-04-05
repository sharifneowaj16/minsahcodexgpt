'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star, Edit, Trash2, Search, Plus, Eye, Heart, MessageCircle, Check, X, ShoppingBag, Package } from 'lucide-react';
import { Star as StarSolid } from 'lucide-react';

// ✅ Smart image renderer — string path → <img>, anything else → fallback icon
function ProductImage({ src, name }: { src: any; name: string }) {
  if (typeof src === 'string' && (src.startsWith('/') || src.startsWith('http'))) {
    return (
      <img
        src={src}
        alt={name}
        className="w-full h-full object-cover rounded-lg"
        onError={(e) => {
          // If image fails to load, show fallback
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style');
        }}
      />
    );
  }
  // React element (icon) or emoji
  if (src && typeof src === 'object') return src;
  return <Package className="w-8 h-8 text-purple-400" />;
}

interface ReviewItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  rating: number;
  title: string;
  content: string;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface ReviewableProduct {
  id: string;
  name: string;
  image: string | null;
  orderDate: string | Date;
  canReview: boolean;
}

interface ReviewsClientProps {
  reviews: ReviewItem[];
  reviewableProducts: ReviewableProduct[];
}

export function ReviewsClient({ reviews: initialReviews, reviewableProducts }: ReviewsClientProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('my-reviews');
  const [errorMessage, setErrorMessage] = useState('');
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const tabs = [
    { id: 'my-reviews', name: 'My Reviews', count: reviews.length },
    { id: 'write-review', name: 'Write Review', count: reviewableProducts.length },
  ];

  const filteredReviews = useMemo(() => {
    let filtered = reviews;
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (normalizedSearchTerm) {
      filtered = filtered.filter((review) =>
        review.productName.toLowerCase().includes(normalizedSearchTerm) ||
        review.title.toLowerCase().includes(normalizedSearchTerm)
      );
    }

    if (ratingFilter !== 'all') {
      filtered = filtered.filter((review) => review.rating === Number.parseInt(ratingFilter, 10));
    }

    return filtered;
  }, [reviews, searchTerm, ratingFilter]);

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) {
      return;
    }

    setErrorMessage('');
    setDeletingReviewId(reviewId);

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to delete review');
      }

      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
      router.refresh();
    } catch {
      setErrorMessage('Failed to delete review. Please try again.');
    } finally {
      setDeletingReviewId(null);
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) =>
        i < rating ? (
          <StarSolid key={i} className="w-4 h-4 text-yellow-400 fill-current" />
        ) : (
          <Star key={i} className="w-4 h-4 text-gray-300" />
        )
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">My Reviews</h1>
        <p className="text-gray-600">Manage your product reviews</p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.name}
                {tab.count > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* My Reviews Tab */}
      {activeTab === 'my-reviews' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Ratings</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{r} Stars</option>
              ))}
            </select>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No reviews found</h3>
              <p className="text-gray-600 mb-6">You haven&apos;t written any reviews yet</p>
              <button
                onClick={() => setActiveTab('write-review')}
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Write Your First Review
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((review) => (
                <div key={review.id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      {/* ✅ Smart image — renders <img> for string paths */}
                      <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        <ProductImage src={review.productImage} name={review.productName} />
                        {/* Hidden fallback span */}
                        <span style={{ display: 'none' }}>
                          <Package className="w-8 h-8 text-purple-400" />
                        </span>
                      </div>
                      <div>
                        <Link
                          href={`/products/${review.productId}`}
                          className="text-lg font-medium hover:text-purple-600"
                        >
                          {review.productName}
                        </Link>
                        <div className="flex items-center space-x-3 mt-1">
                          {renderStars(review.rating)}
                          <span className="text-sm text-gray-600">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                          {review.isVerified && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Eye className="w-3 h-3 mr-1" />
                              Verified Purchase
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Link
                        href={`/account/reviews/write?reviewId=${review.id}`}
                        className="p-2 text-gray-400 hover:text-purple-600 rounded-lg transition"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDeleteReview(review.id)}
                        disabled={deletingReviewId === review.id}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">{review.title}</h3>
                    <p className="text-gray-700 text-sm leading-relaxed">{review.content}</p>
                  </div>

                  <div className="flex items-center space-x-6 mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center text-sm text-gray-500">
                      <Heart className="w-4 h-4 mr-1" />
                      {review.helpfulCount} helpful
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <MessageCircle className="w-4 h-4 mr-1" />
                      0 comments
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Write Review Tab */}
      {activeTab === 'write-review' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Products to Review</h2>
            {reviewableProducts.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No products to review</h3>
                <p className="text-gray-600 mb-6">Once you make a purchase, you can review the products here</p>
                <Link
                  href="/shop"
                  className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Start Shopping
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reviewableProducts.map((product) => (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center overflow-hidden">
                        <ProductImage src={product.image} name={product.name} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-600">
                          Purchased: {new Date(product.orderDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/account/reviews/write?productId=${product.id}`}
                      className="w-full inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Write Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review Guidelines */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Review Guidelines</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm">Be honest and detailed in your review</p>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm">Include information about product quality and results</p>
              </div>
              <div className="flex items-start space-x-3">
                <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm">Don&apos;t include personal information</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
