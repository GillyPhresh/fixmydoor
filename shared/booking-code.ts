export function formatBookingDisplayId(booking: { id?: string | null; createdAt?: string | Date | null }) {
  const rawId = String(booking.id || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const suffix = (rawId.slice(-6) || "000000").padStart(6, "0");
  const createdAt = new Date(booking.createdAt || Date.now());
  const datePart = Number.isNaN(createdAt.getTime())
    ? new Date().toISOString().slice(0, 10).replace(/-/g, "")
    : createdAt.toISOString().slice(0, 10).replace(/-/g, "");

  return `FMD-SVC-${datePart}-${suffix}`;
}
