import axios from "axios";
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Calendar, CheckCircle2, Clock, Mail, Phone, UserRound } from "lucide-react";
import type { Booking } from "@shared/types";

const statusCopy: Record<Booking["status"], string> = {
  PENDING: "We received your request and will contact you soon.",
  CONFIRMED: "Your request is confirmed. Please check the appointment details below.",
  IN_PROGRESS: "Your job is currently in progress.",
  COMPLETED: "This request has been marked as completed.",
  CANCELLED: "This request has been cancelled. Contact us if you need help again.",
};

function formatDate(value?: string) {
  if (!value) {
    return "Not scheduled yet";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function TrackBooking() {
  const [, params] = useRoute<{ token: string }>("/track/:token");
  const token = params?.token ?? "";
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This tracking link is missing a booking token.");
      setLoading(false);
      return;
    }

    axios.get<{ booking: Booking }>(`/api/bookings/track/${token}`)
      .then(({ data }) => {
        setBooking(data.booking);
        setError("");
      })
      .catch(() => {
        setError("We could not find this booking. Please contact FixMyDoor Services if you need help.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_#f8f1e7,_#ffffff_55%,_#f4e2ca)] px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-2 shadow-sm">
          <img src="/img5150-transparent.png" alt="FixMyDoor" className="h-14 w-auto object-contain" />
          <span className="font-display text-lg font-bold text-secondary">FixMyDoor Services</span>
        </a>

        <section className="mt-8 overflow-hidden rounded-[30px] border border-primary/15 bg-white shadow-[0_24px_70px_rgba(66,40,18,0.12)]">
          <div className="bg-[#2f241c] p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Request Tracking</p>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Your FixMyDoor Services request status</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75">
              This page shows the latest status we have for your repair, installation, or product request.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {loading && <p className="text-foreground/70">Loading your request...</p>}

            {!loading && error && (
              <div className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {!loading && booking && (
              <div className="space-y-6">
                <div className="rounded-[24px] bg-background p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Current Status</p>
                      <h2 className="mt-2 text-3xl font-bold text-secondary">{booking.status.replace("_", " ")}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/70">{statusCopy[booking.status]}</p>
                    </div>
                    <CheckCircle2 className="h-14 w-14 text-primary" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-primary/10 p-4">
                    <UserRound className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-foreground/50">Name</p>
                    <p className="mt-1 font-semibold text-secondary">{booking.name}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-4">
                    <Clock className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-foreground/50">Request</p>
                    <p className="mt-1 font-semibold text-secondary">{booking.repairType}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-4">
                    <Calendar className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-foreground/50">Appointment</p>
                    <p className="mt-1 font-semibold text-secondary">{booking.appointmentTime || formatDate(booking.preferredDate)}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-4">
                    <CheckCircle2 className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-foreground/50">Quote</p>
                    <p className="mt-1 font-semibold text-secondary">{booking.quoteAmount || "To be confirmed"}</p>
                    {(booking.invoiceStatus || booking.paymentStatus) && (
                      <p className="mt-2 text-xs leading-relaxed text-foreground/60">
                        {booking.invoiceStatus || "Invoice not issued"} | {booking.paymentStatus || "Payment not confirmed"}
                      </p>
                    )}
                  </div>
                </div>

                {booking.statusHistory && booking.statusHistory.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-secondary">Status History</h3>
                    <div className="mt-3 space-y-3">
                      {booking.statusHistory.map((entry, index) => (
                        <div key={`${entry.status}-${entry.changedAt}-${index}`} className="rounded-2xl bg-background p-4">
                          <p className="font-bold text-secondary">{entry.status.replace("_", " ")}</p>
                          <p className="text-sm text-foreground/60">{formatDate(entry.changedAt)}</p>
                          {entry.note && <p className="mt-1 text-sm text-foreground/70">{entry.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="mt-6 grid gap-3 rounded-[24px] bg-white p-5 shadow-sm sm:grid-cols-2">
          <a href="tel:+14383471823" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
            <Phone className="h-4 w-4" />
            Call +1 (438) 347-1823
          </a>
          <a href="mailto:booking@fixmydoor.ca" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-white">
            <Mail className="h-4 w-4" />
            Email FixMyDoor Services
          </a>
        </div>
      </div>
    </main>
  );
}
