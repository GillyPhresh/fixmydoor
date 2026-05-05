import type { Review, ReviewRequest } from "../shared/types";
import { prisma } from "./prisma";

export function validateReview(body: any): body is ReviewRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof body.name === "string" &&
    body.name.trim().length >= 2 &&
    body.name.trim().length <= 80 &&
    (body.location === undefined || (typeof body.location === "string" && body.location.trim().length <= 100)) &&
    typeof body.quote === "string" &&
    body.quote.trim().length >= 8 &&
    body.quote.trim().length <= 500 &&
    Number.isInteger(body.rating) &&
    body.rating >= 1 &&
    body.rating <= 5
  );
}

function toReview(review: {
  id: string;
  name: string;
  location: string | null;
  rating: number;
  quote: string;
  createdAt: Date;
}): Review {
  return {
    id: review.id,
    name: review.name,
    location: review.location ?? undefined,
    rating: review.rating,
    quote: review.quote,
    createdAt: review.createdAt.toISOString(),
  };
}

export async function listReviews(limit = 12): Promise<Review[]> {
  const safeLimit = Math.min(30, Math.max(1, limit));
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  return reviews.map(toReview);
}

export async function saveReview(review: ReviewRequest): Promise<Review> {
  const createdReview = await prisma.review.create({
    data: {
      name: review.name.trim(),
      location: review.location?.trim() || null,
      rating: review.rating,
      quote: review.quote.trim(),
    },
  });

  return toReview(createdReview);
}
