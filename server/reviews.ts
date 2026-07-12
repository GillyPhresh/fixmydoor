import type { Review, ReviewRequest, ReviewStatus } from "../shared/types";
import { prisma } from "./prisma";

const VALID_REVIEW_STATUSES: ReviewStatus[] = ["PENDING", "APPROVED", "HIDDEN"];

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

export function validateReviewStatus(status: any): status is ReviewStatus {
  return typeof status === "string" && VALID_REVIEW_STATUSES.includes(status as ReviewStatus);
}

function toReview(review: {
  id: string;
  name: string;
  location: string | null;
  rating: number;
  quote: string;
  status?: string;
  adminNotes?: string | null;
  createdAt: Date;
}): Review {
  return {
    id: review.id,
    name: review.name,
    location: review.location ?? undefined,
    rating: review.rating,
    quote: review.quote,
    status: validateReviewStatus(review.status) ? review.status : undefined,
    adminNotes: review.adminNotes ?? undefined,
    createdAt: review.createdAt.toISOString(),
  };
}

export async function listReviews(limit = 12, status: ReviewStatus = "APPROVED"): Promise<Review[]> {
  const safeLimit = Math.min(30, Math.max(1, limit));
  const reviews = await prisma.review.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  return reviews.map(toReview);
}

export async function listAdminReviews(limit = 50): Promise<Review[]> {
  const safeLimit = Math.min(100, Math.max(1, limit));
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
      status: "PENDING",
    },
  });

  return toReview(createdReview);
}

export async function saveAdminReview(review: ReviewRequest & { status?: ReviewStatus; adminNotes?: string }): Promise<Review> {
  const createdReview = await prisma.review.create({
    data: {
      name: review.name.trim(),
      location: review.location?.trim() || null,
      rating: review.rating,
      quote: review.quote.trim(),
      status: validateReviewStatus(review.status) ? review.status : "APPROVED",
      adminNotes: review.adminNotes?.trim().slice(0, 300) || null,
    },
  });

  return toReview(createdReview);
}
