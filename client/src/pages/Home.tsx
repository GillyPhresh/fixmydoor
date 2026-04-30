import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Lock, Home as HomeIcon, Users, Phone, Mail, MapPin, CheckCircle2, Zap, DollarSign, MessageCircle, Instagram, Twitter, Facebook } from "lucide-react";
import { toast } from "sonner";
import type { BookingRequest } from "@shared/types";

/**
 * FixMyDoor MVP Website
 * Design: Warm Craft & Reliability
 * - Walnut brown (#6B4423) + Burnt orange (#D97706) + Warm cream (#F5F1E8)
 * - Playfair Display for headlines (serif, premium feel)
 * - Inter for body text (readable, professional)
 * - Asymmetric layouts with diagonal dividers
 * - Warm drop shadows and tactile interactions
 */

const bookingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email address"),
  address: z.string().min(5, "Please enter your full address"),
  repairType: z.string().min(1, "Please select a service type"),
  preferredDate: z.string().optional(),
  message: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export default function Home() {
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      repairType: "",
      preferredDate: "",
      message: "",
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    const payload: BookingRequest = {
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      address: data.address.trim(),
      repairType: data.repairType,
      preferredDate: data.preferredDate || undefined,
      message: data.message?.trim() || undefined,
    };

    try {
      await axios.post("/api/bookings", payload);
      toast.success("Booking request submitted! We'll contact you soon.");
      form.reset();
    } catch (error) {
      toast.error("Unable to submit booking at this time. Please try again later.");
      console.error("Booking submission error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white shadow-md">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-secondary">FixMyDoor</h1>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium">
            <a href="#services" className="hover:text-primary transition">Services</a>
            <a href="#how-it-works" className="hover:text-primary transition">How It Works</a>
            <a href="#about" className="hover:text-primary transition">About</a>
            <a href="#testimonials" className="hover:text-primary transition">Testimonials</a>
            <a href="#contact" className="hover:text-primary transition">Contact</a>
          </div>
          <a href="tel:+148383471823" className="btn-primary text-sm">
            Call Now
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: Text Content */}
          <div className="container py-16 md:py-24 order-2 md:order-1">
            <div className="max-w-lg">
              <h1 className="text-5xl md:text-6xl font-display font-bold text-secondary mb-6">
                Fix Your Door Fast
              </h1>
              <p className="text-xl text-foreground/80 mb-2 font-medium">We Come to You</p>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                Professional door and furniture repair services delivered right to your home in Montreal. Fast, affordable, and reliable.
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <a href="tel:+148383471823" className="btn-primary text-center">
                  <Phone className="inline mr-2 w-5 h-5" />
                  Call Now
                </a>
                <a href="#contact" className="btn-secondary text-center">
                  Book a Repair
                </a>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4">
                <div className="trust-badge">
                  <div className="trust-badge-icon">
                    <Zap className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold">Fast Service</p>
                </div>
                <div className="trust-badge">
                  <div className="trust-badge-icon">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold">Affordable</p>
                </div>
                <div className="trust-badge">
                  <div className="trust-badge-icon">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold">Skilled</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="order-1 md:order-2 h-96 md:h-full md:min-h-screen relative">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663613267557/GWvF54GYKre39h7gSYtVFi/fixmydoor-hero-door-repair-Eudn4HAV8QqUbP4m3HMWKj.webp"
              alt="Professional door repair service"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent"></div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="section-divider bg-white">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-secondary mb-4">
              Our Services
            </h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
              We fix doors, locks, hinges, handles, chairs, tables, and all your furniture needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Door Repair */}
            <div className="service-card">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HomeIcon className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-secondary mb-2">Door Repair & Alignment</h3>
                  <p className="text-foreground/70">
                    Fix stuck, squeaky, or misaligned doors. Professional alignment and repair.
                  </p>
                </div>
              </div>
            </div>

            {/* Lock & Hinge */}
            <div className="service-card">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Lock className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-secondary mb-2">Lock & Hinge Fixing</h3>
                  <p className="text-foreground/70">
                    Repair or replace broken locks, hinges, and handles with quality parts.
                  </p>
                </div>
              </div>
            </div>

            {/* Chair Repair */}
            <div className="service-card">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-secondary mb-2">Chair Repair</h3>
                  <p className="text-foreground/70">
                    Fix broken legs, seats, backs, and joints. Restore your chairs to like-new condition.
                  </p>
                </div>
              </div>
            </div>

            {/* Table Repair */}
            <div className="service-card">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-secondary mb-2">Table Repair</h3>
                  <p className="text-foreground/70">
                    Repair wobbly tables, damaged surfaces, and broken supports with precision.
                  </p>
                </div>
              </div>
            </div>

            {/* Furniture Maintenance */}
            <div className="service-card">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HomeIcon className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-secondary mb-2">General Furniture Repairs</h3>
                  <p className="text-foreground/70">
                    Fix drawers, cabinets, shelves, and other furniture issues at your home.
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Service */}
            <div className="service-card">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-secondary mb-2">Emergency Service</h3>
                  <p className="text-foreground/70">
                    Need urgent help? Contact us for same-day or next-day emergency repairs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="section-divider">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-secondary text-center mb-16">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-2xl font-semibold text-secondary mb-3">Contact Us</h3>
              <p className="text-foreground/70 leading-relaxed">
                Call us at <a href="tel:+148383471823" className="font-semibold text-primary hover:underline">+1 (483) 834-7182</a> or fill out our booking form with details about your repair.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-secondary text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-2xl font-semibold text-secondary mb-3">Schedule Visit</h3>
              <p className="text-foreground/70 leading-relaxed">
                We'll confirm your appointment and schedule a time that works best for you. We serve Montreal and surrounding areas.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-2xl font-semibold text-secondary mb-3">We Fix It</h3>
              <p className="text-foreground/70 leading-relaxed">
                Richard arrives with all necessary tools and parts. We complete the repair at your home with minimal disruption.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="section-divider bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Image */}
          <div className="h-96 md:h-full md:min-h-96">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663613267557/GWvF54GYKre39h7gSYtVFi/fixmydoor-technician-portrait-9gwm4Hysz9FXp4Bp8sgcpC.webp"
              alt="Richard Ampofo, FixMyDoor Technician"
              className="w-full h-full object-cover rounded-lg"
            />
          </div>

          {/* Content */}
          <div className="container py-8 md:py-0">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-secondary mb-6">
              About Richard Ampofo
            </h2>
            <p className="text-lg text-foreground/70 mb-6 leading-relaxed">
              Richard is a skilled technician with years of hands-on experience in door and furniture repair. Based in Montreal, Quebec, he's committed to delivering professional, high-quality workmanship on every job.
            </p>
            <p className="text-lg text-foreground/70 mb-6 leading-relaxed">
              Whether it's a stuck door, broken hinge, wobbly chair, or damaged table, Richard brings expertise, precision, and a commitment to customer satisfaction to every repair.
            </p>
            <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
              FixMyDoor is built on the principle that quality repairs should be accessible, affordable, and convenient. We come to you so you don't have to worry about transporting your furniture or dealing with complex repairs yourself.
            </p>
            <div className="flex gap-4">
              <a href="tel:+148383471823" className="btn-primary">
                Schedule Now
              </a>
              <a href="mailto:info.fixmydoor@gmail.com" className="btn-secondary">
                Send Email
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="section-divider">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-secondary text-center mb-16">
            What Our Customers Say
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-primary text-xl">★</span>
                ))}
              </div>
              <p className="text-foreground/80 mb-6 leading-relaxed">
                "Richard fixed my stuck front door in less than an hour. Professional, friendly, and fair pricing. Highly recommend!"
              </p>
              <p className="font-semibold text-secondary">Sarah M.</p>
              <p className="text-sm text-foreground/60">Montreal, QC</p>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-primary text-xl">★</span>
                ))}
              </div>
              <p className="text-foreground/80 mb-6 leading-relaxed">
                "My dining chairs were falling apart. Richard repaired all four beautifully. They look brand new!"
              </p>
              <p className="font-semibold text-secondary">James T.</p>
              <p className="text-sm text-foreground/60">Montreal, QC</p>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-primary text-xl">★</span>
                ))}
              </div>
              <p className="text-foreground/80 mb-6 leading-relaxed">
                "Quick response, professional service, and reasonable rates. Richard is exactly what I needed for my home repairs."
              </p>
              <p className="font-semibold text-secondary">Lisa R.</p>
              <p className="text-sm text-foreground/60">Montreal, QC</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Booking Section */}
      <section id="contact" className="section-divider bg-white">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-secondary mb-8">
                Get in Touch
              </h2>

              <div className="space-y-6">
                {/* Phone */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-1">Phone</p>
                    <a href="tel:+148383471823" className="text-lg text-primary hover:underline">
                      +1 (483) 834-7182
                    </a>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-1">WhatsApp</p>
                    <a href="https://wa.me/233242011305" className="text-lg text-primary hover:underline">
                      +233 24 201 1305
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-2">Email</p>
                    <div className="space-y-1">
                      <div>
                        <span className="text-sm text-foreground/60">Business:</span>
                        <a href="mailto:info.fixmydoor@gmail.com" className="text-lg text-primary hover:underline ml-1">
                          info.fixmydoor@gmail.com
                        </a>
                      </div>
                      <div>
                        <span className="text-sm text-foreground/60">Personal:</span>
                        <a href="mailto:ampofor55@gmail.com" className="text-lg text-primary hover:underline ml-1">
                          ampofor55@gmail.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Media */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-1">Follow Us</p>
                    <div className="flex gap-4">
                      <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-primary hover:text-primary/80 transition" aria-label="Instagram">
                        <Instagram className="w-5 h-5" />
                      </a>
                      <a href="https://x.com/fixmydoor?s=11" className="text-primary hover:text-primary/80 transition" aria-label="X (Twitter)">
                        <Twitter className="w-5 h-5" />
                      </a>
                      <a href="#" className="text-primary hover:text-primary/80 transition opacity-50" aria-label="Facebook (Coming Soon)">
                        <Facebook className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-1">Service Area</p>
                    <p className="text-foreground/70">
                      10158 Rue Berri<br />
                      Montreal, Quebec H3L 2G6<br />
                      Canada
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Form */}
            <div className="bg-background rounded-lg p-8 border border-border">
              <h3 className="text-2xl font-semibold text-secondary mb-6">Book a Repair</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {/* Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Phone *</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+1 (438) 000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your.email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Address */}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full address in Montreal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Service Type */}
                  <FormField
                    control={form.control}
                    name="repairType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Service Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="door-repair">Door Repair</SelectItem>
                            <SelectItem value="door-alignment">Door Alignment</SelectItem>
                            <SelectItem value="furniture-repair">Furniture Repair</SelectItem>
                            <SelectItem value="chair-repair">Chair Repair</SelectItem>
                            <SelectItem value="table-repair">Table Repair</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preferred Date */}
                  <FormField
                    control={form.control}
                    name="preferredDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Preferred Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your repair needs in detail..."
                            className="min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <Button type="submit" className="btn-primary w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Submitting..." : "Submit Booking Request"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden z-40 flex gap-2">
        <a href="tel:+148383471823" className="flex-1 btn-primary text-center text-sm">
          Call
        </a>
        <a href="#contact" className="flex-1 btn-secondary text-center text-sm">
          Book
        </a>
      </div>

      {/* Footer */}
      <footer className="bg-secondary text-white py-12">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="w-6 h-6" />
                <h3 className="text-xl font-display font-bold">FixMyDoor</h3>
              </div>
              <p className="text-white/80">Professional door and furniture repair services in Montreal.</p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-white/80">
                <li><a href="#services" className="hover:text-white transition">Services</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition">How It Works</a></li>
                <li><a href="#about" className="hover:text-white transition">About</a></li>
                <li><a href="#contact" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-white/80">
                <li>Door Repair</li>
                <li>Lock & Hinge Fixing</li>
                <li>Chair Repair</li>
                <li>Table Repair</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-white/80">
                <li><a href="tel:+148383471823" className="hover:text-white transition">+1 (483) 834-7182</a></li>
                <li><a href="https://wa.me/233242011305" className="hover:text-white transition">WhatsApp: +233 24 201 1305</a></li>
                <li>
                  <div className="space-y-1">
                    <div><a href="mailto:info.fixmydoor@gmail.com" className="hover:text-white transition">info.fixmydoor@gmail.com</a></div>
                    <div><a href="mailto:ampofor55@gmail.com" className="hover:text-white transition">ampofor55@gmail.com</a></div>
                  </div>
                </li>
                <li>Montreal, QC</li>
              </ul>
              <div className="flex gap-3 mt-4">
                <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-white/80 hover:text-white transition" aria-label="Instagram">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://x.com/fixmydoor?s=11" className="text-white/80 hover:text-white transition" aria-label="X (Twitter)">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-white/80 hover:text-white transition opacity-50" aria-label="Facebook (Coming Soon)">
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8">
            <p className="text-center text-white/80">
              &copy; 2026 FixMyDoor. All rights reserved. | Serving Montreal with professional repair services.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
