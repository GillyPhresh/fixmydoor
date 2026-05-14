import type { ContentCategory, ContentItem, ContentItemRequest } from "../shared/types";
import { prisma } from "./prisma";

const VALID_CATEGORIES: ContentCategory[] = [
  "advert",
  "serviceShowcase",
  "productCategory",
  "doorProduct",
  "hardwareProduct",
  "projectGallery",
];
const CONTENT_MEDIA_PATTERN = /^(\/uploads\/[a-z0-9-]+\.(png|jpe?g|webp|mp4|webm|ogg)|https?:\/\/[^\s<>"']{1,900})$/i;

function cleanOptional(value: unknown, maxLength = 1000) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, maxLength)
    : null;
}

function validateOptionalMedia(value: unknown) {
  return (
    value === undefined ||
    value === "" ||
    (typeof value === "string" && value.length <= 1000 && CONTENT_MEDIA_PATTERN.test(value.trim()))
  );
}

export function validateContentCategory(category: unknown): category is ContentCategory {
  return typeof category === "string" && VALID_CATEGORIES.includes(category as ContentCategory);
}

export function validateContentItem(body: any): body is ContentItemRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    validateContentCategory(body.category) &&
    typeof body.title === "string" &&
    body.title.trim().length >= 2 &&
    body.title.trim().length <= 120 &&
    (body.description === undefined || (typeof body.description === "string" && body.description.length <= 1000)) &&
    (body.tag === undefined || (typeof body.tag === "string" && body.tag.length <= 80)) &&
    validateOptionalMedia(body.image) &&
    validateOptionalMedia(body.accentImage) &&
    (body.items === undefined || (typeof body.items === "string" && body.items.length <= 500)) &&
    (body.bookingValue === undefined || (typeof body.bookingValue === "string" && body.bookingValue.length <= 100)) &&
    (body.sortOrder === undefined || Number.isInteger(body.sortOrder)) &&
    (body.active === undefined || typeof body.active === "boolean")
  );
}

function toContentItem(item: any): ContentItem {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    description: item.description ?? undefined,
    tag: item.tag ?? undefined,
    image: item.image ?? undefined,
    accentImage: item.accentImage ?? undefined,
    items: item.items ?? undefined,
    bookingValue: item.bookingValue ?? undefined,
    sortOrder: item.sortOrder,
    active: item.active,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
  };
}

export async function listPublicContent() {
  const items = await prisma.contentItem.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return items.map(toContentItem);
}

export async function listAdminContent() {
  const items = await prisma.contentItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return items.map(toContentItem);
}

export async function createContentItem(item: ContentItemRequest) {
  const created = await prisma.contentItem.create({
    data: {
      category: item.category,
      title: item.title.trim(),
      description: cleanOptional(item.description),
      tag: cleanOptional(item.tag, 80),
      image: cleanOptional(item.image, 1000),
      accentImage: cleanOptional(item.accentImage, 1000),
      items: cleanOptional(item.items, 500),
      bookingValue: cleanOptional(item.bookingValue, 100),
      sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : 0,
      active: item.active !== false,
    },
  });

  return toContentItem(created);
}

export async function updateContentItem(id: string, item: ContentItemRequest) {
  const updated = await prisma.contentItem.update({
    where: { id },
    data: {
      category: item.category,
      title: item.title.trim(),
      description: cleanOptional(item.description),
      tag: cleanOptional(item.tag, 80),
      image: cleanOptional(item.image, 1000),
      accentImage: cleanOptional(item.accentImage, 1000),
      items: cleanOptional(item.items, 500),
      bookingValue: cleanOptional(item.bookingValue, 100),
      sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : 0,
      active: item.active !== false,
    },
  });

  return toContentItem(updated);
}
